// 设计部：网站的外观与品牌 —— 站名、图标、作者、页脚，以及主题配色和字体（styles/global.css）
import { z } from 'astro/zod';
import { definePart, line, text } from '../../core/part';

export const designPart = definePart({
  id: 'design',
  name: '设计部',
  duty: '站名、图标文字、作者、页脚和浏览器标题；三套主题配色与宋体字体',
  schema: z.object({
    name: line(30),
    logo: line(6),
    author: line(30),
    tagline: text(80),
    footerNote: text(80),
  }),
  defaults: {
    name: '新手上手站',
    logo: '上手',
    author: '你的名字',
    tagline: '把我踩过的坑，写成你能照着做的步骤',
    footerNote: '欢迎转发给需要的朋友',
  },
});

// 主题：key 对应 styles/global.css 里的 [data-theme='key']；colors 只用于切换按钮上的色块
export const themes = [
  { key: 'night', name: '星夜', bg: '#06070d', colors: ['#6d5efc', '#22d3ee'] },
  { key: 'paper', name: '宣纸', bg: '#f5efe3', colors: ['#b33a2a', '#c8892c'] },
  { key: 'celadon', name: '青瓷', bg: '#edf3f1', colors: ['#227a6c', '#2f6fa3'] },
] as const;

// 访客第一次打开时使用的主题
export const defaultTheme: (typeof themes)[number]['key'] = 'night';
