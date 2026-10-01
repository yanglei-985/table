// 成员部：账号、登录、邀请与成员管理（auth.mjs、invites.mjs），可编辑的只有邀请文案
import { z } from 'astro/zod';
import { definePart, text } from '../../core/part';

export const accountsPart = definePart({
  id: 'accounts',
  name: '成员部',
  duty: '账号与登录、邀请链接和二维码、成员管理；邀请文案',
  schema: z.object({
    // {name} 会替换成站名，{link} 替换成邀请链接
    inviteMessage: text(300),
  }),
  defaults: {
    inviteMessage: '我在「{name}」整理了一套上手教程，照着做就能入门。用这个链接注册加入：{link}',
  },
});
