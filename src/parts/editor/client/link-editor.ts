// 编辑部 · 链接 / 按钮编辑框：改文字、链接地址、按钮样式，或删除
import { markDirty, readData } from './edit-mode';

interface Targets {
  first: string | null;
  anchors: { label: string; href: string }[];
  tutorials: { label: string; href: string }[];
}

let targets: Targets | undefined;
let current: HTMLElement | null = null;
let isNewItem = false;

const dialog = () => document.getElementById('link-dialog') as HTMLDialogElement;
const field = <T extends HTMLElement>(name: string) => dialog().querySelector<T>(`[name="${name}"]`)!;

function fillTargets() {
  targets ??= readData<Targets>('link-targets');
  const select = field<HTMLSelectElement>('target');
  if (select.options.length > 0) return;
  const group = (label: string, items: { label: string; href: string }[]) => {
    const g = document.createElement('optgroup');
    g.label = label;
    for (const i of items) g.append(new Option(i.label, i.href));
    select.append(g);
  };
  group('本站', targets.anchors);
  if (targets.tutorials.length) group('某篇教程', targets.tutorials);
  select.append(new Option('自定义网址…', '__custom'));
}

function syncCustom() {
  const custom = field<HTMLSelectElement>('target').value === '__custom';
  dialog().querySelector<HTMLElement>('.ld-custom')!.hidden = !custom;
}

export function openLinkEditor(item: HTMLElement, { isNew = false } = {}) {
  current = item;
  isNewItem = isNew;
  fillTargets();
  const label = item.querySelector<HTMLElement>('[data-sub="label"]')?.textContent?.trim() ?? '';
  const href = item.dataset.vHref ?? '';
  field<HTMLInputElement>('label').value = label;
  const select = field<HTMLSelectElement>('target');
  const known = Array.from(select.options).some((o) => o.value === href);
  select.value = known ? href : '__custom';
  field<HTMLInputElement>('custom').value = known ? '' : href;
  syncCustom();

  const hasStyle = item.dataset.vStyle !== undefined;
  dialog().querySelector<HTMLElement>('.ld-style')!.hidden = !hasStyle;
  if (hasStyle) field<HTMLSelectElement>('style').value = item.dataset.vStyle!;
  dialog().querySelector<HTMLElement>('.ld-error')!.textContent = '';
  dialog().showModal();
  field<HTMLInputElement>('label').select();
}

function resolve(href: string) {
  if (href === '@first') return targets?.first ?? '#tutorials';
  if (href.startsWith('#') && location.pathname !== '/') return `/${href}`;
  return href;
}

export function setupLinkEditor() {
  const d = dialog();
  if (!d) return;
  field<HTMLSelectElement>('target').addEventListener('change', syncCustom);

  d.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t === d || t.closest('[data-ld-cancel]')) {
      // 新加的按钮没确认就取消，等于不加
      if (isNewItem) current?.remove();
      d.close();
    }
    if (t.closest('[data-ld-delete]') && current) {
      current.remove();
      markDirty();
      d.close();
    }
  });

  d.querySelector('form')!.addEventListener('submit', (e) => {
    if (!current) return;
    const error = d.querySelector('.ld-error')!;
    const label = field<HTMLInputElement>('label').value.trim();
    const target = field<HTMLSelectElement>('target').value;
    const href = target === '__custom' ? field<HTMLInputElement>('custom').value.trim() : target;
    if (!label) {
      e.preventDefault();
      error.textContent = '请填写文字';
      return;
    }
    if (!/^(https?:\/\/.+|mailto:.+|tel:.+|\/(?!\/).*|#.+|@first)$/.test(href)) {
      e.preventDefault();
      error.textContent = '链接需以 https://、mailto:、tel:、/ 或 # 开头';
      return;
    }
    current.querySelector<HTMLElement>('[data-sub="label"]')!.textContent = label;
    current.dataset.vHref = href;
    current.setAttribute('href', resolve(href));
    if (current.dataset.vStyle !== undefined) {
      const style = field<HTMLSelectElement>('style').value;
      current.dataset.vStyle = style;
      current.classList.toggle('btn-primary', style === 'primary');
      current.classList.toggle('btn-ghost', style === 'ghost');
    }
    isNewItem = false;
    markDirty();
  });
}
