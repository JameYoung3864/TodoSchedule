/**
 * store.js —— localStorage 统一读写封装
 * 特点：
 *  - 统一 key 前缀，避免污染其它站点数据
 *  - localStorage 不可用（隐私模式 / 禁用）时自动降级为内存存储
 *  - 所有 JSON 解析做异常保护，坏数据不炸页面
 *  - 不依赖 DOM，可直接在 Node 中单元测试
 */

const PREFIX = 'wtapp:';

export const KEYS = {
  TODOS: PREFIX + 'todos',
  HISTORY: PREFIX + 'weather:history',
  FAVORITES: PREFIX + 'weather:favorites',
  SEARCH_COUNT: PREFIX + 'weather:searchCount',
  CITY_COUNT: PREFIX + 'weather:cityCount',
  LAST_CITY: PREFIX + 'weather:lastCity',
  UNIT: PREFIX + 'unit',
  THEME: PREFIX + 'theme',
  FILTER: PREFIX + 'todos:filter',
};

/** localStorage 探测（失败则用内存 Map 兜底） */
function getBackend() {
  try {
    const k = PREFIX + '__probe__';
    globalThis.localStorage.setItem(k, '1');
    globalThis.localStorage.removeItem(k);
    return globalThis.localStorage;
  } catch {
    const mem = new Map();
    return {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k),
      __memory: true,
    };
  }
}

const backend = getBackend();

/** 是否降级到内存存储 */
export const isMemoryOnly = Boolean(backend.__memory);

/** 读取 JSON，失败返回 fallback */
export function read(key, fallback) {
  try {
    const raw = backend.getItem(key);
    if (raw == null) return fallback;
    const value = JSON.parse(raw);
    return value === null || value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}

/** 写入 JSON（配额溢出等异常静默处理，返回是否成功） */
export function write(key, value) {
  try {
    backend.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(key) {
  try {
    backend.removeItem(key);
  } catch {
    /* noop */
  }
}

/** 清空本项目所有数据 */
export function clearAll() {
  Object.values(KEYS).forEach(remove);
}

/** 生成本地唯一 id */
export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 统计当前项目占用空间（字节） */
export function usage() {
  let bytes = 0;
  let count = 0;
  for (const key of Object.values(KEYS)) {
    const raw = backend.getItem(key);
    if (raw != null) {
      bytes += key.length + raw.length;
      count += 1;
    }
  }
  return { bytes, count, memoryOnly: isMemoryOnly };
}

/* ------------------------------ 小工具 ------------------------------ */

/** 本地日期字符串 YYYY-MM-DD */
export function dateKey(ts = Date.now()) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 友好时间：刚刚 / 12:05 / 昨天 12:05 / 3月8日 */
export function formatTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60_000) return '刚刚';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  const p = (n) => String(n).padStart(2, '0');
  const hm = `${p(d.getHours())}:${p(d.getMinutes())}`;
  if (dateKey(ts) === dateKey(now)) return hm;
  const yesterday = new Date(now.getTime() - 86400_000);
  if (dateKey(ts) === dateKey(yesterday)) return `昨天 ${hm}`;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 转义 HTML（仅在需要拼字符串时使用，优先用 textContent） */
export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
