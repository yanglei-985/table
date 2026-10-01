#!/usr/bin/env node
// 管理员账号命令行工具（直接操作 DATA_DIR/site.db）
//
//   npm run admin -- create <用户名> <密码> [昵称]   创建管理员
//   npm run admin -- password <用户名> <新密码>       重置任意账号的密码
//   npm run admin -- list                             列出所有账号
//   npm run admin -- backup [文件路径]                 备份数据库（网站运行中也可以执行）
import { adminCount, createUser, setPassword } from '../src/server/auth.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { dataDir, getDb } from '../src/server/db.mjs';

const [command, ...args] = process.argv.slice(2);

function usage() {
  console.log(`用法：
  npm run admin -- create <用户名> <密码> [昵称]
  npm run admin -- password <用户名> <新密码>
  npm run admin -- list
  npm run admin -- backup [文件路径]

数据库位置：${dataDir()}/site.db（可用环境变量 DATA_DIR 修改）`);
  process.exit(1);
}

try {
  if (command === 'create') {
    const [username, password, displayName = username] = args;
    if (!username || !password) usage();
    createUser({ username, password, displayName, role: 'admin' });
    console.log(`✓ 已创建管理员 ${username}（当前共 ${adminCount()} 位管理员）`);
  } else if (command === 'password') {
    const [username, password] = args;
    if (!username || !password) usage();
    setPassword(username, password);
    console.log(`✓ 已重置 ${username} 的密码，该账号的所有设备需要重新登录`);
  } else if (command === 'list') {
    const rows = getDb().prepare('SELECT username, display_name, role, disabled, created_at FROM users ORDER BY id').all();
    if (rows.length === 0) console.log('还没有账号。先运行：npm run admin -- create <用户名> <密码>');
    else console.table(rows);
  } else if (command === 'backup') {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const target = path.resolve(args[0] || path.join(dataDir(), 'backups', `site-${stamp}.db`));
    if (fs.existsSync(target)) throw new Error(`${target} 已存在`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    // VACUUM INTO 生成一份完整、一致的数据库副本，不影响正在运行的网站
    getDb().exec(`VACUUM INTO '${target.replaceAll("'", "''")}'`);
    console.log(`✓ 已备份到 ${target}`);
  } else {
    usage();
  }
} catch (err) {
  console.error(`✗ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}
