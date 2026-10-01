// 编辑部 · 页面上的「就地编辑」
//
// 约定（各部的组件按这个约定写标记即可接入编辑）：
//   data-part="landing"          这一块归哪个部管，保存时只提交这个部
//   data-field="heroTitle"       可直接编辑的单个字段
//   data-list="faq"              可增删的列表；条目带 data-item，条目里的字段带 data-sub
//   data-sub="."                 条目本身就是一段文字（字符串列表）
//   data-remove / data-add-item  删除条目 / 添加条目；新条目从 <template data-template="..."> 复制
import { markDirty, partData, registerPage, setEditing, textOf, touchPart } from './edit-mode';

type PartId = Parameters<typeof partData>[0];

const owner = (el: Element) => el.closest<HTMLElement>('[data-part]')?.dataset.part as PartId | undefined;

export function enableInlineFields() {
  if (!document.getElementById('site-parts')) return; // 不是管理员

  registerPage({
    collect() {
      const set = (el: Element, key: string, value: unknown) => {
        const part = owner(el);
        if (!part) return;
        const data = partData(part);
        if (JSON.stringify(data[key]) === JSON.stringify(value)) return;
        data[key] = value;
        touchPart(part);
      };
      for (const el of document.querySelectorAll<HTMLElement>('[data-field]')) set(el, el.dataset.field!, textOf(el));
      for (const list of document.querySelectorAll<HTMLElement>('[data-list]')) {
        const items = Array.from(list.querySelectorAll<HTMLElement>('[data-item]'), (item) => {
          const subs = Array.from(item.querySelectorAll<HTMLElement>('[data-sub]'));
          if (subs.length === 1 && subs[0].dataset.sub === '.') return textOf(subs[0]);
          return Object.fromEntries(subs.map((el) => [el.dataset.sub, textOf(el)]));
        });
        set(list, list.dataset.list!, items);
      }
    },
  });

  document.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const remove = t.closest('[data-remove]');
    if (remove) {
      remove.closest('[data-item]')!.remove();
      markDirty();
      return;
    }
    const key = t.closest<HTMLElement>('[data-add-item]')?.dataset.addItem;
    if (!key) return;
    const template = document.querySelector<HTMLTemplateElement>(`template[data-template="${key}"]`)!;
    const list = document.querySelector<HTMLElement>(`[data-list="${key}"]`)!;
    // 新条目插在「添加」按钮所在的那一行前面
    let addRow = list.querySelector(`[data-add-item="${key}"]`)!;
    while (addRow.parentElement !== list) addRow = addRow.parentElement!;
    const item = template.content.firstElementChild!.cloneNode(true) as HTMLElement;
    list.insertBefore(item, addRow);
    setEditing(true);
    item.querySelector<HTMLElement>('[data-sub]')?.focus();
    markDirty();
  });
}
