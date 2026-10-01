// 数据库升级测试：旧版把所有文案存在一条 'site' 配置里，升级后应拆成各部自己的一行
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

test('旧版单条配置升级为各部独立配置', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tutorial-migrate-'));
  const file = path.join(dir, 'site.db');
  const run = () =>
    execFileSync(process.execPath, ['--disable-warning=ExperimentalWarning', '--input-type=module', '-e', "import('./src/core/db.mjs').then((m) => m.getDb())"], {
      env: { ...process.env, DATA_DIR: dir },
    });
  try {
    // 先建好最新结构，再退回到 v1 并写入旧格式的数据
    run();
    const db = new DatabaseSync(file);
    db.exec('DELETE FROM settings; PRAGMA user_version = 1');
    const old = { name: '老站名', heroTitle: '老标题', categories: [{ key: 'a', name: 'A', desc: '' }], inviteMessage: '老邀请', unknown: 1 };
    db.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('site', ?, '2026-01-01T00:00:00.000Z')").run(JSON.stringify(old));
    db.close();

    run();
    const after = new DatabaseSync(file);
    const rows = Object.fromEntries(after.prepare('SELECT key, value FROM settings').all().map((r) => [r.key, JSON.parse(r.value)]));
    assert.equal(after.prepare('PRAGMA user_version').get().user_version, 2);
    after.close();
    assert.deepEqual(Object.keys(rows).sort(), ['accounts', 'design', 'landing', 'tutorials']);
    assert.deepEqual(rows.design, { name: '老站名' });
    assert.deepEqual(rows.landing, { heroTitle: '老标题' });
    assert.deepEqual(rows.tutorials, { categories: old.categories });
    assert.deepEqual(rows.accounts, { inviteMessage: '老邀请' });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
