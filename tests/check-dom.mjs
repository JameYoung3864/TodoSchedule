/**
 * tests/check-dom.mjs —— 静态一致性检查
 * 运行：node tests/check-dom.mjs
 *
 * 校验「JS 里 querySelector('#id') 用到的 id / data-* 钩子」是否真实存在于
 * 对应页面中，避免拼写错误导致运行时报错（无需浏览器）。
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** 页面 ↔ 控制器 映射 */
const PAGES = {
  'index.html': ['js/weather.js'],
  'todos.html': ['js/todos.js'],
  'stats.html': ['js/stats.js'],
  'about.html': ['js/about.js'],
};

/** 所有页面共享的公共脚本 */
const SHARED = ['js/theme.js'];

const problems = [];

function idsIn(html) {
  const ids = new Set();
  for (const m of html.matchAll(/\sid="([^"]+)"/g)) ids.add(m[1]);
  return ids;
}

function dataHooksIn(html) {
  const hooks = new Set();
  for (const m of html.matchAll(/\s(data-[a-z0-9-]+)/g)) hooks.add(m[1]);
  return hooks;
}

function idsUsedIn(js) {
  const used = new Set();
  for (const m of js.matchAll(/querySelector\(\s*['"`]#([\w-]+)['"`]/g)) used.add(m[1]);
  for (const m of js.matchAll(/\$\(\s*['"]#([\w-]+)['"]\s*\)/g)) used.add(m[1]);
  return used;
}

function dataHooksUsedIn(js) {
  const used = new Set();
  for (const m of js.matchAll(/querySelector(?:All)?\(\s*['"`]\[(data-[a-z0-9-]+)\]/g)) used.add(m[1]);
  for (const m of js.matchAll(/querySelectorAll\(\s*['"`]\[(data-[a-z0-9-]+)[=\]]/g)) used.add(m[1]);
  return used;
}

const jsCache = new Map();
function loadJs(file) {
  if (!jsCache.has(file)) jsCache.set(file, readFileSync(join(root, file), 'utf8'));
  return jsCache.get(file);
}

const htmlCache = new Map();
function loadHtml(file) {
  if (!htmlCache.has(file)) htmlCache.set(file, readFileSync(join(root, file), 'utf8'));
  return htmlCache.get(file);
}

let checked = 0;

for (const [page, scripts] of Object.entries(PAGES)) {
  const html = loadHtml(page);
  const ids = idsIn(html);
  const hooks = dataHooksIn(html);

  for (const script of scripts) {
    const js = loadJs(script);
    for (const id of idsUsedIn(js)) {
      checked += 1;
      if (!ids.has(id)) problems.push(`${script} 引用了 #${id}，但 ${page} 中不存在该元素`);
    }
    for (const hook of dataHooksUsedIn(js)) {
      checked += 1;
      if (!hooks.has(hook)) problems.push(`${script} 引用了 [${hook}]，但 ${page} 中不存在该属性`);
    }
  }

  for (const script of SHARED) {
    const js = loadJs(script);
    for (const hook of dataHooksUsedIn(js)) {
      checked += 1;
      if (!hooks.has(hook)) problems.push(`${script}（公共脚本）依赖 [${hook}]，但 ${page} 中不存在该属性`);
    }
  }

  // 页面引用的脚本 / 样式文件是否存在
  for (const m of html.matchAll(/(?:src|href)="((?:js|css)\/[\w.-]+)"/g)) {
    const file = m[1];
    try {
      readFileSync(join(root, file));
    } catch {
      problems.push(`${page} 引用了不存在的文件 ${file}`);
    }
  }

  // 导航链接是否都指向真实页面
  for (const m of html.matchAll(/href="([\w-]+\.html)"/g)) {
    checked += 1;
    try {
      readFileSync(join(root, m[1]));
    } catch {
      problems.push(`${page} 的链接 ${m[1]} 指向不存在的页面`);
    }
  }
}

// 所有 js 文件都应能被解析（语法检查：先剥离 import/export 语句再交给 Function 编译）
const jsFiles = readdirSync(join(root, 'js')).filter((f) => f.endsWith('.js'));
for (const file of jsFiles) {
  const src = loadJs(`js/${file}`)
    .replace(/^\s*import[\s\S]*?from\s*['"][^'"]+['"]\s*;?/gm, '')
    .replace(/^\s*import\s*['"][^'"]+['"]\s*;?/gm, '')
    .replace(/^\s*export\s+(?=(default|const|let|var|function|class|async))/gm, '')
    .replace(/^\s*export\s*\{[^}]*\}\s*;?/gm, '');
  try {
    // eslint-disable-next-line no-new-func
    new Function(src);
  } catch (err) {
    problems.push(`js/${file} 语法检查失败：${err.message}`);
  }
}

console.log(`检查项：${checked} 个选择器 / 链接，${jsFiles.length} 个 JS 文件`);
if (problems.length) {
  console.error('\n发现问题：');
  problems.forEach((p) => console.error(`  ✗ ${p}`));
  process.exit(1);
}
console.log('全部通过 ✅ 页面与脚本引用一致\n');
