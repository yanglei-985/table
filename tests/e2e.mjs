// 浏览器端完整流程演练（Playwright）：管理员登录 → 编辑首页 → 新建并发布教程
// → 生成邀请 → 新成员注册 → 管理成员。运行前需要先 npm run build。
//
//   npm run test:e2e                  无界面运行
//   SHOTS=./shots npm run test:e2e    同时把每一步截图保存到 ./shots
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 4900 + Math.floor(Math.random() * 90);
const BASE = `http://127.0.0.1:${PORT}`;
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tutorial-e2e-'));
const SHOTS = process.env.SHOTS;
const ADMIN = { username: 'admin', password: 'admin-pass-123' };

const server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'dist/server/entry.mjs'], {
  env: { ...process.env, HOST: '127.0.0.1', PORT: String(PORT), DATA_DIR, ADMIN_USERNAME: ADMIN.username, ADMIN_PASSWORD: ADMIN.password, ADMIN_DISPLAY_NAME: '站长' },
  stdio: ['ignore', 'ignore', 'inherit'],
});

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const errors = [];
let step = 0;

async function newPage(viewport = { width: 1280, height: 860 }) {
  const ctx = await browser.newContext({ viewport, locale: 'zh-CN' });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  // 4xx 是流程里故意触发的（如输错密码），界面会显示提示，不算错误
  page.on('console', (m) => {
    if (m.type() === 'error' && !/status of 4\d\d/.test(m.text())) errors.push(m.text());
  });
  page.on('dialog', (d) => d.accept());
  return page;
}

async function shot(page, name, fullPage = false) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOTS, `${String(++step).padStart(2, '0')}-${name}.png`), fullPage });
}

function log(message) {
  console.log(`✓ ${message}`);
}

try {
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(BASE);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  // ---------------------------------------------------------- 1. 管理员登录
  const admin = await newPage();
  await admin.goto(`${BASE}/`);
  assert.equal(await admin.locator('.editbar').count(), 0, '未登录时不应出现编辑工具栏');
  await admin.click('text=登录');
  await admin.fill('input[name=username]', ADMIN.username);
  await admin.fill('input[name=password]', 'wrong-password');
  await admin.click('button[type=submit]');
  await admin.waitForSelector('text=用户名或密码不正确');
  await admin.fill('input[name=password]', ADMIN.password);
  await shot(admin, '登录页');
  await admin.click('button[type=submit]');
  await admin.waitForURL(`${BASE}/`);
  await admin.waitForSelector('.nav-account >> text=站长');
  log('管理员登录（输错密码会提示，输对后回到首页）');

  // ---------------------------------------------------------- 2. 编辑首页
  await admin.click('.editbar [data-action=toggle]');
  assert.ok(await admin.evaluate(() => document.documentElement.classList.contains('editing')));
  await shot(admin, '首页-编辑模式');

  const heroTitle = admin.locator('[data-field=heroTitle]');
  await heroTitle.click();
  await admin.keyboard.press('ControlOrMeta+A');
  await admin.keyboard.type('三天学会写代码');
  const desc = admin.locator('[data-field=description]');
  await desc.click();
  await admin.keyboard.press('End');
  await admin.keyboard.type('（已在线修改）');

  await admin.click('[data-add-item=faq]');
  await admin.keyboard.press('ControlOrMeta+A');
  await admin.keyboard.type('线上编辑的问题？');
  const newAnswer = admin.locator('[data-list=faq] [data-item]').last().locator('[data-sub=a]');
  await newAnswer.click();
  await admin.keyboard.press('ControlOrMeta+A');
  await admin.keyboard.type('这是在网页上直接写的回答。');

  await admin.locator('[data-list=roadmap] [data-item]').last().locator('[data-remove]').click();

  // 顶栏左上角：图标文字和站名直接改（点它们不会跳转）
  const replaceText = async (locator, text) => {
    await locator.click();
    await admin.keyboard.press('ControlOrMeta+A');
    await admin.keyboard.type(text);
  };
  await replaceText(admin.locator('.topbar [data-field=logo]'), '王课');
  await replaceText(admin.locator('.topbar [data-field=name]'), '小王编程课');
  assert.equal(admin.url(), `${BASE}/`, '编辑模式下点站名不跳转');

  // 首屏按钮：直接改文字；点 ⚙ 把第二个按钮改成指向某篇教程、换成主按钮样式
  await replaceText(admin.locator('[data-list=heroButtons] [data-item]').first().locator('[data-sub=label]'), '立刻开始 →');
  await admin.locator('[data-list=heroButtons] [data-item]').nth(1).locator('[data-link-edit]').click();
  await admin.fill('#link-dialog input[name=label]', '先学 Git');
  await admin.selectOption('#link-dialog select[name=target]', '/tutorials/git-first-commit/');
  await admin.selectOption('#link-dialog select[name=style]', 'primary');
  assert.ok(await admin.locator('#link-dialog .ld-custom').isHidden(), '选了现成目标时不显示网址输入框');
  await shot(admin, '链接编辑框');
  await admin.click('#link-dialog button[type=submit]');

  // 底部联系方式：新增一个按钮（自定义网址），删除「邮箱」
  await admin.click('[data-add-item=contacts]');
  assert.ok(await admin.locator('#link-dialog .ld-style').isHidden(), '联系方式没有按钮样式选项');
  assert.ok(await admin.locator('#link-dialog .ld-custom').isVisible(), '自定义网址时显示输入框');
  await admin.fill('#link-dialog input[name=label]', 'B站');
  await admin.fill('#link-dialog input[name=custom]', 'https://space.bilibili.com/1');
  await admin.click('#link-dialog button[type=submit]');
  await admin.locator('[data-list=contacts] [data-item]', { hasText: '邮箱' }).locator('[data-link-edit]').click();
  await admin.click('#link-dialog [data-ld-delete]');

  // 页脚：新增一个链接；导航：改一个名字
  await admin.click('[data-add-item=footerLinks]');
  await admin.fill('#link-dialog input[name=label]', '回到顶部');
  await admin.selectOption('#link-dialog select[name=target]', '/');
  await admin.click('#link-dialog button[type=submit]');
  await replaceText(admin.locator('[data-list=nav] [data-item]').first().locator('[data-sub=label]'), '全部教程');

  // 小标题、统计说明
  await replaceText(admin.locator('[data-field=faqTitle]'), '大家常问');
  await replaceText(admin.locator('[data-list=statLabels] [data-sub]').first(), '篇干货');

  // 区块：隐藏学习路线，把常见问题上移一格
  await admin.locator('[data-section=roadmap] [data-sec=toggle]').click();
  await admin.locator('[data-section=faq] [data-sec=up]').click();

  // 站点设置对话框：改浏览器标签副标题
  await admin.click('.editbar [data-action=settings]');
  await admin.fill('#settings-dialog input[name=tagline]', '新人上手指南');
  await shot(admin, '站点设置对话框');
  await admin.click('#settings-dialog button[type=submit]');

  await shot(admin, '首页-修改后待保存');
  await Promise.all([admin.waitForEvent('load'), admin.click('.editbar [data-action=save]')]);
  await admin.waitForSelector('text=三天学会写代码');
  assert.ok(await admin.evaluate(() => document.documentElement.classList.contains('editing')), '保存后保持编辑模式');
  log('首页文案、按钮、顶栏、页脚、区块顺序和显示都在页面上直接修改并保存');

  // 访客视角确认已生效
  const guest = await newPage();
  await guest.goto(`${BASE}/`);
  await guest.waitForSelector('h1 >> text=三天学会写代码');
  assert.match(await guest.textContent('.brand-name'), /小王编程课/);
  assert.match(await guest.textContent('.brand-mark'), /王课/);
  assert.match(await guest.textContent('.footer'), /小王编程课/, '页脚的站名同步更新');
  assert.match(await guest.title(), /新人上手指南/);
  assert.match(await guest.textContent('.hero-desc'), /（已在线修改）/);
  const heroButtons = guest.locator('.hero-actions a');
  assert.deepEqual(await heroButtons.allTextContents(), ['立刻开始 →', '先学 Git']);
  assert.equal(await heroButtons.nth(1).getAttribute('href'), '/tutorials/git-first-commit/');
  assert.match(await heroButtons.nth(1).getAttribute('class'), /btn-primary/);
  assert.match(await heroButtons.nth(0).getAttribute('href'), /^\/tutorials\//);
  assert.deepEqual(await guest.locator('.cta-links a').allTextContents(), ['GitHub', 'B站']);
  assert.equal(await guest.locator('.cta-links a', { hasText: 'B站' }).getAttribute('href'), 'https://space.bilibili.com/1');
  assert.equal(await guest.locator('.footer-links a', { hasText: '回到顶部' }).getAttribute('href'), '/');
  assert.equal(await guest.locator('.nav-links a').first().textContent(), '全部教程');
  assert.equal(await guest.locator('#faq h2').textContent(), '大家常问');
  assert.match(await guest.textContent('.stats'), /篇干货/);
  assert.equal(await guest.locator('#roadmap').count(), 0, '学习路线已隐藏');
  const order = await guest.locator('[data-section]').evaluateAll((els) => els.map((e) => e.dataset.section));
  assert.deepEqual(order, ['hero', 'faq', 'tutorials', 'contact'], '常见问题上移到教程列表前面');
  assert.equal(await guest.locator('#faq summary', { hasText: '线上编辑的问题？' }).count(), 1);
  assert.equal(await guest.locator('.editbar').count(), 0);
  assert.equal(await guest.locator('.link-gear').count(), 0);
  await shot(guest, '首页-访客视角');
  log('访客刷新后看到全部修改（含按钮、链接、区块顺序），且没有编辑入口');

  // 再把学习路线显示回来，确认删除的那一步确实删掉了
  await admin.locator('[data-section=roadmap] [data-sec=toggle]').click();
  await Promise.all([admin.waitForEvent('load'), admin.click('.editbar [data-action=save]')]);
  await guest.reload();
  assert.equal(await guest.locator('.roadmap .step').count(), 2);
  log('隐藏的区块可以重新显示');

  // ---------------------------------------------------------- 3. 新建并发布教程
  await Promise.all([admin.waitForURL(/\/tutorials\/tutorial-/), admin.click('#new-tutorial')]);
  await admin.waitForSelector('#md');
  assert.ok(await admin.evaluate(() => document.documentElement.classList.contains('editing')), '新教程直接进入编辑模式');
  await admin.locator('[data-edit=title]').click();
  await admin.keyboard.press('ControlOrMeta+A');
  await admin.keyboard.type('用浏览器写的第一篇教程');
  await admin.fill('#meta input[name=slug]', 'browser-lesson');
  await admin.selectOption('#meta select[name=category]', 'skills');
  await admin.fill('#meta input[name=tags]', '演示，在线编辑');
  await admin.uncheck('#meta input[name=draft]');
  await admin.fill('#md', '## 准备工作\n\n1. 打开浏览器\n2. 点「编辑模式」\n\n> [!CHECK]\n> 看到预览更新就成功了。\n');
  await admin.locator('#preview h2', { hasText: '准备工作' }).waitFor();
  await admin.locator('#preview .callout-check').waitFor();
  await shot(admin, '教程-编辑器与实时预览');
  await Promise.all([admin.waitForURL(`${BASE}/tutorials/browser-lesson/`), admin.click('.editbar [data-action=save]')]);
  log('新建教程、填写信息、Markdown 实时预览、发布并改网址');

  await guest.goto(`${BASE}/tutorials/browser-lesson/`);
  await guest.waitForSelector('h1 >> text=用浏览器写的第一篇教程');
  await guest.waitForSelector('.prose .callout-check');
  assert.equal(await guest.locator('.toc a', { hasText: '准备工作' }).count(), 1);
  await shot(guest, '教程-访客视角');
  log('访客能打开新教程，目录和提示框正常');

  // ---------------------------------------------------------- 4. 生成邀请
  await admin.click('.editbar [data-action=toggle]');
  await admin.goto(`${BASE}/account`);
  await admin.fill('#invite-form input[name=note]', '十月新人班');
  await admin.selectOption('#invite-form select[name=maxUses]', '10');
  await Promise.all([admin.waitForEvent('load'), admin.click('#invite-form button[type=submit]')]);
  const invite = admin.locator('.invite').first();
  await invite.locator('.qr svg').waitFor();
  const link = (await invite.locator('.invite-link code').textContent()).trim();
  assert.match(link, /\/join\/[A-Z2-9]{10}$/);
  await invite.locator('button', { hasText: '复制邀请文案' }).click();
  const copied = await admin.evaluate(() => navigator.clipboard.readText());
  assert.ok(copied.includes(link) && copied.includes('小王编程课'), '邀请文案包含站名和链接');
  for (const name of ['设计部', '落地部', '教程部', '成员部', '编辑部']) await admin.locator('#structure', { hasText: name }).waitFor();
  await admin.locator('#structure summary').click();
  await admin.locator('#structure td', { hasText: 'browser-lesson' }).waitFor();
  await shot(admin, '账号中心-邀请与网站结构', true);
  log(`生成邀请链接和二维码，复制的邀请文案：${copied}`);

  // ---------------------------------------------------------- 5. 新成员注册
  const newbie = await newPage({ width: 390, height: 844 });
  await newbie.goto(link.replace(/^https?:\/\/[^/]+/, BASE));
  await newbie.waitForSelector('text=邀请你注册账号');
  await newbie.fill('input[name=username]', 'xiaoming');
  await newbie.fill('input[name=displayName]', '小明');
  await newbie.fill('input[name=password]', 'xiaoming-pass-1');
  await newbie.fill('input[name=confirm]', 'xiaoming-pass-2');
  await newbie.click('button[type=submit]');
  await newbie.waitForSelector('text=两次输入的密码不一致');
  await newbie.fill('input[name=confirm]', 'xiaoming-pass-1');
  await shot(newbie, '邀请注册页-手机');
  await Promise.all([newbie.waitForURL(/\/account\?welcome=1/), newbie.click('button[type=submit]')]);
  await newbie.waitForSelector('text=注册成功');
  assert.equal(await newbie.locator('#invites').count(), 0, '成员看不到邀请管理');
  await newbie.goto(`${BASE}/`);
  assert.equal(await newbie.locator('.editbar').count(), 0, '成员没有编辑工具栏');
  await shot(newbie, '成员首页-手机');
  log('新朋友用邀请链接注册为普通成员，没有编辑权限');

  // ---------------------------------------------------------- 6. 管理成员
  await admin.reload();
  const row = admin.locator('tr', { hasText: '小明' });
  assert.match(await row.textContent(), /站长/, '显示邀请人');
  assert.match(await admin.locator('.invite').first().textContent(), /已使用 1 \/ 10 次/);
  await Promise.all([admin.waitForEvent('load'), row.locator('button', { hasText: '停用' }).click()]);
  await admin.waitForSelector('tr:has-text("小明") >> text=已停用');
  await newbie.goto(`${BASE}/account`);
  await newbie.waitForURL(/\/login/);
  log('管理员停用成员后，对方立即被退出登录');

  await Promise.all([admin.waitForEvent('load'), admin.locator('tr', { hasText: '小明' }).locator('button', { hasText: '恢复' }).click()]);
  await admin.waitForSelector('tr:has-text("小明") >> text=正常');
  log('恢复成员');

  assert.deepEqual(errors, [], `浏览器报错：\n${errors.join('\n')}`);
  console.log('\n全部流程通过 ✅');
} finally {
  await browser.close();
  server.kill();
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
}
