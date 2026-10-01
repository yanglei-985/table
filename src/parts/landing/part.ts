// 落地部：首页（落地页）上的文案 —— 大标题、介绍、卖点、学习路线、常见问题、联系方式
import { z } from 'astro/zod';
import { definePart, href, line, link, text } from '../../core/part';

/** 首页上的区块；顺序和是否显示由落地部管理（教程列表的内容归教程部） */
export const sectionIds = ['hero', 'roadmap', 'tutorials', 'faq', 'contact'] as const;
export const sectionNames: Record<(typeof sectionIds)[number], string> = {
  hero: '首屏',
  roadmap: '学习路线',
  tutorials: '教程列表',
  faq: '常见问题',
  contact: '联系方式',
};

export const landingPart = definePart({
  id: 'landing',
  name: '落地部',
  duty: '首页的区块顺序与显示；大标题、介绍、按钮、卖点、学习路线、常见问题和联系方式',
  schema: z.object({
    sections: z
      .array(z.object({ id: z.enum(sectionIds), visible: z.boolean() }))
      .max(sectionIds.length)
      .refine((list) => new Set(list.map((s) => s.id)).size === list.length, '区块不能重复'),
    heroBadge: text(40),
    heroTitle: line(40),
    heroHighlight: text(40),
    description: text(300),
    heroButtons: z.array(link.extend({ style: z.enum(['primary', 'ghost']) })).max(4),
    heroPoints: z.array(line(30)).max(6),
    statLabels: z.array(text(20)).length(3),
    roadmapEyebrow: text(30),
    roadmapTitle: line(40),
    roadmapDesc: text(120),
    roadmap: z.array(z.object({ title: line(30), desc: text(200) })).max(8),
    faqEyebrow: text(30),
    faqTitle: line(40),
    faq: z.array(z.object({ q: line(80), a: text(600) })).max(30),
    contactTitle: line(40),
    contactDesc: text(200),
    contacts: z.array(z.object({ label: line(20), href })).max(8),
  }),
  defaults: {
    sections: sectionIds.map((id) => ({ id, visible: true })),
    heroBadge: '✦ 专为新朋友准备的上手教程',
    heroTitle: '把我踩过的坑',
    heroHighlight: '写成你能照着做的步骤',
    description:
      '一份给新朋友的上手教程合集：从准备环境到独立完成第一件事，每篇都按步骤写清楚，照着做就能跑通。',
    heroButtons: [
      { label: '从第一篇开始 →', href: '@first', style: 'primary' as const },
      { label: '浏览全部教程', href: '#tutorials', style: 'ghost' as const },
    ],
    heroPoints: ['步骤清晰，可直接复制', '每步都有检查点', '持续更新'],
    statLabels: ['篇教程', '个分类', '分钟学完全部'],
    roadmapEyebrow: 'ROADMAP',
    roadmapTitle: '三步上手，不迷路',
    roadmapDesc: '不知道从哪开始？按这个顺序走就对了。',
    roadmap: [
      { title: '读新手必读', desc: '花 5 分钟了解这个站怎么用、遇到问题去哪问。' },
      { title: '准备好环境', desc: '跟着「环境准备」把工具一次装好，后面教程都会用到。' },
      { title: '边学边动手', desc: '每篇教程都有可复制的命令和检查点，做完一步再看下一步。' },
    ],
    faqEyebrow: 'FAQ',
    faqTitle: '常见问题',
    faq: [
      {
        q: '我完全没有基础，能跟得上吗？',
        a: '可以。标记为「入门」的教程不需要任何前置知识，按学习路线从上往下看即可。',
      },
      {
        q: '照着做却报错了怎么办？',
        a: '先对照教程里的「检查点」确认上一步是否成功；还不行就把完整报错截图发给我，别只说「不行了」。',
      },
      { q: '教程会更新吗？', a: '会。每篇教程顶部都写了最后更新日期，工具版本变化时我会同步修改。' },
      { q: '怎么加入，和大家一起学？', a: '向管理员要一个邀请链接，打开后注册账号即可。' },
    ],
    contactTitle: '卡住了？直接来问我',
    contactDesc: '带上截图和你已经试过的步骤，我能更快帮你定位问题。',
    contacts: [
      { label: 'GitHub', href: 'https://github.com/yanglei-985' },
      { label: '邮箱', href: 'mailto:you@example.com' },
    ],
  },
});
