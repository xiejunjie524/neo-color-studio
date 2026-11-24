import { normalizeHex, contrastRatio } from './color.js';

export const categories = {
  cover: '封面海报',
  subtitle: '视频字幕',
  web: '网页界面',
  chart: '图表数据',
};

export const roleNames = ['背景', '文字', '主色', '辅色', '点缀'];

export const defaultCopy = {
  cover: { title: '城市观察', subtitle: '镜头里的日常 / WEEKEND JOURNAL' },
  subtitle: { title: '把今天的故事，留在镜头里。', subtitle: 'A moment worth keeping.' },
  web: { title: '项目概览', subtitle: '本周进度 / WORKSPACE' },
  chart: { title: '季度完成率', subtitle: '2026 / QUARTERLY REPORT' },
};

const definitions = [
  ['red-editorial', '醒目红白', 'cover', ['#F8F8F6', '#202124', '#D84036', '#275BB0', '#F2C449'], '清晰 · 编辑感', 'city'],
  ['electric-blue', '蓝黄碰撞', 'cover', ['#1656BD', '#FFFFFF', '#F5D748', '#F07864', '#D6E6F9'], '鲜明 · 数码', 'city'],
  ['garden-letter', '花园来信', 'cover', ['#EDF4E9', '#203C2A', '#B94263', '#E8B749', '#78966D'], '自然 · 生活', 'garden'],
  ['pink-poster', '粉墨画报', 'cover', ['#F7D8E3', '#29202B', '#AC245A', '#306C69', '#D29B32'], '柔和 · 人文', 'garden'],
  ['night-coral', '夜色珊瑚', 'cover', ['#232326', '#FAFAF8', '#FF8B77', '#80C5BD', '#E8BC5B'], '克制 · 影像', 'mountain'],
  ['ocean-orange', '海岸橙蓝', 'cover', ['#F0F6F8', '#163C50', '#C74B2D', '#2786A2', '#E4C35D'], '明亮 · 旅行', 'coast'],
  ['caption-classic', '经典白字幕', 'subtitle', ['#171717', '#FFFFFF', '#FFD866', '#3E3E42', '#A7D9E2'], '黑底 · 白字', 'city'],
  ['caption-lemon', '柠檬重点', 'subtitle', ['#20211B', '#F8F5E9', '#F4D950', '#8BB79D', '#CD8C54'], '暖白 · 黄色重点', 'mountain'],
  ['caption-mint', '薄荷对白', 'subtitle', ['#162D2B', '#F2FCF8', '#8DE5CA', '#F0BD7B', '#8CB8CE'], '深绿 · 薄荷', 'garden'],
  ['caption-coral', '珊瑚口播', 'subtitle', ['#322427', '#FFF8F5', '#FFAA96', '#C7B9D6', '#F1D18C'], '暖黑 · 珊瑚', 'city'],
  ['caption-ice', '冰蓝纪录', 'subtitle', ['#183344', '#F1F8FC', '#9AD8F0', '#EAC779', '#BCDAC1'], '深蓝 · 冰蓝', 'coast'],
  ['caption-magenta', '玫红节拍', 'subtitle', ['#29212B', '#FFF9FC', '#F8A3C9', '#B2D7E7', '#F1D95C'], '冷黑 · 玫红', 'city'],
  ['web-blue', '蓝色工作台', 'web', ['#F8FAFC', '#202C3C', '#245CC4', '#DFE8F6', '#BC493B'], '信息密集 · 清晰', 'city'],
  ['web-forest', '森林事务所', 'web', ['#F5F9F6', '#213D2D', '#28744C', '#DBEAE0', '#BD543E'], '自然 · 稳定', 'garden'],
  ['web-crimson', '朱红档案', 'web', ['#FBF8F7', '#352926', '#B53F36', '#F0DEDA', '#286E88'], '编辑 · 文档', 'city'],
  ['web-teal', '青绿清单', 'web', ['#F3F9F9', '#193A40', '#0D747C', '#D4E9E9', '#AA4C75'], '冷静 · 效率', 'coast'],
  ['web-plum', '梅色书房', 'web', ['#FBF8FB', '#382B3B', '#85416D', '#ECDCE8', '#3F7770'], '内容 · 阅读', 'garden'],
  ['web-carbon', '碳灰项目', 'web', ['#242527', '#F4F5F7', '#87BDFF', '#41454C', '#F0B267'], '深色 · 项目', 'city'],
  ['chart-color', '清晰分类', 'chart', ['#FFFFFF', '#253044', '#2867B2', '#C25338', '#26846C'], '蓝 · 橙 · 绿', 'city'],
  ['chart-civic', '公共数据', 'chart', ['#F7FAFB', '#283A46', '#087A8D', '#AF5385', '#B68A25'], '青 · 玫 · 金', 'city'],
  ['chart-field', '田野报告', 'chart', ['#F8FAF5', '#33412C', '#50813C', '#B76A38', '#578BA2'], '绿 · 棕 · 蓝', 'mountain'],
  ['chart-signal', '信号对比', 'chart', ['#FFFFFF', '#312C35', '#93495F', '#267F89', '#A48325'], '莓 · 青 · 黄', 'city'],
  ['chart-bright', '明亮趋势', 'chart', ['#FAFAFA', '#242A33', '#3561AC', '#A04E83', '#178375'], '蓝 · 品红 · 绿', 'coast'],
  ['chart-night', '夜间看板', 'chart', ['#23262A', '#F5F7FA', '#80BBEF', '#F0A584', '#92CBAD'], '深色 · 高辨识', 'city'],
];

const groups = Object.keys(categories).map((category) => definitions.filter((row) => row[2] === category));
const ordered = groups[0].flatMap((_, index) => groups.map((group) => group[index]));
export const schemes = ordered.map(([id, name, category, colors, tags, photo]) => ({
  id, name, category, colors, tags, photo,
}));

export function filterSchemes({ category = 'all', tone = 'all', query = '' } = {}) {
  const search = query.trim().toLocaleLowerCase();
  return schemes.filter((scheme) => {
    const dark = contrastRatio(scheme.colors[0], '#FFFFFF') > contrastRatio(scheme.colors[0], '#202124');
    return (category === 'all' || scheme.category === category)
      && (tone === 'all' || (tone === 'dark') === dark)
      && (!search || `${scheme.name} ${scheme.tags} ${categories[scheme.category]}`.toLocaleLowerCase().includes(search));
  });
}

export function validateScheme(scheme) {
  return !!scheme && typeof scheme.name === 'string' && scheme.colors?.length === 5
    && scheme.colors.every((color) => normalizeHex(color))
    && Object.hasOwn(categories, scheme.category);
}
