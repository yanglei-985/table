// 接口测试：用临时数据库启动真实服务，逐项验证账号、邀请、权限和编辑接口。
// 运行前需要先 npm run build。
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 4500 + Math.floor(Math.random() * 400);
const BASE = `http://127.0.0.1:${PORT}`;
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tutorial-site-'));
const ADMIN = { username: 'admin_test', password: 'admin-pass-123' };
let server;

before(async () => {
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'dist/server/entry.mjs'], {
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(PORT),
      DATA_DIR,
      ADMIN_USERNAME: ADMIN.username,
      ADMIN_PASSWORD: ADMIN.password,
    },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(BASE);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error('服务没有启动');
});

after(() => {
  server?.kill();
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
});

/** 带 Cookie 的简易客户端 */
function client() {
  let cookie = '';
  async function call(method, url, body, headers = {}) {
    const res = await fetch(BASE + url, {
      method,
      redirect: 'manual',
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(cookie ? { cookie } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.getSetCookie();
    for (const c of set) {
      const [pair] = c.split(';');
      cookie = pair.endsWith('=') || c.includes('Max-Age=0') || c.includes('Expires=Thu, 01 Jan 1970') ? '' : pair;
    }
    const type = res.headers.get('content-type') ?? '';
    const data = type.includes('json') ? await res.json() : await res.text();
    return { status: res.status, data, res };
  }
  return {
    get: (url) => call('GET', url),
    post: (url, body = {}, headers) => call('POST', url, body, headers),
    put: (url, body = {}, headers) => call('PUT', url, body, headers),
    patch: (url, body = {}) => call('PATCH', url, body),
    del: (url) => call('DELETE', url, {}),
    raw: call,
  };
}

const admin = client();
const member = client();
const guest = client();
let settings;
let inviteCode;

test('访客可以浏览首页和教程，示例教程已导入', async () => {
  const home = await guest.get('/');
  assert.equal(home.status, 200);
  assert.match(home.data, /新手上手站/);
  assert.match(home.data, /Git 入门/);
  assert.doesNotMatch(home.data, /site-settings/, '访客页面不应包含编辑数据');
  const t = await guest.get('/tutorials/git-first-commit/');
  assert.equal(t.status, 200);
  assert.match(t.data, /callout-check/);
});

test('未登录不能修改内容', async () => {
  assert.equal((await guest.put('/api/settings', {})).status, 401);
  assert.equal((await guest.post('/api/tutorials')).status, 401);
  assert.equal((await guest.post('/api/invites')).status, 401);
  assert.equal((await guest.get('/account')).status, 302);
});

test('管理员由环境变量自动创建，密码错误无法登录', async () => {
  assert.equal((await admin.post('/api/auth/login', { username: ADMIN.username, password: 'wrong-password' })).status, 401);
  const ok = await admin.post('/api/auth/login', ADMIN);
  assert.equal(ok.status, 200);
  assert.equal(ok.data.user.role, 'admin');
  const cookie = ok.res.headers.getSetCookie()[0];
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
});

test('拒绝跨站和非 JSON 的写请求', async () => {
  assert.equal((await admin.raw('PUT', '/api/settings', undefined, { 'content-type': 'text/plain' })).status, 415);
  assert.equal((await admin.put('/api/settings', {}, { origin: 'https://evil.example' })).status, 403);
  assert.equal((await admin.put('/api/settings', {}, { origin: 'null' })).status, 403);
});

test('登录后只跳回本站页面', async () => {
  const page = (next) => guest.get(`/login?next=${encodeURIComponent(next)}`).then((r) => r.data.match(/data-next="([^"]*)"/)[1]);
  assert.equal(await page('/tutorials/start-here/'), '/tutorials/start-here/');
  assert.equal(await page('//evil.example'), '/');
  assert.equal(await page('/\\evil.example'), '/');
  assert.equal(await page('https://evil.example'), '/');
});

test('管理员页面带有编辑工具栏和当前文案', async () => {
  const home = await admin.get('/');
  const match = home.data.match(/<script type="application\/json" id="site-settings">([\s\S]*?)<\/script>/);
  assert.ok(match, '管理员应看到编辑数据');
  settings = JSON.parse(match[1]);
  assert.match(home.data, /编辑模式/);
});

test('管理员修改首页文案后立即生效', async () => {
  const res = await admin.put('/api/settings', { ...settings, heroTitle: '测试标题 <b>不转义</b>' });
  assert.equal(res.status, 200);
  const home = await guest.get('/');
  assert.match(home.data, /测试标题 &lt;b&gt;不转义&lt;\/b&gt;/, '文案应被安全转义');
  settings = res.data.settings;
});

test('文案校验：空标题和非法链接会被拒绝', async () => {
  assert.equal((await admin.put('/api/settings', { ...settings, heroTitle: '  ' })).status, 400);
  const bad = await admin.put('/api/settings', { ...settings, contacts: [{ label: 'x', href: 'javascript:alert(1)' }] });
  assert.equal(bad.status, 400);
  assert.match(bad.data.error, /https/);
});

test('不能删除仍有教程在用的分类', async () => {
  const res = await admin.put('/api/settings', { ...settings, categories: settings.categories.filter((c) => c.key !== 'skills') });
  assert.equal(res.status, 400);
  assert.match(res.data.error, /Git 入门/);
});

test('管理员生成邀请链接，邀请页可以打开', async () => {
  const res = await admin.post('/api/invites', { note: '测试邀请', maxUses: 1, expiresInDays: 7 });
  assert.equal(res.status, 201);
  inviteCode = res.data.invite.code;
  assert.match(inviteCode, /^[A-Z2-9]{10}$/);
  const page = await guest.get(`/join/${inviteCode}`);
  assert.match(page.data, /注册并登录/);
  const account = await admin.get('/account');
  assert.match(account.data, new RegExp(`/join/${inviteCode}`));
  assert.match(account.data, /<svg/, '应显示二维码');
});

test('凭邀请注册成为普通成员', async () => {
  const weak = await member.post('/api/auth/register', { code: inviteCode, username: 'newbie', displayName: '新人', password: '123' });
  assert.equal(weak.status, 400);
  const res = await member.post('/api/auth/register', {
    code: inviteCode,
    username: 'newbie',
    displayName: '新人小王',
    password: 'member-pass-123',
  });
  assert.equal(res.status, 201);
  assert.equal(res.data.user.role, 'member');
  const account = await member.get('/account');
  assert.equal(account.status, 200);
  assert.match(account.data, /新人小王/);
  assert.doesNotMatch(account.data, /邀请成员/);
});

test('邀请次数用完后失效，用户名不能重复', async () => {
  const other = client();
  const res = await other.post('/api/auth/register', { code: inviteCode, username: 'second', displayName: '二号', password: 'second-pass-123' });
  assert.equal(res.status, 400);
  assert.match(res.data.error, /失效/);
  assert.match((await other.get(`/join/${inviteCode}`)).data, /已用完/);

  const fresh = await admin.post('/api/invites', { maxUses: null, expiresInDays: null });
  const dup = await other.post('/api/auth/register', { code: fresh.data.invite.code, username: 'NEWBIE', displayName: '重名', password: 'dup-pass-1234' });
  assert.equal(dup.status, 400);
  assert.match(dup.data.error, /已被使用/);
  assert.equal((await admin.del(`/api/invites/${fresh.data.invite.code}`)).status, 200);
  assert.match((await other.get(`/join/${fresh.data.invite.code}`)).data, /已撤销/);
});

test('普通成员看不到编辑工具栏，也不能调用编辑接口', async () => {
  const home = await member.get('/');
  assert.doesNotMatch(home.data, /site-settings/);
  assert.equal((await member.put('/api/settings', settings)).status, 403);
  assert.equal((await member.post('/api/tutorials')).status, 403);
  assert.equal((await member.put('/api/tutorials/git-first-commit', {})).status, 403);
  assert.equal((await member.del('/api/tutorials/git-first-commit')).status, 403);
  assert.equal((await member.post('/api/preview', { body: '# x' })).status, 403);
  assert.equal((await member.post('/api/invites')).status, 403);
});

test('新建教程默认是草稿，只有管理员能看到；发布并改网址后访客可见', async () => {
  const created = await admin.post('/api/tutorials');
  assert.equal(created.status, 201);
  const slug = created.data.slug;
  assert.equal((await guest.get(`/tutorials/${slug}/`)).status, 404);
  assert.equal((await admin.get(`/tutorials/${slug}/`)).status, 200);
  assert.doesNotMatch((await guest.get('/')).data, /未命名教程/);

  const preview = await admin.post('/api/preview', { body: '> [!TIP]\n> 预览' });
  assert.match(preview.data.html, /callout-tip/);

  const updated = await admin.put(`/api/tutorials/${slug}`, {
    slug: 'my-first-lesson',
    title: '我的第一课',
    description: '测试教程',
    category: 'skills',
    level: '进阶',
    duration: 12,
    order: 5,
    featured: false,
    draft: false,
    tags: ['测试'],
    body: '## 第一步\n\n1. 打开电脑\n',
  });
  assert.equal(updated.status, 200, JSON.stringify(updated.data));
  assert.equal((await guest.get(`/tutorials/${slug}/`)).status, 404);
  const page = await guest.get('/tutorials/my-first-lesson/');
  assert.equal(page.status, 200);
  assert.match(page.data, /我的第一课/);
  assert.match(page.data, /id="第一步"/);
  assert.match((await guest.get('/')).data, /我的第一课/);

  const clash = await admin.put('/api/tutorials/my-first-lesson', { ...updated.data.tutorial, slug: 'git-first-commit' });
  assert.equal(clash.status, 400);

  assert.equal((await admin.del('/api/tutorials/my-first-lesson')).status, 200);
  assert.equal((await guest.get('/tutorials/my-first-lesson/')).status, 404);
});

test('管理员停用成员后，对方立即失去登录状态', async () => {
  const account = await admin.get('/account');
  const id = account.data.match(/<tr data-id="(\d+)" data-name="新人小王"/)[1];
  assert.equal((await admin.patch(`/api/users/${id}`, { disabled: true })).status, 200);
  assert.equal((await member.get('/account')).status, 302);
  assert.equal((await member.post('/api/auth/login', { username: 'newbie', password: 'member-pass-123' })).status, 401);
  assert.equal((await admin.patch(`/api/users/${id}`, { disabled: false })).status, 200);
  assert.equal((await member.post('/api/auth/login', { username: 'newbie', password: 'member-pass-123' })).status, 200);
});

test('管理员不能停用或删除自己', async () => {
  const account = await admin.get('/account');
  const id = account.data.match(/<tr data-id="(\d+)" data-name="admin_test"/)[1];
  assert.equal((await admin.patch(`/api/users/${id}`, { disabled: true })).status, 400);
  assert.equal((await admin.del(`/api/users/${id}`)).status, 400);
});

test('修改密码后旧密码失效', async () => {
  assert.equal((await member.post('/api/auth/password', { current: 'wrong', next: 'member-pass-456' })).status, 400);
  assert.equal((await member.post('/api/auth/password', { current: 'member-pass-123', next: 'member-pass-456' })).status, 200);
  const other = client();
  assert.equal((await other.post('/api/auth/login', { username: 'newbie', password: 'member-pass-123' })).status, 401);
  assert.equal((await other.post('/api/auth/login', { username: 'newbie', password: 'member-pass-456' })).status, 200);
  assert.equal((await member.get('/account')).status, 200, '修改密码的设备保持登录');
});

test('退出登录后会话失效', async () => {
  assert.equal((await member.post('/api/auth/logout')).status, 200);
  assert.equal((await member.get('/account')).status, 302);
});

test('连续输错密码会被限制', async () => {
  const c = client();
  for (let i = 0; i < 10; i++) await c.post('/api/auth/login', { username: 'nobody', password: 'x' });
  const res = await c.post('/api/auth/login', { username: 'nobody', password: 'x' });
  assert.equal(res.status, 429);
});
