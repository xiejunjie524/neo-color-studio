export function normalizeHex(value) {
  const clean = String(value).trim().replace(/^#/, '');
  if (/^[\da-f]{3}$/i.test(clean)) return '#' + [...clean].map((c) => c + c).join('').toUpperCase();
  if (/^[\da-f]{6}$/i.test(clean)) return '#' + clean.toUpperCase();
  return null;
}

export function hexToRgb(hex) {
  const normalized = normalizeHex(hex);
  if (!normalized) throw new Error('Invalid hexadecimal color');
  return [1, 3, 5].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16));
}

export function rgbToHex(rgb) {
  return '#' + rgb.map((value) => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function luminance(hex) {
  const linear = hexToRgb(hex).map((channel) => {
    const value = channel / 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  });
  return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
}

export function contrastRatio(a, b) {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + .05) / (Math.min(first, second) + .05);
}

export function readableText(background) {
  return contrastRatio(background, '#FFFFFF') >= contrastRatio(background, '#202124') ? '#FFFFFF' : '#202124';
}

export function contrastGrade(ratio, large = false) {
  if (ratio >= (large ? 4.5 : 7)) return 'AAA';
  if (ratio >= (large ? 3 : 4.5)) return 'AA';
  return '不通过';
}

export function cssPalette(colors) {
  return ':root {\n' + colors.map((color, index) => `  --color-${index + 1}: ${normalizeHex(color)};`).join('\n') + '\n}\n';
}
