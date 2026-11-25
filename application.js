import { readableText } from './color.js';

const photoFiles = { garden: 'garden.jpg', city: 'city.jpg', coast: 'coast.jpg', mountain: 'mountain.jpg' };
const photoCache = new Map();

export async function loadPhotos() {
  await Promise.all(Object.entries(photoFiles).map(async ([id, file]) => {
    const image = new Image();
    image.src = new URL(file, import.meta.url).href;
    try { await image.decode(); photoCache.set(id, image); } catch { /* The solid-color templates remain available. */ }
  }));
}

export async function setCustomPhoto(source) {
  const image = new Image();
  image.src = source;
  await image.decode();
  photoCache.set('custom', image);
}

export function customPhotoData() {
  const image = photoCache.get('custom');
  if (!image) return undefined;
  const scale = Math.min(1, 800 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  fill(context, '#FFFFFF', 0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', .78);
}

function fill(context, color, x, y, width, height) {
  context.fillStyle = color;
  context.fillRect(x, y, width, height);
}

function text(context, value, x, y, size, color, weight = 400, maxWidth) {
  context.fillStyle = color;
  context.font = `${weight} ${size}px "Microsoft YaHei", "Segoe UI", sans-serif`;
  context.textBaseline = 'top';
  if (maxWidth) {
    while (context.measureText(value).width > maxWidth && size > 12) {
      context.font = `${weight} ${--size}px "Microsoft YaHei", "Segoe UI", sans-serif`;
    }
  }
  context.fillText(value, x, y);
}

function wrappedText(context, value, x, y, maxWidth, maxHeight, size, color, weight = 700, minimum = 12) {
  if (!value || maxWidth <= 0 || maxHeight <= 0) return 0;
  minimum = Math.min(minimum, maxHeight / 1.4);
  const segments = typeof Intl.Segmenter === 'function'
    ? [...new Intl.Segmenter('zh-CN', { granularity: 'grapheme' }).segment(value)].map((item) => item.segment)
    : Array.from(value);
  let lines;
  while (true) {
    context.font = `${weight} ${size}px "Microsoft YaHei", "Segoe UI", sans-serif`;
    lines = [];
    let line = '';
    for (const part of segments) {
      if (part === '\n') { lines.push(line); line = ''; continue; }
      if (line && context.measureText(line + part).width > maxWidth) { lines.push(line); line = part; }
      else line += part;
    }
    if (line) lines.push(line);
    if (lines.length * size * 1.4 <= maxHeight || size <= minimum) break;
    size = Math.max(minimum, size - 2);
  }
  context.fillStyle = color;
  context.textBaseline = 'top';
  const lineLimit = Math.max(1, Math.floor((maxHeight + .001) / (size * 1.4)));
  if (lines.length > lineLimit) {
    lines = lines.slice(0, lineLimit);
    let last = lines.at(-1);
    while (last && context.measureText(last + '…').width > maxWidth) last = Array.from(last).slice(0, -1).join('');
    lines[lines.length - 1] = last + '…';
  }
  lines.forEach((line, index) => context.fillText(line, x, y + index * size * 1.4));
  return lines.length * size * 1.4;
}

function photo(context, id, x, y, width, height) {
  const image = photoCache.get(id);
  if (!image) return false;
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  context.drawImage(image, (image.naturalWidth - sourceWidth) / 2, (image.naturalHeight - sourceHeight) / 2, sourceWidth, sourceHeight, x, y, width, height);
  return true;
}

export function renderApplication(canvas, project, dimensions = canvas) {
  const { mode, colors: [bg, ink, primary, secondary, detail], title, subtitle, photo: photoId = 'none', fontSize = 72, label = '城市 / 生活 / 观察', values = [24, 46, 68, 87] } = project;
  const context = canvas.getContext('2d');
  const { width, height } = dimensions;
  const portrait = height > width;
  const unit = Math.min(width / 1200, height / 675);
  const pad = 64 * unit;
  const contentWidth = width - pad * 2;
  const line = 2 * unit;
  context.save();
  context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
  context.clearRect(0, 0, width, height);
  fill(context, bg, 0, 0, width, height);

  if (mode === 'cover') {
    fill(context, primary, pad, pad, 38 * unit, 9 * unit);
    text(context, 'WEEKEND / 2026', pad + 55 * unit, pad - 5 * unit, 18 * unit, ink, 500);
    const hasPhoto = photoCache.has(photoId);
    const top = pad + 76 * unit;
    const textWidth = portrait || !hasPhoto ? contentWidth : contentWidth * .57;
    const subtitleBottom = hasPhoto ? (portrait ? height * .49 - 24 * unit : height - pad - 66 * unit) : height * .71 - 24 * unit;
    const titleSpace = Math.min(portrait ? height * .28 : height * .45, subtitleBottom - top - 104 * unit);
    const titleHeight = wrappedText(context, title, pad, top, textWidth, titleSpace, fontSize * unit * (portrait ? 1.15 : 1.3), ink, 700, 12 * unit);
    const subtitleTop = top + titleHeight + 24 * unit;
    wrappedText(context, subtitle, pad, subtitleTop, textWidth, subtitleBottom - subtitleTop, 22 * unit, ink, 400, 12 * unit);
    if (hasPhoto) {
      if (portrait) photo(context, photoId, pad, height * .49, contentWidth, height * .38);
      else photo(context, photoId, width * .66, top - 12 * unit, width * .285, height * .62);
    } else {
      fill(context, secondary, pad, height * .71, contentWidth * .73, height * .12);
      fill(context, detail, pad + contentWidth * .76, height * .71, contentWidth * .24, height * .12);
    }
    context.font = `600 ${15 * unit}px "Microsoft YaHei", sans-serif`;
    const labelWidth = Math.min(contentWidth * .7, Math.max(172 * unit, context.measureText(label).width + 24 * unit));
    fill(context, primary, pad, height - pad - 46 * unit, labelWidth, 42 * unit);
    text(context, label, pad + 12 * unit, height - pad - 34 * unit, 15 * unit, readableText(primary), 600, labelWidth - 24 * unit);
    text(context, 'VOL. 01', width - pad - 88 * unit, height - pad - 25 * unit, 17 * unit, ink);
  } else if (mode === 'subtitle') {
    const pictureHeight = height * .68;
    if (!photo(context, photoId, 0, 0, width, pictureHeight)) {
      fill(context, secondary, 0, 0, width, pictureHeight);
      fill(context, primary, width * .12, pictureHeight * .28, width * .76, pictureHeight * .12);
    }
    fill(context, bg, 0, pictureHeight, width, height - pictureHeight);
    fill(context, primary, pad, pictureHeight + 24 * unit, 32 * unit, 5 * unit);
    const captionTop = pictureHeight + 42 * unit;
    const captionHeight = wrappedText(context, title, pad, captionTop, contentWidth, height * .13, Math.min(fontSize, 50) * unit, ink, 700, 12 * unit);
    const subtitleTop = captionTop + captionHeight + 12 * unit;
    wrappedText(context, subtitle, pad, subtitleTop, contentWidth, height - pad * .55 - subtitleTop, 20 * unit, primary, 500, 12 * unit);
  } else if (mode === 'web') {
    const sidebar = portrait ? 0 : width * .22;
    if (sidebar) {
      fill(context, secondary, 0, 0, sidebar, height);
      text(context, 'N / WORKSPACE', 32 * unit, 42 * unit, 21 * unit, ink, 700, sidebar - 60 * unit);
      ['工作概览', '项目列表', '团队成员', '归档记录'].forEach((label, index) => {
        if (!index) fill(context, primary, 22 * unit, 114 * unit, sidebar - 44 * unit, 52 * unit);
        text(context, label, 40 * unit, (130 + index * 77) * unit, 21 * unit, index ? ink : readableText(primary), index ? 400 : 600);
      });
    }
    const left = sidebar + pad;
    const innerWidth = width - left - pad;
    text(context, title, left, pad, Math.min(fontSize, 54) * unit, ink, 700, innerWidth);
    wrappedText(context, subtitle, left, pad + 75 * unit, innerWidth, 56 * unit, 20 * unit, ink, 400, 12 * unit);
    const baseline = portrait ? height * .29 : height * .3;
    text(context, '本周任务', left, baseline, 20 * unit, ink, 500);
    text(context, '12', left, baseline + 42 * unit, 63 * unit, primary, 700);
    text(context, '进行中 08    已完成 04', left + 140 * unit, baseline + 78 * unit, 18 * unit, ink, 400, innerWidth - 150 * unit);
    fill(context, secondary, left, baseline + 137 * unit, innerWidth, line);
    ['封面设计', '开发联调', '上线检查'].forEach((label, index) => {
      const y = baseline + (172 + index * 90) * unit;
      text(context, label, left, y, 23 * unit, ink, 500);
      const progressWidth = innerWidth * .4;
      fill(context, secondary, left + innerWidth * .55, y + 7 * unit, progressWidth, 13 * unit);
      fill(context, index === 2 ? detail : primary, left + innerWidth * .55, y + 7 * unit, progressWidth * [.85, .58, .3][index], 13 * unit);
    });
  } else {
    text(context, title, pad, pad, Math.min(fontSize, 58) * unit, ink, 700, contentWidth);
    wrappedText(context, subtitle, pad, pad + 83 * unit, contentWidth, 56 * unit, 20 * unit, ink, 400, 12 * unit);
    const left = pad + 54 * unit;
    const top = portrait ? height * .29 : height * .34;
    const bottom = height - pad - 66 * unit;
    const chartWidth = width - left - pad;
    const chartHeight = bottom - top;
    context.strokeStyle = secondary;
    context.lineWidth = line;
    [0, 25, 50, 75, 100].forEach((value) => {
      const y = bottom - chartHeight * value / 100;
      context.beginPath(); context.moveTo(left, y); context.lineTo(width - pad, y); context.stroke();
      text(context, String(value), pad, y - 11 * unit, 17 * unit, ink);
    });
    values.forEach((value, index) => {
      const barWidth = chartWidth / 7;
      const x = left + chartWidth / 4 * index + chartWidth / 16;
      const barHeight = chartHeight * value / 100;
      fill(context, [primary, secondary, detail, primary][index], x, bottom - barHeight, barWidth, barHeight);
      text(context, `${value}%`, x, bottom - barHeight - 30 * unit, 22 * unit, ink, 600);
      text(context, `Q${index + 1}`, x + barWidth * .25, bottom + 20 * unit, 20 * unit, ink);
    });
  }
  context.restore();
  return canvas;
}
