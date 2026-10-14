/**
 * tests/run-tests.mjs —— 零依赖自测脚本（Node 18+）
 * 运行：node tests/run-tests.mjs      或    npm test
 *
 * 覆盖：localStorage 封装、待办增删改查/筛选/排序/统计、Open-Meteo 数据归一化、
 *       离线兜底与演示数据。
 */

import assert from 'node:assert/strict';

// 必须最先导入：为 Node 环境安装 localStorage 模拟实现
import './storage-stub.mjs';
import { KEYS, read, write, uid } from '../js/store.js';
import {
  addTodo, loadTodos, updateTodo, removeTodo, toggleTodo, clearCompleted,
  filterTodos, computeStats, seedSampleTodos, priorityMeta,
} from '../js/todos-store.js';
import { searchCity, fetchWeather, mockWeather, placeLabel, convertTemp } from '../js/api.js';
import { describeCode, windLevel, searchFallbackCities } from '../js/data.js';

let passed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.log(`  ✗ ${name}\n      ${err.message}`);
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.log(`  ✗ ${name}\n      ${err.message}`);
  }
}

function reset() {
  for (const key of Object.values(KEYS)) write(key, null);
  write(KEYS.TODOS, []);
}

console.log('\n[1] store.js —— 本地存储封装');
test('写入后可读回', () => {
  write('wtapp:__t', { a: 1 });
  assert.deepEqual(read('wtapp:__t', null), { a: 1 });
});
test('坏数据不抛异常，返回默认值', () => {
  globalThis.localStorage.setItem('wtapp:__bad', '{not json');
  assert.equal(read('wtapp:__bad', 'fallback'), 'fallback');
});
test('uid 唯一', () => {
  assert.notEqual(uid('t'), uid('t'));
});

console.log('\n[2] todos-store.js —— 待办数据模型');
test('新增 / 读取', () => {
  reset();
  addTodo('写作业', 'high');
  addTodo('复习 CSS', 'low');
  const list = loadTodos();
  assert.equal(list.length, 2);
  assert.equal(list[0].text, '复习 CSS');           // 新任务在前
  assert.equal(list[0].priority, 'low');
});
test('空文本不创建', () => {
  reset();
  addTodo('   ', 'high');
  assert.equal(loadTodos().length, 0);
});
test('编辑文本与优先级', () => {
  reset();
  const [t] = addTodo('旧标题', 'low');
  updateTodo(t.id, { text: '新标题', priority: 'high' });
  const [updated] = loadTodos();
  assert.equal(updated.text, '新标题');
  assert.equal(updated.priority, 'high');
  assert.ok(updated.updatedAt >= updated.createdAt);
});
test('非法优先级被忽略', () => {
  reset();
  const [t] = addTodo('任务', 'medium');
  updateTodo(t.id, { priority: 'super' });
  assert.equal(loadTodos()[0].priority, 'medium');
});
test('完成 / 取消完成会写 completedAt', () => {
  reset();
  const [t] = addTodo('任务', 'medium');
  toggleTodo(t.id);
  let todo = loadTodos()[0];
  assert.equal(todo.done, true);
  assert.ok(todo.completedAt > 0);
  toggleTodo(t.id);
  todo = loadTodos()[0];
  assert.equal(todo.done, false);
  assert.equal(todo.completedAt, null);
});
test('删除', () => {
  reset();
  const [t] = addTodo('待删除', 'medium');
  removeTodo(t.id);
  assert.equal(loadTodos().length, 0);
});
test('清空已完成只删除已完成项', () => {
  reset();
  addTodo('A', 'high');
  addTodo('B', 'low');
  const doneOne = loadTodos().find((t) => t.text === 'B');
  toggleTodo(doneOne.id);
  const { list, removed } = clearCompleted();
  assert.equal(removed, 1);
  assert.equal(list.length, 1);
  assert.equal(list[0].text, 'A');
});
test('筛选：状态 / 优先级 / 关键词', () => {
  reset();
  addTodo('完成前端作业', 'high');
  addTodo('阅读 API 文档', 'low');
  const docTask = loadTodos().find((t) => t.text.includes('API'));
  toggleTodo(docTask.id);                            // 完成「阅读 API 文档」
  assert.equal(filterTodos(loadTodos(), { status: 'active' }).length, 1);
  assert.equal(filterTodos(loadTodos(), { status: 'done' }).length, 1);
  assert.equal(filterTodos(loadTodos(), { priority: 'high' }).length, 1);
  assert.equal(filterTodos(loadTodos(), { keyword: 'api' }).length, 1);   // 不区分大小写
  assert.equal(filterTodos(loadTodos(), { keyword: '不存在的词' }).length, 0);
});
await testAsync('排序：优先级 / 时间 / 名称', async () => {
  reset();
  addTodo('B 任务', 'low');            // 最早创建
  await new Promise((r) => setTimeout(r, 5));
  addTodo('A 任务', 'high');
  await new Promise((r) => setTimeout(r, 5));
  addTodo('C 任务', 'medium');         // 最新创建
  const byPriority = filterTodos(loadTodos(), { sort: 'priority' }).map((t) => t.text);
  assert.deepEqual(byPriority, ['A 任务', 'C 任务', 'B 任务']);
  const byAlpha = filterTodos(loadTodos(), { sort: 'alpha' }).map((t) => t.text);
  assert.deepEqual(byAlpha, ['A 任务', 'B 任务', 'C 任务']);
  const asc = filterTodos(loadTodos(), { sort: 'created-asc' }).map((t) => t.text);
  const desc = filterTodos(loadTodos(), { sort: 'created-desc' }).map((t) => t.text);
  assert.deepEqual(asc, ['B 任务', 'A 任务', 'C 任务']);
  assert.deepEqual(desc, ['C 任务', 'A 任务', 'B 任务']);
});
test('统计：完成率 / 优先级分布 / 趋势长度', () => {
  reset();
  addTodo('甲', 'high');
  addTodo('乙', 'high');
  addTodo('丙', 'low');
  const byText = (text) => loadTodos().find((t) => t.text === text);
  toggleTodo(byText('甲').id);                       // 完成两条高优先级
  toggleTodo(byText('乙').id);
  const stats = computeStats(loadTodos());
  assert.equal(stats.total, 3);
  assert.equal(stats.done, 2);
  assert.equal(stats.active, 1);
  assert.equal(stats.rate, 67);
  assert.equal(stats.byPriority.high.total, 2);
  assert.equal(stats.byPriority.high.done, 2);
  assert.equal(stats.byPriority.low.done, 0);
  assert.equal(stats.trend.length, 7);
  assert.equal(stats.trend.at(-1).count, 2);        // 今天完成 2 条
  assert.equal(stats.recentDone.length, 2);
});
test('示例数据可载入', () => {
  reset();
  seedSampleTodos();
  assert.equal(loadTodos().length, 6);
  assert.ok(computeStats(loadTodos()).rate > 0);
});
test('优先级元信息', () => {
  assert.equal(priorityMeta('high').order, 0);
  assert.equal(priorityMeta('unknown').value, 'medium');
});

console.log('\n[3] data.js —— 静态数据');
test('WMO 代码映射（含未知代码兜底）', () => {
  assert.equal(describeCode(0).label, '晴');
  assert.equal(describeCode(95).theme, 'thunder');
  assert.equal(describeCode(12345).label, '未知天气');
});
test('风速等级', () => {
  assert.equal(windLevel(0), '无风');
  assert.equal(windLevel(1000), '飓风');
});
test('离线城市搜索', () => {
  assert.equal(searchFallbackCities('杭州').length, 1);
  assert.ok(searchFallbackCities('中国').length >= 10);
  assert.equal(searchFallbackCities('').length, 0);
});

console.log('\n[4] api.js —— 接口与数据归一化');
await testAsync('fetchWeather 归一化 Open-Meteo 响应', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      timezone: 'Asia/Shanghai',
      current: {
        time: '2025-01-01T10:00', temperature_2m: 7.4, relative_humidity_2m: 55,
        apparent_temperature: 5.1, is_day: 1, precipitation: 0.2,
        weather_code: 3, wind_speed_10m: 12.6, wind_direction_10m: 180,
      },
      daily: {
        time: ['2025-01-01', '2025-01-02', '2025-01-03', '2025-01-04'],
        weather_code: [3, 61, 0, 71],
        temperature_2m_max: [9, 8, 11, 2],
        temperature_2m_min: [1, 2, 3, -4],
        precipitation_probability_max: [10, 80, 5, 60],
        sunrise: ['2025-01-01T07:00'] .concat(['', '', '']),
        sunset: ['2025-01-01T17:00', '', '', ''],
      },
    }),
  });
  try {
    const place = { name: '上海', latitude: 31.22, longitude: 121.46, timezone: 'Asia/Shanghai' };
    const w = await fetchWeather(place, { unit: 'celsius' });
    assert.equal(w.mock, false);
    assert.equal(w.current.temp, 7.4);
    assert.equal(w.current.humidity, 55);
    assert.equal(w.current.isDay, true);
    assert.equal(w.days.length, 4);
    assert.equal(w.days[1].rainProb, 80);
    assert.equal(w.days[3].code, 71);
    assert.equal(w.timezone, 'Asia/Shanghai');
    assert.equal(w.place, place);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
await testAsync('searchCity 解析出候选城市', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      results: [
        { id: 1, name: '北京', latitude: 39.9, longitude: 116.4, country: '中国', admin1: '北京市', timezone: 'Asia/Shanghai' },
        { id: 2, name: '北京', latitude: 30.7, longitude: 108.6, country: '中国', admin1: '重庆市', timezone: 'Asia/Shanghai' },
      ],
    }),
  });
  try {
    const { places, offline } = await searchCity('北京');
    assert.equal(places.length, 2);
    assert.equal(offline, false);
    assert.equal(placeLabel(places[0]), '北京 · 北京市 · 中国');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
await testAsync('网络失败时降级到离线城市表', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
  try {
    const { places, offline } = await searchCity('杭州');
    assert.equal(offline, true);
    assert.equal(places[0].name, '杭州');
    assert.equal(places[0].fallback, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
await testAsync('接口报错且离线表也查不到时，抛出可读的业务错误', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
  try {
    await searchCity('Nowhereland');
    throw new Error('应当抛出错误');
  } catch (err) {
    assert.equal(err.code, 'HTTP');
    assert.match(err.message, /503/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
await testAsync('坐标输入直接解析', async () => {
  const { places } = await searchCity('39.9,116.4');
  assert.equal(places.length, 1);
  assert.equal(places[0].latitude, 39.9);
});
test('mockWeather 结构完整且同城同天稳定', () => {
  const place = { name: '成都', latitude: 30.6, longitude: 104.0, timezone: 'Asia/Shanghai' };
  const a = mockWeather(place, 'celsius');
  const b = mockWeather(place, 'celsius');
  assert.equal(a.mock, true);
  assert.equal(a.days.length, 4);
  assert.equal(a.current.code, a.days[0].code);
  assert.equal(a.current.temp, b.current.temp);
  assert.ok(a.current.humidity >= 40 && a.current.humidity <= 90);
  const f = mockWeather(place, 'fahrenheit');
  assert.ok(f.days[0].max > a.days[0].max);
});
test('温度换算', () => {
  assert.equal(convertTemp(0, 'fahrenheit'), 32);
  assert.equal(convertTemp(25, 'celsius'), 25);
  assert.equal(convertTemp(100, 'fahrenheit'), 212);
  assert.equal(convertTemp(null, 'celsius'), null);
});

console.log(`\n结果：${passed} 项通过，${failures.length} 项失败`);
if (failures.length) {
  for (const f of failures) console.error(`\n✗ ${f.name}\n${f.err.stack}`);
  process.exit(1);
}
console.log('全部通过 ✅\n');
