// 把 GitHub 风格的提示块转换成带样式的提示框：
//
//   > [!TIP] 可选标题
//   > 内容……
//
// 支持 NOTE / TIP / CHECK / WARNING / DANGER 五种类型。
// 标题就是标记后面的同一行，可以包含 `代码` 等行内格式；不写则使用默认标题。
const TYPES = {
  NOTE: '说明',
  TIP: '小技巧',
  CHECK: '检查点',
  WARNING: '注意',
  DANGER: '危险',
};

const MARKER = /^\[!(NOTE|TIP|CHECK|WARNING|DANGER)\][ \t]*/i;

function walk(node, fn) {
  fn(node);
  if (node.children) node.children.forEach((child) => walk(child, fn));
}

/** 把段落的第一行（直到第一个换行符）拆出来，返回标题节点和剩余节点。 */
function splitFirstLine(children) {
  const title = [];
  const rest = [...children];
  while (rest.length) {
    const node = rest.shift();
    if (node.type === 'break') break;
    if (node.type === 'text' && node.value.includes('\n')) {
      const i = node.value.indexOf('\n');
      if (i > 0) title.push({ type: 'text', value: node.value.slice(0, i) });
      const after = node.value.slice(i + 1);
      if (after) rest.unshift({ type: 'text', value: after });
      break;
    }
    title.push(node);
  }
  return { title, rest };
}

export function remarkCallout() {
  return (tree) => {
    walk(tree, (node) => {
      if (node.type !== 'blockquote') return;
      const first = node.children?.[0];
      const text = first?.type === 'paragraph' ? first.children?.[0] : null;
      if (!text || text.type !== 'text') return;

      const match = text.value.match(MARKER);
      if (!match) return;

      const type = match[1].toUpperCase();
      text.value = text.value.slice(match[0].length);
      if (!text.value) first.children.shift();

      const { title, rest } = splitFirstLine(first.children);
      const hasTitle = title.some((n) => n.type !== 'text' || n.value.trim());
      first.children = rest;
      if (rest.length === 0) node.children.shift();

      node.data = {
        hName: 'aside',
        hProperties: { className: ['callout', `callout-${type.toLowerCase()}`] },
      };
      node.children.unshift({
        type: 'paragraph',
        data: { hProperties: { className: ['callout-title'] } },
        children: hasTitle ? title : [{ type: 'text', value: TYPES[type] }],
      });
    });
  };
}
