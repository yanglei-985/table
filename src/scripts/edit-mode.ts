// 编辑模式（仅管理员）：工具栏和各页面共用的浏览器端逻辑
//
// 页面通过 registerPage() 接入；工具栏负责开关、保存、放弃和未保存提醒。
// 进入编辑模式时 <html> 上会加 .editing，页面里所有可编辑元素（EDITABLE）变为可直接编辑。

export interface EditablePage {
  /** 把页面上改过的站点文案写进 siteSettings()（不发请求） */
  collect?(): void;
  /** 在站点文案保存之后提交页面自己的数据（如教程）；可返回保存后要跳转的网址 */
  commit?(): Promise<string | void>;
}

import { api } from './api';

export { api };

const KEY = 'edit-mode';
/** 可直接编辑的元素：站点文案字段、教程标题等、列表条目里的字段 */
const EDITABLE = '[data-field], [data-edit], [data-sub]';
let page: EditablePage | null = null;
let dirty = false;
const listeners = new Set<(on: boolean) => void>();

export function registerPage(p: EditablePage) {
  page = p;
}

export function isEditing() {
  return document.documentElement.classList.contains('editing');
}

export function markDirty() {
  dirty = true;
  document.documentElement.classList.add('edit-dirty');
}

export function onToggle(fn: (on: boolean) => void) {
  listeners.add(fn);
}

export function setEditing(on: boolean) {
  document.documentElement.classList.toggle('editing', on);
  try {
    if (on) sessionStorage.setItem(KEY, '1');
    else sessionStorage.removeItem(KEY);
  } catch {
    // 浏览器禁止存储时，编辑模式只在当前页面有效
  }
  for (const el of document.querySelectorAll<HTMLElement>(EDITABLE)) {
    if (on) {
      el.setAttribute('contenteditable', 'plaintext-only');
      // 旧浏览器不支持 plaintext-only 时退回普通可编辑
      if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true';
      el.spellcheck = false;
    } else {
      el.removeAttribute('contenteditable');
    }
  }
  for (const fn of listeners) fn(on);
}

export function wantsEditing() {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

let settings: any;
let settingsTouched = false;

/** 当前站点文案（来自页面嵌入的 #site-settings），修改后调用 touchSettings() */
export function siteSettings(): any {
  settings ??= readData('site-settings');
  return settings;
}

export function touchSettings() {
  settingsTouched = true;
  markDirty();
}

// 先存站点文案（例如新加的分类），再存教程，教程才能用上新分类
export async function save() {
  page?.collect?.();
  if (settingsTouched) {
    await api('PUT', '/api/settings', siteSettings());
    settingsTouched = false;
  }
  const next = await page?.commit?.();
  dirty = false;
  if (next) location.href = next;
  else location.reload();
}

export function discard() {
  if (dirty && !confirm('放弃所有未保存的修改？')) return;
  dirty = false;
  location.reload();
}

/** 已经用别的方式处理了修改（如删除了教程），离开页面不再提醒 */
export function clearDirty() {
  dirty = false;
}

export function hasUnsavedChanges() {
  return dirty;
}

/** 读取可编辑元素的纯文本（去掉首尾空白，合并多余换行） */
export function textOf(el: Element | null) {
  return (el?.textContent ?? '').replace(/ /g, ' ').trim();
}

/** 读取页面里嵌入的 JSON 数据 */
export function readData<T>(id: string): T {
  return JSON.parse(document.getElementById(id)!.textContent!);
}

// 输入即标记为未保存；粘贴时只保留纯文本
document.addEventListener('input', (e) => {
  if (isEditing() && (e.target as HTMLElement).closest(`${EDITABLE}, .edit-only`)) markDirty();
});
document.addEventListener('paste', (e) => {
  const el = (e.target as HTMLElement).closest?.('[contenteditable="true"]');
  if (!el) return;
  e.preventDefault();
  document.execCommand('insertText', false, e.clipboardData?.getData('text/plain') ?? '');
});
// 单行字段按回车不换行
document.addEventListener('keydown', (e) => {
  const el = (e.target as HTMLElement).closest?.(
    '[data-field]:not([data-multiline]), [data-edit]:not([data-multiline]), [data-sub]:not([data-multiline])',
  );
  if (el && isEditing() && e.key === 'Enter') e.preventDefault();
});
addEventListener('beforeunload', (e) => {
  if (dirty) e.preventDefault();
});
