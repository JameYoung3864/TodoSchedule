/**
 * tests/storage-stub.mjs —— 在 Node 中模拟浏览器 localStorage
 * 必须在 store.js 之前被 import（ESM 按声明顺序求值），这样封装层会选中这个实现，
 * 测试里就能直接往存储里塞坏数据验证容错。
 */

const map = new Map();

globalThis.localStorage = {
  get length() { return map.size; },
  key: (i) => Array.from(map.keys())[i] ?? null,
  getItem: (k) => (map.has(String(k)) ? map.get(String(k)) : null),
  setItem: (k, v) => { map.set(String(k), String(v)); },
  removeItem: (k) => { map.delete(String(k)); },
  clear: () => map.clear(),
  _map: map,
};

export const rawStorage = map;
