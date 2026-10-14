/**
 * todos.js —— 待办清单页控制器
 * 负责渲染与交互；数据逻辑全部委托给 todos-store.js
 */

import { KEYS, read, write, formatTime } from './store.js';
import {
  loadTodos, addTodo, updateTodo, removeTodo, toggleTodo,
  clearCompleted, filterTodos, computeStats, seedSampleTodos,
  priorityMeta, PRIORITY_LIST,
} from './todos-store.js';

const $ = (sel) => document.querySelector(sel);

const el = {
  form: $('#todoForm'),
  input: $('#todoInput'),
  priority: $('#prioritySelect'),
  list: $('#todoList'),
  empty: $('#todoEmpty'),
  emptyText: $('#todoEmptyText'),
  hint: $('#listHint'),
  filterStatus: $('#filterStatus'),
  filterPriority: $('#filterPriority'),
  sort: $('#sortSelect'),
  search: $('#searchInput'),
  clearDone: $('#clearDoneBtn'),
  seed: $('#seedBtn'),
  progressBar: $('#progressBar'),
  progressFill: $('#progressFill'),
  progressText: $('#progressText'),
  statTotal: $('#statTotal'),
  statActive: $('#statActive'),
  statDone: $('#statDone'),
  statRate: $('#statRate'),
};

/** 筛选状态（记忆到 localStorage） */
const filter = Object.assign(
  { status: 'all', priority: 'all', sort: 'created-desc', keyword: '' },
  read(KEYS.FILTER, {}),
);

function persistFilter() {
  write(KEYS.FILTER, filter);
}

function el2(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/* ------------------------------ 渲染列表 ------------------------------ */

function buildItem(todo, editingId) {
  const li = el2('li', 'todo-item');
  li.dataset.id = todo.id;
  li.dataset.priority = todo.priority;
  if (todo.done) li.classList.add('is-done');

  // 完成勾选
  const check = el2('button', 'todo-check', todo.done ? '✓' : '');
  check.type = 'button';
  check.setAttribute('aria-pressed', String(todo.done));
  check.setAttribute('aria-label', todo.done ? `标记「${todo.text}」为未完成` : `完成「${todo.text}」`);
  check.addEventListener('click', () => {
    toggleTodo(todo.id);
    render();
  });
  li.appendChild(check);

  // 正文（编辑态 / 展示态）
  const body = el2('div', 'todo-body');
  if (editingId === todo.id) {
    const input = el2('input', 'input todo-edit-input');
    input.value = todo.text;
    input.maxLength = 120;
    input.setAttribute('aria-label', '编辑任务内容');
    let settled = false;
    const commit = (save) => {
      if (settled) return;
      settled = true;
      if (save) {
        const text = input.value.trim();
        if (text && text !== todo.text) updateTodo(todo.id, { text });
      }
      editingId = null;
      render();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(true); }
      if (e.key === 'Escape') { e.preventDefault(); commit(false); }
    });
    input.addEventListener('blur', () => commit(true));
    body.appendChild(input);
    queueMicrotask(() => { input.focus(); input.select(); });
  } else {
    const text = el2('div', 'todo-text', todo.text);
    text.title = '双击编辑';
    text.addEventListener('dblclick', () => { editingId = todo.id; render(); });
    body.appendChild(text);
  }

  // 元信息
  const meta = el2('div', 'todo-meta');
  const pm = priorityMeta(todo.priority);
  meta.appendChild(el2('span', `badge badge-${todo.priority}`, `${pm.icon} ${pm.label}优先级`));
  meta.appendChild(el2('span', null, `创建 ${formatTime(todo.createdAt)}`));
  if (todo.done && todo.completedAt) meta.appendChild(el2('span', null, `完成 ${formatTime(todo.completedAt)}`));
  body.appendChild(meta);
  li.appendChild(body);

  // 操作区
  const actions = el2('div', 'todo-actions');

  const select = el2('select', 'select');
  select.style.padding = '0.2rem 0.4rem';
  select.style.fontSize = '0.8rem';
  select.style.width = 'auto';
  select.setAttribute('aria-label', '修改优先级');
  PRIORITY_LIST.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = priorityMeta(p).label;
    if (p === todo.priority) opt.selected = true;
    select.appendChild(opt);
  });
  select.addEventListener('change', () => {
    updateTodo(todo.id, { priority: select.value });
    render();
  });
  actions.appendChild(select);

  const editBtn = el2('button', 'icon-btn', '✎');
  editBtn.type = 'button';
  editBtn.title = '编辑';
  editBtn.setAttribute('aria-label', `编辑「${todo.text}」`);
  editBtn.addEventListener('click', () => { editingId = todo.id; render(); });
  actions.appendChild(editBtn);

  const delBtn = el2('button', 'icon-btn danger', '🗑');
  delBtn.type = 'button';
  delBtn.title = '删除';
  delBtn.setAttribute('aria-label', `删除「${todo.text}」`);
  delBtn.addEventListener('click', () => {
    if (confirm(`确定删除「${todo.text}」吗？`)) {
      removeTodo(todo.id);
      render();
    }
  });
  actions.appendChild(delBtn);

  li.appendChild(actions);
  return li;
}

let editingId = null;
let searchTimer = null;

function render() {
  const all = loadTodos();
  const visible = filterTodos(all, filter);
  const stats = computeStats(all);

  // 列表
  el.list.innerHTML = '';
  visible.forEach((todo) => el.list.appendChild(buildItem(todo, editingId)));

  // 空状态
  const isEmpty = visible.length === 0;
  el.empty.hidden = !isEmpty;
  if (isEmpty) {
    el.emptyText.textContent = all.length === 0
      ? '还没有任务，先添加一条吧。'
      : '没有符合当前筛选条件的任务，试试清空筛选或换个关键词。';
  }

  // 提示
  el.hint.textContent = all.length === 0
    ? '数据保存在浏览器 localStorage，键名 wtapp:todos。'
    : `共 ${all.length} 条任务，当前显示 ${visible.length} 条。双击任务文字或点 ✎ 即可编辑。`;

  // 统计与进度
  el.statTotal.textContent = String(stats.total);
  el.statActive.textContent = String(stats.active);
  el.statDone.textContent = String(stats.done);
  el.statRate.textContent = `${stats.rate}%`;
  el.progressFill.style.width = `${stats.rate}%`;
  el.progressText.textContent = `${stats.done} / ${stats.total}`;
  el.progressBar.setAttribute('aria-valuenow', String(stats.rate));

  // 同步筛选控件状态
  el.filterStatus.querySelectorAll('button').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.status === filter.status));
  });
  el.filterPriority.value = filter.priority;
  el.sort.value = filter.sort;
  if (el.search.value !== filter.keyword) el.search.value = filter.keyword;
}

/* ------------------------------ 事件绑定 ------------------------------ */

el.form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = el.input.value.trim();
  if (!text) return;
  addTodo(text, el.priority.value);
  el.input.value = '';
  el.input.focus();
  render();
});

el.filterStatus.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-status]');
  if (!btn) return;
  filter.status = btn.dataset.status;
  persistFilter();
  render();
});

el.filterPriority.addEventListener('change', () => {
  filter.priority = el.filterPriority.value;
  persistFilter();
  render();
});

el.sort.addEventListener('change', () => {
  filter.sort = el.sort.value;
  persistFilter();
  render();
});

el.search.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    filter.keyword = el.search.value.trim();
    persistFilter();
    render();
  }, 180);
});

el.clearDone.addEventListener('click', () => {
  const doneCount = loadTodos().filter((t) => t.done).length;
  if (!doneCount) {
    alert('当前没有已完成的任务。');
    return;
  }
  if (!confirm(`确定清空 ${doneCount} 条已完成任务吗？此操作不可恢复。`)) return;
  clearCompleted();
  render();
});

el.seed.addEventListener('click', () => {
  if (loadTodos().length && !confirm('将覆盖当前待办列表并载入 6 条示例数据，继续？')) return;
  seedSampleTodos();
  render();
});

// 从统计页返回时自动刷新
window.addEventListener('storage', (e) => {
  if (!e.key || e.key === KEYS.TODOS) render();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) render();
});

render();
