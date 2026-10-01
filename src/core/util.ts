// 公共底座 · 页面里常用的小工具

/** 站内链接 */
export function url(path = '') {
  return `/${path.replace(/^\//, '')}`;
}

export function categoryName(categories: { key: string; name: string }[], key: string) {
  return categories.find((c) => c.key === key)?.name ?? key;
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Shanghai',
  });
}

/** 安全地把数据嵌进 <script type="application/json">，防止内容里的 </script> 截断标签 */
export function safeJson(data: unknown) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
