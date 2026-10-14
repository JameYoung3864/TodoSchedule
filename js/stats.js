/**
 * stats.js —— 统计页控制器
 * 汇聚「待办」与「天气查询」两类本地数据，输出可视化图表（纯 CSS/SVG，无图表库）
 */

import { KEYS, read, remove, clearAll, usage, formatTime } from './store.js';
import { computeStats, loadTodos, seedSampleTodos, priorityMeta, PRIORITY_LIST } from './todos-store.js';

const $ = (sel) => document.querySelector(sel);

const el = {
  sTotal: $('#sTotal'), sTotalSub: $('#sTotalSub'),
  sDone: $('#sDone'), sDoneSub: $('#sDoneSub'),
  sActive: $('#sActive'), sActiveSub: $('#sActiveSub'),
  sSearches: $('#sSearches'), sSearchesSub: $('#sSearchesSub'),
  ringValue: $('#ringValue'), ringPct: $('#ringPct'), ringSub: $('#ringSub'), ringBox: $('#ringBox'),
  priorityBars: $('#priorityBars'),
  trendChart: $('#trendChart'), trendHint: $('#trendHint'),
  weatherStats: $('#weatherStats'), topCities: $('#topCities'),
  clearHistoryBtn: $('#clearHistoryBtn'), clearFavBtn: $('#clearFavBtn'),
  storageInfo: $('#storageInfo'), seedBtn: $('#seedBtn'),
  refreshBtn: $('#refreshBtn'), resetBtn: $('#resetBtn'),
  recentDone: $('#recentDone'), recentEmpty: $('#recentEmpty'),
};

const RING_CIRCUMFERENCE = 2 * Math.PI * 56; // ≈ 351.86

function el2(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function statRow(label, value) {
  const row = el2('div');
  row.style.display = 'flex';
  row.style.justifyContent = 'space-between';
  row.style.gap = '1rem';
  row.appendChild(el2('span', 'stat-label', label));
  row.appendChild(el2('b', null, value));
  return row;
}

/* ------------------------------ 待办统计 ------------------------------ */

function renderTodos() {
  const list = loadTodos();
  const stats = computeStats(list);

  el.sTotal.textContent = String(stats.total);
  el.sTotalSub.textContent = stats.total ? `最早一条创建于 ${formatTime(stats.oldest)}` : '暂无任务';
  el.sDone.textContent = String(stats.done);
  el.sDoneSub.textContent = `完成率 ${stats.rate}%`;
  el.sActive.textContent = String(stats.active);
  el.sActiveSub.textContent = `其中高优先级 ${stats.highActive} 条`;

  // 环形图
  const offset = RING_CIRCUMFERENCE * (1 - stats.rate / 100);
  el.ringValue.setAttribute('stroke-dasharray', String(RING_CIRCUMFERENCE.toFixed(2)));
  el.ringValue.setAttribute('stroke-dashoffset', String(offset.toFixed(2)));
  el.ringPct.textContent = `${stats.rate}%`;
  el.ringSub.textContent = `${stats.done} / ${stats.total} 已完成`;
  el.ringBox.setAttribute('aria-label', `完成率 ${stats.rate}%，共 ${stats.total} 条，已完成 ${stats.done} 条`);

  // 优先级分布
  el.priorityBars.innerHTML = '';
  const maxTotal = Math.max(1, ...PRIORITY_LIST.map((p) => stats.byPriority[p].total));
  PRIORITY_LIST.forEach((p) => {
    const data = stats.byPriority[p];
    const meta = priorityMeta(p);
    const row = el2('div', 'bar-row');
    row.appendChild(el2('span', 'stat-label', `${meta.icon} ${meta.label}`));
    const track = el2('div', `bar-track bar-${p}`);
    const fill = el2('i');
    fill.style.width = `${Math.round((data.total / maxTotal) * 100)}%`;
    track.appendChild(fill);
    row.appendChild(track);
    row.appendChild(el2('span', 'stat-sub', `${data.done}/${data.total}`));
    row.title = `${meta.label}优先级：共 ${data.total} 条，已完成 ${data.done} 条（${data.rate}%）`;
    el.priorityBars.appendChild(row);
  });

  // 近 7 天趋势
  const maxCount = Math.max(1, ...stats.trend.map((d) => d.count));
  el.trendChart.innerHTML = '';
  stats.trend.forEach((day) => {
    const col = el2('div', 'chart-col');
    col.appendChild(el2('span', 'chart-val', String(day.count)));
    const bar = el2('div', 'chart-bar');
    bar.style.height = `${Math.max(6, Math.round((day.count / maxCount) * 100))}%`;
    bar.title = `${day.date} 完成 ${day.count} 条`;
    col.appendChild(bar);
    col.appendChild(el2('span', 'chart-label', day.label));
    el.trendChart.appendChild(col);
  });
  const weekTotal = stats.trend.reduce((sum, d) => sum + d.count, 0);
  el.trendHint.textContent = weekTotal
    ? `近 7 天共完成 ${weekTotal} 条任务，日均 ${(weekTotal / 7).toFixed(1)} 条。`
    : '完成某条任务后，这里会记录当天的完成数量。';

  // 最近完成
  el.recentDone.innerHTML = '';
  el.recentEmpty.hidden = stats.recentDone.length > 0;
  stats.recentDone.forEach((todo) => {
    const li = el2('li', 'todo-item');
    li.dataset.priority = todo.priority;
    li.style.padding = '.55rem .7rem';
    li.appendChild(el2('span', 'todo-check', '✓'));
    const body = el2('div', 'todo-body');
    const text = el2('div', 'todo-text', todo.text);
    text.style.fontSize = '.9rem';
    body.appendChild(text);
    body.appendChild(el2('div', 'todo-meta', `${priorityMeta(todo.priority).label}优先级 · 完成于 ${formatTime(todo.completedAt)}`));
    li.appendChild(body);
    el.recentDone.appendChild(li);
  });
}

/* ------------------------------ 天气统计 ------------------------------ */

function renderWeather() {
  const searches = Number(read(KEYS.SEARCH_COUNT, 0)) || 0;
  const favorites = read(KEYS.FAVORITES, []);
  const history = read(KEYS.HISTORY, []);
  const cityCount = read(KEYS.CITY_COUNT, {});
  const lastCity = read(KEYS.LAST_CITY, null);
  const unit = read(KEYS.UNIT, 'celsius');

  el.sSearches.textContent = String(searches);
  el.sSearchesSub.textContent = `收藏 ${Array.isArray(favorites) ? favorites.length : 0} 个城市`;

  el.weatherStats.innerHTML = '';
  el.weatherStats.appendChild(statRow('查询总次数', String(searches)));
  el.weatherStats.appendChild(statRow('搜索历史条数', String(Array.isArray(history) ? history.length : 0)));
  el.weatherStats.appendChild(statRow('收藏城市', String(Array.isArray(favorites) ? favorites.length : 0)));
  el.weatherStats.appendChild(statRow('温度单位', unit === 'fahrenheit' ? '华氏度 °F' : '摄氏度 °C'));
  el.weatherStats.appendChild(statRow('最后查询', lastCity?.name || '—'));

  // 最常查询的城市（按查询次数降序）
  const entries = Object.entries(cityCount && typeof cityCount === 'object' ? cityCount : {})
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 6);
  el.topCities.innerHTML = '';
  if (!entries.length) {
    el.topCities.appendChild(el2('p', 'hint', '还没有查询记录，去首页搜索一个城市吧。'));
  } else {
    const max = Math.max(1, ...entries.map(([, n]) => Number(n) || 0));
    entries.forEach(([name, n]) => {
      const row = el2('div', 'bar-row');
      row.appendChild(el2('span', 'stat-label', name));
      const track = el2('div', 'bar-track bar-primary');
      const fill = el2('i');
      fill.style.width = `${Math.round(((Number(n) || 0) / max) * 100)}%`;
      track.appendChild(fill);
      row.appendChild(track);
      row.appendChild(el2('span', 'stat-sub', `${n} 次`));
      el.topCities.appendChild(row);
    });
  }
}

function renderStorage() {
  const info = usage();
  const kb = (info.bytes / 1024).toFixed(1);
  el.storageInfo.textContent = info.memoryOnly
    ? '⚠️ 当前浏览器禁用了 localStorage，数据仅保存在内存中，刷新后会丢失。'
    : `已使用约 ${kb} KB，共 ${info.count} 个本地键（前缀 wtapp:）。清理浏览器数据会一并删除。`;
}

function renderAll() {
  renderTodos();
  renderWeather();
  renderStorage();
}

/* ------------------------------ 事件绑定 ------------------------------ */

el.clearHistoryBtn.addEventListener('click', () => {
  if (!read(KEYS.HISTORY, []).length) { alert('暂无搜索历史。'); return; }
  if (!confirm('确定清空搜索历史吗？')) return;
  remove(KEYS.HISTORY);
  renderAll();
});

el.clearFavBtn.addEventListener('click', () => {
  if (!read(KEYS.FAVORITES, []).length) { alert('暂无收藏城市。'); return; }
  if (!confirm('确定清空收藏城市吗？')) return;
  remove(KEYS.FAVORITES);
  renderAll();
});

el.seedBtn.addEventListener('click', () => {
  if (loadTodos().length && !confirm('将覆盖当前待办列表并载入 6 条示例数据，继续？')) return;
  seedSampleTodos();
  renderAll();
});

el.refreshBtn.addEventListener('click', renderAll);

el.resetBtn.addEventListener('click', () => {
  if (!confirm('将删除全部待办、搜索历史、收藏与偏好设置，确定继续吗？')) return;
  clearAll();
  renderAll();
});

window.addEventListener('storage', renderAll);
document.addEventListener('visibilitychange', () => { if (!document.hidden) renderAll(); });

renderAll();
