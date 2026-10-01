// ============================================================
// 站点初始内容：只在第一次启动、数据库还是空的时候写入数据库。
// 之后请直接在网站上用管理员账号打开「编辑模式」修改。
// ============================================================

export const defaultSettings = {
  name: '新手上手站',
  logo: '上手',
  author: '你的名字',
  tagline: '把我踩过的坑，写成你能照着做的步骤',
  heroBadge: '✦ 专为新朋友准备的上手教程',
  heroTitle: '把我踩过的坑',
  heroHighlight: '写成你能照着做的步骤',
  description:
    '一份给新朋友的上手教程合集：从准备环境到独立完成第一件事，每篇都按步骤写清楚，照着做就能跑通。',
  heroPoints: ['步骤清晰，可直接复制', '每步都有检查点', '持续更新'],
  roadmapTitle: '三步上手，不迷路',
  roadmapDesc: '不知道从哪开始？按这个顺序走就对了。',
  roadmap: [
    { title: '读新手必读', desc: '花 5 分钟了解这个站怎么用、遇到问题去哪问。' },
    { title: '准备好环境', desc: '跟着「环境准备」把工具一次装好，后面教程都会用到。' },
    { title: '边学边动手', desc: '每篇教程都有可复制的命令和检查点，做完一步再看下一步。' },
  ],
  tutorialsTitle: '全部教程',
  tutorialsDesc: '按分类筛选，或直接搜索你想学的内容。',
  // 教程分类：key 是英文标识，教程用它归类
  categories: [
    { key: 'start', name: '新手必读', desc: '第一次来先看这里' },
    { key: 'env', name: '环境准备', desc: '装好工具，少走弯路' },
    { key: 'skills', name: '核心技能', desc: '日常最常用的操作' },
    { key: 'guide', name: '写作指南', desc: '给分享者：如何写一篇教程' },
  ],
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
    {
      q: '怎么加入，和大家一起学？',
      a: '向管理员要一个邀请链接，打开后注册账号即可。',
    },
  ],
  contactTitle: '卡住了？直接来问我',
  contactDesc: '带上截图和你已经试过的步骤，我能更快帮你定位问题。',
  contacts: [
    { label: 'GitHub', href: 'https://github.com/yanglei-985' },
    { label: '邮箱', href: 'mailto:you@example.com' },
  ],
  footerNote: '欢迎转发给需要的朋友',
  // 管理员生成邀请链接时，复制出去的那段话；{name} 会替换成站名，{link} 替换成链接
  inviteMessage: '我在「{name}」整理了一套上手教程，照着做就能入门。用这个链接注册加入：{link}',
};

export type Settings = typeof defaultSettings;

// 主题：key 对应 global.css 里的 [data-theme='key']；colors 只用于切换按钮上的色块
export const themes = [
  { key: 'night', name: '星夜', bg: '#06070d', colors: ['#6d5efc', '#22d3ee'] },
  { key: 'paper', name: '宣纸', bg: '#f5efe3', colors: ['#b33a2a', '#c8892c'] },
  { key: 'celadon', name: '青瓷', bg: '#edf3f1', colors: ['#227a6c', '#2f6fa3'] },
] as const;

// 访客第一次打开时使用的主题
export const defaultTheme: (typeof themes)[number]['key'] = 'night';

export const levels = ['入门', '进阶', '高级'] as const;
