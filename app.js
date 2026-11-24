import { normalizeHex, hexToRgb, rgbToHex, readableText, contrastRatio, contrastGrade, cssPalette, luminance } from './color.js';
import { schemes, categories, roleNames, defaultCopy, filterSchemes } from './schemes.js';
import { renderApplication, loadPhotos, setCustomPhoto, customPhotoData } from './application.js';

const $ = (selector) => document.querySelector(selector);
const storageKey = 'neo-palettes-v1';
const samples = {
  garden: { name: '花园午后', file: 'garden.jpg', source: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946' },
  coast: { name: '海岸假日', file: 'coast.jpg', source: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b' },
  city: { name: '城市几何', file: 'city.jpg', source: 'https://images.unsplash.com/photo-1487958449943-2429e8be8625' },
  mountain: { name: '山野之间', file: 'mountain.jpg', source: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee' },
};
let colors = [];
let locked = [];
let selected = 0;
let sampleId = 'garden';
let name = samples.garden.name;
let objectUrl = null;
let loadVersion = 0;
let quality = 8;
let picking = false;
let toastTimer;
let deleteId = null;
let library = [];
let activeView = 'schemes';
let chosenScheme = schemes[0];
let projectColors = [...chosenScheme.colors];
let projectName = chosenScheme.name;
let projectMode = chosenScheme.category;
let projectTitle = defaultCopy[projectMode].title;
let projectSubtitle = defaultCopy[projectMode].subtitle;
let projectPhoto = chosenScheme.photo;
let projectFormat = 'wide';
let projectFont = 72;
let projectLabel = '城市 / 生活 / 观察';
let projectValues = [24, 46, 68, 87];

try {
  const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
  if (Array.isArray(stored)) {
    library = stored.filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string' && Array.isArray(item.colors) && item.colors.length >= 3 && item.colors.length <= 8 && item.colors.every((color) => normalizeHex(color)));
  }
} catch { /* A damaged or unavailable local store does not block the workbench. */ }

function icons() {
  window.lucide?.createIcons();
}

function toast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3200);
}

function persist() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(library));
    return true;
  } catch {
    toast('浏览器无法保存收藏');
    return false;
  }
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('已复制');
  } catch {
    toast('无法访问剪贴板，请从颜色字段复制');
  }
}

function setBusy(busy) {
  $('#image-loading').hidden = !busy;
  $('#extract').disabled = busy;
  $('#color-count').disabled = busy;
  $('#save').disabled = busy || !colors.length;
}

function updateColor(index, hex) {
  colors[index] = hex;
  selected = index;
  renderColors();
}

function renderColors() {
  const list = $('#swatch-list');
  list.replaceChildren();
  $('#palette-strip').replaceChildren();
  colors.forEach((hex, index) => {
    const row = document.createElement('div');
    row.className = 'swatch-row' + (selected === index ? ' selected' : '');
    const input = document.createElement('input');
    input.type = 'color';
    input.className = 'swatch-input';
    input.value = hex;
    input.setAttribute('aria-label', `颜色 ${index + 1}`);
    input.addEventListener('input', () => {
      colors[index] = input.value.toUpperCase();
      selected = index;
      hexInput.value = colors[index];
      rgb.textContent = 'RGB ' + hexToRgb(colors[index]).join(' · ');
      strip.style.backgroundColor = colors[index];
      strip.style.color = readableText(colors[index]);
      strip.textContent = colors[index];
      $('#selected-label').textContent = `COLOR ${String(index + 1).padStart(2, '0')}`;
    });
    input.addEventListener('change', renderColors);

    const meta = document.createElement('div');
    meta.className = 'swatch-meta';
    const hexInput = document.createElement('input');
    hexInput.className = 'hex-input';
    hexInput.value = hex;
    hexInput.maxLength = 7;
    hexInput.spellcheck = false;
    hexInput.setAttribute('aria-label', `HEX 颜色 ${index + 1}`);
    hexInput.addEventListener('focus', () => { selected = index; $('#selected-label').textContent = `COLOR ${String(index + 1).padStart(2, '0')}`; });
    hexInput.addEventListener('change', () => {
      const parsed = normalizeHex(hexInput.value);
      if (!parsed) { hexInput.value = colors[index]; toast('请输入有效的 HEX 颜色'); return; }
      updateColor(index, parsed);
    });
    hexInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') hexInput.blur(); });
    const rgb = document.createElement('span');
    rgb.className = 'rgb-label';
    rgb.textContent = 'RGB ' + hexToRgb(hex).join(' · ');
    meta.append(hexInput, rgb);

    const lock = document.createElement('button');
    lock.className = 'icon-button';
    lock.title = locked[index] ? '解锁颜色' : '锁定颜色';
    lock.setAttribute('aria-label', `${lock.title} ${index + 1}`);
    lock.setAttribute('aria-pressed', String(!!locked[index]));
    lock.innerHTML = `<i data-lucide="${locked[index] ? 'lock-keyhole' : 'lock-keyhole-open'}"></i>`;
    lock.addEventListener('click', () => { locked[index] = !locked[index]; renderColors(); });

    const copyButton = document.createElement('button');
    copyButton.className = 'icon-button';
    copyButton.title = '复制 HEX';
    copyButton.setAttribute('aria-label', `复制颜色 ${index + 1}`);
    copyButton.innerHTML = '<i data-lucide="copy"></i>';
    copyButton.addEventListener('click', () => copy(colors[index]));
    row.append(input, meta, lock, copyButton);
    list.append(row);

    const strip = document.createElement('button');
    strip.className = 'strip-color';
    strip.style.backgroundColor = hex;
    strip.style.color = readableText(hex);
    strip.textContent = hex;
    strip.title = `选择颜色 ${index + 1}`;
    strip.setAttribute('aria-label', `选择颜色 ${index + 1} ${hex}`);
    strip.addEventListener('click', () => {
      selected = index;
      $('#foreground').value = colors[index];
      updateContrast();
      renderColors();
    });
    $('#palette-strip').append(strip);
  });
  $('#selected-label').textContent = `COLOR ${String(selected + 1).padStart(2, '0')}`;
  icons();
}

function extractPalette(resetLocks = false) {
  const image = $('#source-image');
  if (!image.complete || !image.naturalWidth) return;
  setBusy(true);
  try {
    const count = Number($('#color-count').value);
    const thief = new window.ColorThief();
    let extracted = thief.getPalette(image, count, quality)?.map(rgbToHex);
    if (!extracted?.length) {
      // Color Thief excludes near-white pixels; keep all-white images usable.
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0, 1, 1);
      const pixel = context.getImageData(0, 0, 1, 1).data;
      if (!pixel[3]) throw new Error('No visible pixels');
      extracted = [rgbToHex([...pixel].slice(0, 3))];
    }
    if (resetLocks) locked = [];
    colors = Array.from({ length: count }, (_, index) => locked[index] && colors[index] ? colors[index] : extracted[index % extracted.length]);
    locked = Array.from({ length: count }, (_, index) => !!locked[index]);
    selected = Math.min(selected, count - 1);
    renderColors();
    if (resetLocks) {
      $('#foreground').value = '#202124';
      $('#background').value = colors.reduce((light, color) => contrastRatio('#202124', color) > contrastRatio('#202124', light) ? color : light, colors[0]);
      updateContrast();
    }
  } catch {
    toast('无法提取颜色，请选择另一张图片');
  } finally {
    setBusy(false);
  }
}

async function loadImage(src, nextName, nextSampleId = null, file = null) {
  const version = ++loadVersion;
  setBusy(true);
  const probe = new Image();
  try {
    probe.src = src;
    await probe.decode();
    if (version !== loadVersion) {
      if (file) URL.revokeObjectURL(src);
      return false;
    }
    if (probe.naturalWidth * probe.naturalHeight > 40000000) throw new Error('Too many pixels');
    const previousObjectUrl = objectUrl;
    $('#source-image').src = src;
    await $('#source-image').decode();
    if (version !== loadVersion) {
      if (file) URL.revokeObjectURL(src);
      return false;
    }
    name = nextName;
    sampleId = nextSampleId;
    objectUrl = file ? src : null;
    if (previousObjectUrl && previousObjectUrl !== objectUrl) URL.revokeObjectURL(previousObjectUrl);
    $('#palette-name').textContent = name;
    $('#image-label').textContent = name;
    $('#source-image').alt = name;
    $('#image-size').textContent = `${probe.naturalWidth} × ${probe.naturalHeight}`;
    $('#photo-credit').hidden = !nextSampleId;
    if (nextSampleId) $('#photo-credit').href = samples[nextSampleId].source;
    document.querySelectorAll('.sample').forEach((button) => {
      const active = button.dataset.sample === sampleId;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    quality = 8;
    extractPalette(true);
    return true;
  } catch {
    if (file) URL.revokeObjectURL(src);
    if (version === loadVersion) toast('图片无法打开，请使用 JPG、PNG 或 WebP（小于 20 MB、4000 万像素）');
    return false;
  } finally {
    if (version === loadVersion) setBusy(false);
  }
}

async function acceptFile(file) {
  if (!file) return;
  if (!/^image\/(jpeg|png|webp|gif|avif|bmp)$/.test(file.type) || file.size > 20 * 1024 * 1024) {
    toast('请选择小于 20 MB 的 JPG、PNG、WebP 或其他支持的图片');
    return;
  }
  const nextName = file.name.replace(/\.[^.]+$/, '').slice(0, 60) || '未命名色板';
  if (await loadImage(URL.createObjectURL(file), nextName, null, file) && activeView === 'schemes') {
    await setCustomPhoto($('#source-image').src);
    $('#custom-photo-option').hidden = false;
    projectPhoto = 'custom';
    renderProject(true);
  }
}

function updateContrast() {
  const fg = $('#foreground').value;
  const bg = $('#background').value;
  const ratio = contrastRatio(fg, bg);
  $('#contrast-ratio').textContent = ratio.toFixed(2);
  $('#contrast-preview').style.color = fg;
  $('#contrast-preview').style.backgroundColor = bg;
  for (const [selector, large] of [['#normal-result', false], ['#large-result', true]]) {
    const result = $(selector);
    result.textContent = contrastGrade(ratio, large);
    result.classList.toggle('fail', result.textContent === '不通过');
  }
}

function setView(view) {
  activeView = view;
  $('#schemes-view').hidden = view !== 'schemes';
  $('#workspace-view').hidden = view !== 'workspace';
  $('#library-view').hidden = view !== 'library';
  document.querySelectorAll('.tab').forEach((tab) => {
    const active = tab.dataset.view === view;
    tab.classList.toggle('active', active);
    if (active) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  });
  if (view === 'library') renderLibrary();
}

function renderLibrary() {
  $('#saved-count').textContent = library.length;
  $('#library-total').textContent = `${library.length} 组`;
  $('#library-empty').hidden = !!library.length;
  const grid = $('#library-grid');
  grid.replaceChildren();
  [...library].reverse().forEach((item) => {
    const card = document.createElement('article');
    card.className = 'saved-card';
    const palette = document.createElement('button');
    palette.className = 'saved-colors';
    palette.title = '打开色板';
    palette.setAttribute('aria-label', `打开色板 ${item.name}`);
    item.colors.forEach((color) => {
      const block = document.createElement('span');
      block.style.backgroundColor = normalizeHex(color);
      palette.append(block);
    });
    palette.addEventListener('click', async () => {
      if (item.kind === 'scheme') {
        setView('schemes');
        chosenScheme = schemes.find((scheme) => scheme.id === item.schemeId) || null;
        projectColors = item.colors.map(normalizeHex);
        projectName = item.name;
        const saved = item.project || {};
        projectMode = Object.hasOwn(categories, saved.mode) ? saved.mode : 'cover';
        projectTitle = typeof saved.title === 'string' ? saved.title.slice(0, 60) : defaultCopy[projectMode].title;
        projectSubtitle = typeof saved.subtitle === 'string' ? saved.subtitle.slice(0, 100) : defaultCopy[projectMode].subtitle;
        projectPhoto = ['none', 'city', 'coast', 'mountain', 'garden'].includes(saved.photo) ? saved.photo : 'none';
        if (saved.photo === 'custom' && typeof item.imageData === 'string' && /^data:image\/jpeg;base64,/.test(item.imageData)) {
          await setCustomPhoto(item.imageData);
          projectPhoto = 'custom';
          $('#custom-photo-option').hidden = false;
        }
        projectFormat = ['wide', 'portrait', 'square'].includes(saved.format) ? saved.format : 'wide';
        projectFont = Number.isFinite(saved.fontSize) ? Math.max(30, Math.min(100, saved.fontSize)) : 72;
        projectLabel = typeof saved.label === 'string' ? saved.label.slice(0, 24) : '城市 / 生活 / 观察';
        projectValues = Array.isArray(saved.values) && saved.values.length === 4 && saved.values.every((value) => Number.isFinite(value) && value >= 0 && value <= 100) ? [...saved.values] : [24, 46, 68, 87];
        renderProject(true);
        renderSchemes();
        return;
      }
      setView('workspace');
      const target = samples[item.sampleId];
      if (target) {
        if (!await loadImage(target.file, target.name, item.sampleId)) return;
      } else if (typeof item.imageData === 'string' && /^data:image\/jpeg;base64,/.test(item.imageData)) {
        if (!await loadImage(item.imageData, item.name)) return;
      } else {
        toast('已载入色板；原始图片未保留');
      }
      name = item.name;
      $('#palette-name').textContent = name;
      colors = item.colors.map(normalizeHex);
      $('#color-count').value = colors.length;
      locked = colors.map(() => false);
      selected = 0;
      renderColors();
    });
    const meta = document.createElement('div');
    meta.className = 'saved-card-meta';
    const heading = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = item.name;
    const date = document.createElement('p');
    const savedDate = new Date(item.date);
    date.textContent = `${item.colors.length} 色 · ${Number.isNaN(savedDate.getTime()) ? '' : savedDate.toLocaleDateString('zh-CN')}`;
    heading.append(title, date);
    const actions = document.createElement('div');
    actions.className = 'saved-actions';
    const exportButton = document.createElement('button');
    exportButton.className = 'icon-button';
    exportButton.title = '导出色板';
    exportButton.setAttribute('aria-label', `导出 ${item.name}`);
    exportButton.innerHTML = '<i data-lucide="download"></i>';
    exportButton.addEventListener('click', () => openExport(item.colors, item.name));
    const deleteButton = document.createElement('button');
    deleteButton.className = 'icon-button';
    deleteButton.title = '删除收藏';
    deleteButton.setAttribute('aria-label', `删除 ${item.name}`);
    deleteButton.innerHTML = '<i data-lucide="trash-2"></i>';
    deleteButton.addEventListener('click', () => {
      deleteId = item.id;
      $('#delete-name').textContent = item.name;
      $('#delete-dialog').showModal();
    });
    actions.append(exportButton, deleteButton);
    meta.append(heading, actions);
    card.append(palette, meta);
    grid.append(card);
  });
  icons();
}

let exportColors = [];
function openExport(palette = colors, paletteName = name) {
  if (!palette.length) { toast('请先提取一组配色'); return; }
  exportColors = [...palette];
  $('#export-name').value = paletteName;
  $('#export-preview').replaceChildren(...palette.map((color) => {
    const span = document.createElement('span');
    span.style.backgroundColor = color;
    return span;
  }));
  $('#export-dialog').showModal();
}

function safeFilename(value) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 60) || 'neo-palette';
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

async function exportPalette(format) {
  const paletteName = $('#export-name').value.trim() || 'NEO 色板';
  const filename = safeFilename(paletteName);
  if (format === 'css') {
    download(new Blob([cssPalette(exportColors)], { type: 'text/css;charset=utf-8' }), `${filename}.css`);
  } else if (format === 'json') {
    const json = { name: paletteName, colors: exportColors.map((hex) => ({ hex, rgb: hexToRgb(hex) })), source: 'https://neo.abc.sd' };
    download(new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' }), `${filename}.json`);
  } else {
    const canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 1040;
    const context = canvas.getContext('2d');
    context.fillStyle = '#FAFAFA';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#202124';
    context.font = '600 44px "Microsoft YaHei", sans-serif';
    let fontSize = 44;
    while (context.measureText(paletteName).width > 1440 && fontSize > 16) {
      context.font = `600 ${--fontSize}px "Microsoft YaHei", sans-serif`;
    }
    context.fillText(paletteName, 80, 112);
    const width = 1440 / exportColors.length;
    exportColors.forEach((color, index) => {
      context.fillStyle = color;
      context.fillRect(80 + width * index, 178, width, 634);
      context.fillStyle = '#202124';
      context.font = `${exportColors.length > 6 ? 25 : 30}px Consolas, monospace`;
      context.textAlign = 'center';
      context.fillText(color, 80 + width * (index + .5), 870);
      context.font = '18px Consolas, monospace';
      context.fillStyle = '#8A8B91';
      context.fillText(hexToRgb(color).join(' / '), 80 + width * (index + .5), 908);
    });
    context.textAlign = 'left';
    context.fillStyle = '#8A8B91';
    context.font = '20px Consolas, monospace';
    context.fillText('NEO / COLOR STUDIO', 80, 990);
    context.textAlign = 'right';
    context.fillText('neo.abc.sd', 1520, 990);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) { toast('图片导出失败'); return; }
    download(blob, `${filename}.png`);
  }
  toast('已导出色板');
}

function savePalette(palette, paletteName, metadata = {}, updateExisting = false) {
  if (!palette.length) return;
  const existing = library.findIndex((item) => item.name === paletteName && item.colors.join() === palette.join()
    && (item.kind === 'scheme') === (metadata.kind === 'scheme'));
  if (existing !== -1) {
    if (updateExisting && metadata.kind === 'scheme') {
      const previous = library;
      library = library.map((item, index) => index === existing ? { ...item, ...metadata, date: new Date().toISOString() } : item);
      if (!persist()) library = previous;
      else toast('已更新收藏方案');
      renderLibrary();
      return;
    }
    toast('这组色板已收藏');
    return;
  }
  if (library.length >= 100) { toast('最多收藏 100 组色板'); return; }
  const previous = [...library];
  library.push({ id: crypto.randomUUID(), name: paletteName, colors: [...palette], date: new Date().toISOString(), ...metadata });
  if (!persist()) library = previous;
  else toast('已加入我的色板');
  renderLibrary();
}

function projectState() {
  return { mode: projectMode, colors: projectColors, title: projectTitle, subtitle: projectSubtitle, photo: projectPhoto, fontSize: projectFont, label: projectLabel, values: projectValues };
}

function renderProject(updateControls = false) {
  const canvas = $('#application-canvas');
  canvas.width = 1200;
  canvas.height = projectFormat === 'wide' ? 675 : projectFormat === 'portrait' ? 1600 : 1200;
  canvas.style.aspectRatio = `${canvas.width} / ${canvas.height}`;
  renderApplication(canvas, projectState());
  $('#project-name').textContent = projectName;
  $('#project-dimensions').textContent = projectFormat === 'wide' ? '1920 × 1080 px' : projectFormat === 'portrait' ? '1080 × 1440 px' : '1080 × 1080 px';
  const ratio = contrastRatio(projectColors[0], projectColors[1]);
  $('#project-ratio').textContent = ratio.toFixed(2) + ' : 1';
  $('#project-grade').textContent = contrastGrade(ratio);
  $('#project-grade').classList.toggle('fail', ratio < 4.5);
  $('#project-label-control').hidden = projectMode !== 'cover';
  $('#chart-data-controls').hidden = projectMode !== 'chart';
  document.querySelectorAll('[data-mode]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.mode === projectMode)));
  if (!updateControls) return;
  $('#project-title').value = projectTitle;
  $('#project-subtitle').value = projectSubtitle;
  $('#project-label').value = projectLabel;
  document.querySelectorAll('[data-quarter]').forEach((input) => { input.value = projectValues[Number(input.dataset.quarter)]; });
  $('#project-photo').value = projectPhoto;
  $('#project-format').value = projectFormat;
  $('#project-font').value = projectFont;
  $('#font-value').value = projectFont;
  $('#project-colors').replaceChildren(...projectColors.map((hex, index) => {
    const label = document.createElement('label');
    const role = document.createElement('span');
    role.textContent = roleNames[index];
    const input = document.createElement('input');
    input.type = 'color';
    input.value = hex;
    input.setAttribute('aria-label', `${roleNames[index]}色`);
    const value = document.createElement('small');
    value.textContent = hex;
    input.addEventListener('input', () => {
      projectColors[index] = input.value.toUpperCase();
      value.textContent = projectColors[index];
      renderProject();
    });
    label.append(role, input, value);
    return label;
  }));
}

function setMode(mode) {
  if (projectTitle === defaultCopy[projectMode].title) projectTitle = defaultCopy[mode].title;
  if (projectSubtitle === defaultCopy[projectMode].subtitle) projectSubtitle = defaultCopy[mode].subtitle;
  projectMode = mode;
  renderProject(true);
}

function applyScheme(scheme) {
  chosenScheme = scheme;
  projectName = scheme.name;
  projectColors = [...scheme.colors];
  projectPhoto = scheme.photo;
  setMode(scheme.category);
  renderSchemes();
  if (matchMedia('(max-width: 900px)').matches) $('.application-panel').scrollIntoView({ block: 'start' });
}

function schemeMetadata(scheme) {
  return {
    kind: 'scheme', schemeId: scheme.id,
    project: { mode: scheme.category, ...defaultCopy[scheme.category], photo: scheme.photo, format: 'wide', fontSize: 72 },
  };
}

function renderSchemes() {
  const results = filterSchemes({
    category: $('#scheme-category').value,
    tone: $('#scheme-tone').value,
    query: $('#scheme-search').value,
  });
  $('#scheme-total').textContent = `${results.length} / ${schemes.length} 组方案`;
  $('#scheme-empty').hidden = !!results.length;
  $('#clear-search').hidden = !$('#scheme-search').value;
  $('#scheme-grid').replaceChildren(...results.map((scheme) => {
    const card = document.createElement('article');
    card.className = 'scheme-card' + (chosenScheme?.id === scheme.id ? ' selected' : '');
    card.dataset.scheme = scheme.id;
    const button = document.createElement('button');
    button.className = 'scheme-preview';
    button.setAttribute('aria-label', `应用方案 ${scheme.name}`);
    button.setAttribute('aria-pressed', String(chosenScheme?.id === scheme.id));
    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 405;
    canvas.setAttribute('aria-label', `${scheme.name}的${categories[scheme.category]}示例`);
    renderApplication(canvas, { mode: scheme.category, colors: scheme.colors, ...defaultCopy[scheme.category], photo: scheme.photo, fontSize: 72 });
    button.append(canvas);
    button.addEventListener('click', () => applyScheme(scheme));
    const strip = document.createElement('div');
    strip.className = 'scheme-swatches';
    scheme.colors.forEach((color) => {
      const block = document.createElement('span');
      block.style.backgroundColor = color;
      block.title = color;
      strip.append(block);
    });
    const meta = document.createElement('div');
    meta.className = 'scheme-meta';
    const heading = document.createElement('h3');
    heading.textContent = scheme.name;
    const category = document.createElement('span');
    category.className = 'scheme-category';
    category.textContent = categories[scheme.category];
    const tags = document.createElement('p');
    tags.textContent = scheme.tags;
    const actions = document.createElement('div');
    actions.className = 'scheme-card-actions';
    const ratio = contrastRatio(scheme.colors[0], scheme.colors[1]);
    const grade = document.createElement('span');
    grade.className = 'scheme-grade';
    grade.textContent = `${contrastGrade(ratio)} · ${ratio.toFixed(1)} : 1`;
    grade.title = '方案文字与背景的对比度';
    const save = document.createElement('button');
    save.className = 'icon-button';
    save.title = '收藏配色方案';
    save.setAttribute('aria-label', `收藏方案 ${scheme.name}`);
    save.innerHTML = '<i data-lucide="bookmark-plus"></i>';
    save.addEventListener('click', () => savePalette(scheme.colors, scheme.name, schemeMetadata(scheme)));
    actions.append(grade, save);
    meta.append(heading, category, tags, actions);
    card.append(button, strip, meta);
    return card;
  }));
  icons();
}

async function downloadProject() {
  const snapshot = { ...projectState(), colors: [...projectColors], values: [...projectValues] };
  const filename = `${safeFilename(snapshot.title || projectName)}-${snapshot.mode}.png`;
  const canvas = document.createElement('canvas');
  canvas.width = projectFormat === 'wide' ? 1920 : 1080;
  canvas.height = projectFormat === 'wide' ? 1080 : projectFormat === 'portrait' ? 1440 : 1080;
  renderApplication(canvas, snapshot);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) { toast('作品导出失败'); return; }
  download(blob, filename);
  toast('已导出作品');
}

$('#upload').addEventListener('click', () => $('#file-input').click());
$('#upload-project-photo').addEventListener('click', () => $('#file-input').click());
$('#file-input').addEventListener('change', async (event) => {
  await acceptFile(event.target.files[0]);
  event.target.value = '';
});
const stage = $('#image-stage');
stage.addEventListener('dragover', (event) => { event.preventDefault(); stage.classList.add('dragging'); });
stage.addEventListener('dragleave', (event) => { if (!stage.contains(event.relatedTarget)) stage.classList.remove('dragging'); });
stage.addEventListener('drop', (event) => { event.preventDefault(); stage.classList.remove('dragging'); acceptFile(event.dataTransfer.files[0]); });
window.addEventListener('dragover', (event) => event.preventDefault());
window.addEventListener('drop', (event) => event.preventDefault());
document.querySelectorAll('.sample').forEach((button) => button.addEventListener('click', () => {
  const sample = samples[button.dataset.sample];
  loadImage(sample.file, sample.name, button.dataset.sample);
}));
$('#extract').addEventListener('click', () => { quality = quality === 8 ? 13 : 8; extractPalette(); });
$('#color-count').addEventListener('change', () => extractPalette());
$('#eyedropper').addEventListener('click', () => {
  picking = !picking;
  $('#eyedropper').setAttribute('aria-pressed', String(picking));
  stage.classList.toggle('picking', picking);
});
stage.addEventListener('click', (event) => {
  if (!picking || event.target.closest('button') || !colors.length) return;
  const image = $('#source-image');
  const rect = image.getBoundingClientRect();
  const scale = Math.min(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
  const imageWidth = image.naturalWidth * scale;
  const imageHeight = image.naturalHeight * scale;
  const x = (event.clientX - rect.left - (rect.width - imageWidth) / 2) / scale;
  const y = (event.clientY - rect.top - (rect.height - imageHeight) / 2) / scale;
  if (x < 0 || y < 0 || x >= image.naturalWidth || y >= image.naturalHeight) return;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d');
  context.drawImage(image, Math.floor(x), Math.floor(y), 1, 1, 0, 0, 1, 1);
  const pixel = context.getImageData(0, 0, 1, 1).data;
  if (!pixel[3]) { toast('当前像素透明'); return; }
  updateColor(selected, rgbToHex([...pixel].slice(0, 3)));
});
$('#foreground').addEventListener('input', updateContrast);
$('#background').addEventListener('input', updateContrast);
$('#swap-contrast').addEventListener('click', () => {
  const fg = $('#foreground').value;
  $('#foreground').value = $('#background').value;
  $('#background').value = fg;
  updateContrast();
});
$('#copy-all').addEventListener('click', () => copy(colors.join(', ')));
$('#save').addEventListener('click', () => {
  if (!colors.length) return;
  let imageData;
  if (!sampleId) {
    const image = $('#source-image');
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 800 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    imageData = canvas.toDataURL('image/jpeg', .78);
  }
  savePalette(colors, name, { sampleId, imageData });
});
document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
$('#back-to-workspace').addEventListener('click', () => setView('workspace'));
$('#export-top').addEventListener('click', () => activeView === 'schemes' ? openExport(projectColors, projectName) : openExport());
$('#use-extracted').addEventListener('click', async () => {
  if (!colors.length) return;
  chosenScheme = null;
  projectName = name;
  const background = colors.reduce((best, hex) => luminance(hex) > luminance(best) ? hex : best, colors[0]);
  projectColors = [background, readableText(background), colors[0], colors[1], colors[2]];
  if (sampleId) projectPhoto = sampleId;
  else {
    await setCustomPhoto($('#source-image').src);
    $('#custom-photo-option').hidden = false;
    projectPhoto = 'custom';
  }
  setView('schemes');
  renderProject(true);
  renderSchemes();
});
document.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
$('#scheme-category').addEventListener('change', renderSchemes);
$('#scheme-tone').addEventListener('change', renderSchemes);
$('#scheme-search').addEventListener('input', renderSchemes);
$('#clear-search').addEventListener('click', () => { $('#scheme-search').value = ''; renderSchemes(); $('#scheme-search').focus(); });
$('#reset-filters').addEventListener('click', () => {
  $('#scheme-category').value = 'all';
  $('#scheme-tone').value = 'all';
  $('#scheme-search').value = '';
  renderSchemes();
});
$('#project-title').addEventListener('input', (event) => { projectTitle = event.target.value; renderProject(); });
$('#project-subtitle').addEventListener('input', (event) => { projectSubtitle = event.target.value; renderProject(); });
$('#project-label').addEventListener('input', (event) => { projectLabel = event.target.value; renderProject(); });
document.querySelectorAll('[data-quarter]').forEach((input) => input.addEventListener('change', () => {
  const index = Number(input.dataset.quarter);
  const value = input.value.trim() ? Number(input.value) : NaN;
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    input.value = projectValues[index];
    toast('完成率应在 0 到 100 之间');
    return;
  }
  projectValues[index] = value;
  renderProject();
}));
$('#project-photo').addEventListener('change', (event) => { projectPhoto = event.target.value; renderProject(); });
$('#project-format').addEventListener('change', (event) => { projectFormat = event.target.value; renderProject(); });
$('#project-font').addEventListener('input', (event) => {
  projectFont = Number(event.target.value);
  $('#font-value').value = projectFont;
  renderProject();
});
$('#download-project').addEventListener('click', () => downloadProject().catch(() => toast('作品导出失败')));
$('#save-project').addEventListener('click', () => savePalette(projectColors, projectName, {
  kind: 'scheme', schemeId: chosenScheme?.id, imageData: projectPhoto === 'custom' ? customPhotoData() : undefined,
  project: { mode: projectMode, title: projectTitle, subtitle: projectSubtitle, photo: projectPhoto, format: projectFormat, fontSize: projectFont, label: projectLabel, values: [...projectValues] },
}, true));
$('#reset-project').addEventListener('click', () => {
  const original = chosenScheme || schemes[0];
  projectMode = original.category;
  projectTitle = defaultCopy[projectMode].title;
  projectSubtitle = defaultCopy[projectMode].subtitle;
  projectFormat = 'wide';
  projectFont = 72;
  projectLabel = '城市 / 生活 / 观察';
  projectValues = [24, 46, 68, 87];
  applyScheme(original);
});
document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => document.getElementById(button.dataset.close).close()));
document.querySelectorAll('[data-format]').forEach((button) => button.addEventListener('click', () => exportPalette(button.dataset.format).catch(() => toast('导出失败，请重试'))));
document.querySelectorAll('dialog').forEach((dialog) => dialog.addEventListener('click', (event) => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
}));
$('#confirm-delete').addEventListener('click', () => {
  const previous = library;
  library = library.filter((item) => item.id !== deleteId);
  if (!persist()) library = previous;
  else toast('已删除收藏');
  $('#delete-dialog').close();
  renderLibrary();
});
window.addEventListener('beforeunload', () => { if (objectUrl) URL.revokeObjectURL(objectUrl); });
icons();
renderLibrary();
updateContrast();
loadImage(samples.garden.file, name, sampleId);
renderProject(true);
loadPhotos().then(() => { renderSchemes(); renderProject(); });
