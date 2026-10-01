// 网站由以下几个部组成。每个部的代码在 src/parts/<id>/，配置在数据库里各占一行。
import { designPart } from './design/part';
import { landingPart } from './landing/part';
import { tutorialsPart } from './tutorials/part';
import { accountsPart } from './accounts/part';
import { loadPart, type Part } from '../core/part';

/** 有可编辑配置的部；顺序也是保存顺序（先存分类，教程才能用上新分类） */
export const parts = {
  design: designPart,
  landing: landingPart,
  tutorials: tutorialsPart,
  accounts: accountsPart,
} satisfies Record<string, Part>;

export type PartId = keyof typeof parts;

/** 只负责编辑操作、没有自己配置的部 */
export const editorDepartment = {
  id: 'editor',
  name: '编辑部',
  duty: '管理员的编辑模式工具栏和「站点设置」对话框；把修改交给对应的部保存',
};

export const design = () => loadPart(designPart);
export const landing = () => loadPart(landingPart);
export const tutorialsConfig = () => loadPart(tutorialsPart);
export const accounts = () => loadPart(accountsPart);

/** 所有部的当前配置（嵌入管理员页面，供编辑模式使用） */
export function allParts() {
  return { design: design(), landing: landing(), tutorials: tutorialsConfig(), accounts: accounts() };
}
