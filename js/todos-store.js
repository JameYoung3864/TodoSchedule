/**
 * todos-store.js —— 待办数据模型（纯逻辑，不依赖 DOM，可在 Node 中单元测试）
 * 页面层只负责渲染与事件，增删改查 / 筛选 / 排序 / 统计都在这里。
 */

import { KEYS, read, write, uid, dateKey } from './store.js';

/** 优先级定义与展示顺序 */
export const PRIORITIES = {
  high: { value: 'high', label: '高', icon: '🔴', order: 0 },
  medium: { value: 'medium', label: '中', icon: '🟡', order: 1 },
  low: { value: 'low', label: '低', icon: '🟢', order: 2 },
};
export const PRIORITY_LIST = ['high', 'medium', 'low'];

export function priorityMeta(value) {
  return PRIORITIES[value] || PRIORITIES.medium;
}

/** 单条待办规范化，兼容旧数据 / 脏数据 */
function normalizeTodo(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const text = String(raw.text ?? '').trim();
  if (!text) return null;
  const created = Number(raw.createdAt) || Date.now();
  return {
    id: String(raw.id || uid('todo')),
    text,
    done: Boolean(raw.done),
    priority: PRIORITY_LIST.includes(raw.priority) ? raw.priority : 'medium',
    createdAt: created,
    updatedAt: Number(raw.updatedAt) || created,
    completedAt: raw.done ? Number(raw.completedAt) || created : null,
  };
}

/** 读取全部待办 */
export function loadTodos() {
  const raw = read(KEYS.TODOS, []);
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeTodo).filter(Boolean);
}

export function saveTodos(list) {
  return write(KEYS.TODOS, list);
}

/* ------------------------------- 增删改查 ------------------------------- */

export function addTodo(text, priority = 'medium') {
  const clean = String(text ?? '').trim().slice(0, 120);
  if (!clean) return loadTodos();
  const todo = normalizeTodo({ text: clean, priority });
  const list = loadTodos();
  list.unshift(todo);
  saveTodos(list);
  return list;
}

export function updateTodo(id, patch) {
  const list = loadTodos().map((t) => {
    if (t.id !== id) return t;
    const next = { ...t, ...patch, updatedAt: Date.now() };
    if (patch.text !== undefined) {
      const clean = String(patch.text).trim().slice(0, 120);
      next.text = clean || t.text;
    }
    if (patch.priority !== undefined && !PRIORITY_LIST.includes(patch.priority)) {
      next.priority = t.priority;
    }
    if (patch.done !== undefined) {
      next.done = Boolean(patch.done);
      next.completedAt = next.done ? Date.now() : null;
    }
    return next;
  });
  saveTodos(list);
  return list;
}

export function removeTodo(id) {
  const list = loadTodos().filter((t) => t.id !== id);
  saveTodos(list);
  return list;
}

export function toggleTodo(id) {
  const target = loadTodos().find((t) => t.id === id);
  if (!target) return loadTodos();
  return updateTodo(id, { done: !target.done });
}

/** 清空已完成，返回 { list, removed } */
export function clearCompleted() {
  const all = loadTodos();
  const list = all.filter((t) => !t.done);
  saveTodos(list);
  return { list, removed: all.length - list.length };
}

/* --------------------------------- 查询 --------------------------------- */

/** 筛选 + 搜索 + 排序 */
export function filterTodos(list, { status = 'all', priority = 'all', keyword = '', sort = 'created-desc' } = {}) {
  const kw = String(keyword).trim().toLowerCase();
  let out = list.filter((t) => {
    if (status === 'active' && t.done) return false;
    if (status === 'done' && !t.done) return false;
    if (priority !== 'all' && t.priority !== priority) return false;
    if (kw && !t.text.toLowerCase().includes(kw)) return false;
    return true;
  });

  out = out.slice().sort((a, b) => {
    switch (sort) {
      case 'created-asc':
        return a.createdAt - b.createdAt;
      case 'priority': {
        const d = priorityMeta(a.priority).order - priorityMeta(b.priority).order;
        return d !== 0 ? d : b.createdAt - a.createdAt;
      }
      case 'alpha':
        return a.text.localeCompare(b.text, 'zh-Hans-CN');
      case 'created-desc':
      default:
        return b.createdAt - a.createdAt;
    }
  });
  return out;
}

/* --------------------------------- 统计 --------------------------------- */

/** 计算统计数据：总量 / 完成率 / 优先级分布 / 近 7 天完成趋势 */
export function computeStats(list, { days = 7 } = {}) {
  const total = list.length;
  const done = list.filter((t) => t.done).length;
  const active = total - done;
  const rate = total ? Math.round((done / total) * 100) : 0;

  const byPriority = {};
  for (const key of PRIORITY_LIST) {
    const items = list.filter((t) => t.priority === key);
    byPriority[key] = {
      total: items.length,
      done: items.filter((t) => t.done).length,
      rate: items.length ? Math.round((items.filter((t) => t.done).length / items.length) * 100) : 0,
    };
  }

  // 近 N 天完成趋势
  const trend = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = dateKey(d.getTime());
    trend.push({
      date: key,
      label: i === 0 ? '今天' : `${d.getMonth() + 1}/${d.getDate()}`,
      count: list.filter((t) => t.done && t.completedAt && dateKey(t.completedAt) === key).length,
    });
  }

  const recentDone = list
    .filter((t) => t.done && t.completedAt)
    .sort((a, b) => b.completedAt - a.completedAt)
    .slice(0, 6);

  return {
    total, done, active, rate, byPriority, trend, recentDone,
    highActive: list.filter((t) => t.priority === 'high' && !t.done).length,
    oldest: list.reduce((min, t) => Math.min(min, t.createdAt), Date.now()),
  };
}

/** 载入示例数据（演示 / 截图用） */
export function seedSampleTodos() {
  const samples = [
    ['完成前端作业：天气 + 待办项目', 'high', true],
    ['复习 CSS Grid 与 Flex 布局', 'high', false],
    ['给深色模式补一次对比度检查', 'medium', false],
    ['整理 README 运行步骤', 'medium', true],
    ['阅读 Open-Meteo API 文档', 'low', false],
    ['写 200 字项目总结', 'low', true],
  ];
  const now = Date.now();
  const list = samples.map(([text, priority, done], i) => normalizeTodo({
    text,
    priority,
    done,
    createdAt: now - (i + 1) * 3600_000,
    completedAt: done ? now - i * 1800_000 : null,
  }));
  saveTodos(list);
  return list;
}
