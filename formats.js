export const projectFormats = {
  wide: { label: '横版 16:9', width: 1920, height: 1080 },
  vertical: { label: '竖屏 9:16', width: 1080, height: 1920 },
  portrait: { label: '竖版 3:4', width: 1080, height: 1440 },
  square: { label: '方形 1:1', width: 1080, height: 1080 },
  social: { label: '竖版 4:5', width: 1080, height: 1350 },
  poster: { label: '海报 2:3', width: 1080, height: 1620 },
  photo: { label: '横版 3:2', width: 1800, height: 1200 },
  classic: { label: '横版 4:3', width: 1600, height: 1200 },
  cinema: { label: '宽屏 2.35:1', width: 1880, height: 800 },
  banner: { label: '头图 5:2', width: 2000, height: 800 },
};

export function dimensionError(width, height) {
  if (![width, height].every((value) => Number.isInteger(value) && value >= 256 && value <= 4096)) {
    return '宽高需为 256 到 4096 之间的整数像素';
  }
  if (width / height < .25 || width / height > 4) return '画幅比例需在 1:4 到 4:1 之间';
  return '';
}

export function projectDimensions(format, customSize) {
  if (format === 'custom' && customSize && !dimensionError(customSize.width, customSize.height)) return customSize;
  return Object.hasOwn(projectFormats, format) ? projectFormats[format] : projectFormats.wide;
}
