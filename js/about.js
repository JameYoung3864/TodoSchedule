/**
 * about.js —— 关于页的小段动态内容（本地数据概览 / 日期 / 环境提示）
 */

import { KEYS, read, usage } from './store.js';
import { computeStats, loadTodos } from './todos-store.js';

const $ = (sel) => document.querySelector(sel);

function row(label, value) {
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.justifyContent = 'space-between';
  wrap.style.gap = '1rem';

  const l = document.createElement('span');
  l.className = 'stat-label';
  l.textContent = label;

  const v = document.createElement('b');
  v.textContent = value;

  wrap.append(l, v);
  return wrap;
}

function renderLiveStats() {
  const box = $('#liveStats');
  if (!box) return;
  const list = loadTodos();
  const stats = computeStats(list);
  const info = usage();

  box.innerHTML = '';
  box.appendChild(row('待办总数', String(stats.total)));
  box.appendChild(row('已完成 / 完成率', `${stats.done} · ${stats.rate}%`));
  box.appendChild(row('天气查询次数', String(Number(read(KEYS.SEARCH_COUNT, 0)) || 0)));
  box.appendChild(row('收藏城市', String((read(KEYS.FAVORITES, []) || []).length)));
  box.appendChild(row('搜索历史', String((read(KEYS.HISTORY, []) || []).length)));
  box.appendChild(row('本地占用', `${(info.bytes / 1024).toFixed(1)} KB`));
}

function renderMisc() {
  const today = new Date();
  const p = (n) => String(n).padStart(2, '0');
  document.querySelectorAll('[data-today]').forEach((n) => {
    n.textContent = `${today.getFullYear()}-${p(today.getMonth() + 1)}-${p(today.getDate())}`;
  });

  const hint = $('#envHint');
  if (hint) {
    const isFile = location.protocol === 'file:';
    hint.textContent = isFile
      ? '⚠️ 检测到当前以 file:// 打开，ES Modules 与接口请求可能被浏览器拦截，请按上面的方式启动本地服务器。'
      : `✅ 当前通过 ${location.protocol}//${location.host} 运行，环境正常。`;
  }
}

renderLiveStats();
renderMisc();

document.addEventListener('visibilitychange', () => { if (!document.hidden) renderLiveStats(); });
