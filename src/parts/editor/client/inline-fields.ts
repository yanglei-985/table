// 编辑部 · 页面上的「就地编辑」
//
// 约定（各部的组件按这个约定写标记即可接入编辑）：
//   data-part="landing"          这一块归哪个部管，保存时只提交这个部
//   data-field="heroTitle"       可直接编辑的单个字段（同一个字段出现在多处时，改哪处都行）
//   data-list="faq"              可增删的列表；条目带 data-item，条目里的字段带 data-sub
//   data-sub="."                 条目本身就是一段文字（字符串列表）
//   data-v-href / data-v-style   条目上的附加值（如链接地址、按钮样式），由链接编辑框修改
//   data-remove / data-add-item  删除条目 / 添加条目；新条目从 <template data-template="..."> 复制
//   data-open-link               添加后立刻打开链接编辑框
//
// 页面加载时给每个字段和列表拍一张「快照」，保存时只提交和快照不同的部分，
// 所以「站点设置」对话框里改的内容不会被页面上没动过的同名字段覆盖。
import { markDirty, partData, registerPage, setEditing, textOf, touchPart } from './edit-mode';
import { openLinkEditor } from './link-editor';

type PartId = Parameters<typeof partData>[0];

const owner = (el: Element) => el.closest<HTMLElement>('[data-part]')?.dataset.part as PartId | undefined;

/** 读出一个列表条目的值：字段文字 + data-v-* 附加值 */
function readItem(item: HTMLElement) {
  const subs = Array.from(item.querySelectorAll<HTMLElement>('[data-sub]'));
  const extras = Object.entries(item.dataset)
    .filter(([k, v]) => /^v[A-Z]/.test(k) && v !== undefined && v !== '')
    .map(([k, v]) => [k[1].toLowerCase() + k.slice(2), v]);
  if (subs.length === 1 && subs[0].dataset.sub === '.' && extras.length === 0) return textOf(subs[0]);
  return Object.fromEntries([...subs.map((el) => [el.dataset.sub, textOf(el)]), ...extras]);
}

const readList = (list: HTMLElement) => Array.from(list.querySelectorAll<HTMLElement>('[data-item]'), readItem);

export function enableInlineFields() {
  if (!document.getElementById('site-parts')) return; // 不是管理员

  // ---- 快照
  const fieldOriginal = new Map<HTMLElement, string>();
  for (const el of document.querySelectorAll<HTMLElement>('[data-field]')) fieldOriginal.set(el, textOf(el));
  const listOriginal = new Map<HTMLElement, string>();
  for (const list of document.querySelectorAll<HTMLElement>('[data-list]'))
    listOriginal.set(list, JSON.stringify(readList(list)));

  registerPage({
    collect() {
      for (const [el, before] of fieldOriginal) {
        const part = owner(el);
        const now = textOf(el);
        if (!part || now === before) continue;
        partData(part)[el.dataset.field!] = now;
        touchPart(part);
      }
      for (const [list, before] of listOriginal) {
        const part = owner(list);
        const now = readList(list);
        if (!part || JSON.stringify(now) === before) continue;
        partData(part)[list.dataset.list!] = now;
        touchPart(part);
      }
    },
  });

  document.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;

    const gear = t.closest<HTMLElement>('[data-link-edit]');
    if (gear) {
      e.preventDefault();
      openLinkEditor(gear.closest<HTMLElement>('[data-item]')!);
      return;
    }

    const remove = t.closest('[data-remove]');
    if (remove) {
      remove.closest('[data-item]')!.remove();
      markDirty();
      return;
    }

    const addBtn = t.closest<HTMLElement>('[data-add-item]');
    if (!addBtn) return;
    const key = addBtn.dataset.addItem!;
    const template = document.querySelector<HTMLTemplateElement>(`template[data-template="${key}"]`)!;
    const list = addBtn.closest<HTMLElement>(`[data-list="${key}"]`) ?? document.querySelector<HTMLElement>(`[data-list="${key}"]`)!;
    // 新条目插在「添加」按钮所在的那一行前面
    let addRow: Element = addBtn;
    while (addRow.parentElement !== list) addRow = addRow.parentElement!;
    const item = template.content.firstElementChild!.cloneNode(true) as HTMLElement;
    list.insertBefore(item, addRow);
    setEditing(true);
    markDirty();
    if (addBtn.hasAttribute('data-open-link')) openLinkEditor(item, { isNew: true });
    else item.querySelector<HTMLElement>('[data-sub]')?.focus();
  });
}
