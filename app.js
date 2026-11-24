import { normalizeHex, hexToRgb, rgbToHex, readableText, contrastRatio, contrastGrade, cssPalette } from './color.js';

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
    const extracted = thief.getPalette(image, count, quality)?.map(rgbToHex);
    if (!extracted?.length) throw new Error('No visible pixels');
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
  await loadImage(URL.createObjectURL(file), nextName, null, file);
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
  const filename = paletteName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 60) || 'neo-palette';
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

$('#upload').addEventListener('click', () => $('#file-input').click());
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
  if (library.some((item) => item.name === name && item.colors.join() === colors.join())) { toast('这组色板已收藏'); return; }
  if (library.length >= 100) { toast('最多收藏 100 组色板'); return; }
  const previous = [...library];
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
  library.push({ id: crypto.randomUUID(), name, colors: [...colors], sampleId, imageData, date: new Date().toISOString() });
  if (!persist()) library = previous;
  else toast('已加入我的色板');
  renderLibrary();
});
document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
$('#back-to-workspace').addEventListener('click', () => setView('workspace'));
$('#export-top').addEventListener('click', () => openExport());
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
