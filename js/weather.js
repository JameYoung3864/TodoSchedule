/**
 * weather.js —— 天气首页控制器
 * 职责：DOM 渲染、事件绑定、搜索历史 / 收藏城市、天气背景切换
 */

import { KEYS, read, write, remove, formatTime } from './store.js';
import { FALLBACK_CITIES, describeCode, windLevel } from './data.js';
import {
  searchCity, fetchWeather, mockWeather, placeLabel,
  unitSymbol, windUnit, windDir, WeatherError,
} from './api.js';

const MAX_HISTORY = 8;

const $ = (sel) => document.querySelector(sel);

const el = {
  sky: $('#sky'),
  form: $('#searchForm'),
  input: $('#cityInput'),
  options: $('#cityOptions'),
  searchBtn: $('#searchBtn'),
  mockBtn: $('#mockBtn'),
  unitSelect: $('#unitSelect'),
  suggestions: $('#suggestions'),
  status: $('#statusArea'),
  offlineHint: $('#offlineHint'),
  favList: $('#favList'),
  favCount: $('#favCount'),
  favEmpty: $('#favEmpty'),
  historyList: $('#historyList'),
  historyEmpty: $('#historyEmpty'),
  clearHistoryBtn: $('#clearHistoryBtn'),
  weatherSection: $('#weatherSection'),
  emptyState: $('#emptyState'),
  quickCities: $('#quickCities'),
  placeName: $('#placeName'),
  favBtn: $('#favBtn'),
  curIcon: $('#curIcon'),
  curTemp: $('#curTemp'),
  curUnit: $('#curUnit'),
  curDesc: $('#curDesc'),
  curPlace: $('#curPlace'),
  curApparent: $('#curApparent'),
  curHumidity: $('#curHumidity'),
  curWind: $('#curWind'),
  curRain: $('#curRain'),
  infoTz: $('#infoTz'),
  infoCoord: $('#infoCoord'),
  infoTime: $('#infoTime'),
  infoSource: $('#infoSource'),
  infoFetched: $('#infoFetched'),
  mockNotice: $('#mockNotice'),
  forecastGrid: $('#forecastGrid'),
};

const state = {
  unit: read(KEYS.UNIT, 'celsius'),
  history: read(KEYS.HISTORY, []),
  favorites: read(KEYS.FAVORITES, []),
  weather: null,
  controller: null,
  lastQuery: '',
};

if (!Array.isArray(state.history)) state.history = [];
if (!Array.isArray(state.favorites)) state.favorites = [];

/* ------------------------------- 工具 ------------------------------- */

function el2(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function setStatus(type, message, extraButtons = []) {
  el.status.innerHTML = '';
  if (!type) return;
  const box = el2('div', `alert alert-${type}`);
  box.appendChild(el2('span', null, type === 'danger' ? '⚠️' : 'ℹ️'));
  const body = el2('div');
  body.appendChild(el2('div', null, message));
  if (extraButtons.length) {
    const row = el2('div', 'chip-list');
    row.style.marginTop = '.5rem';
    extraButtons.forEach((b) => row.appendChild(b));
    body.appendChild(row);
  }
  box.appendChild(body);
  el.status.appendChild(box);
}

function setLoading(loading, label = '查询中…') {
  el.searchBtn.disabled = loading;
  el.searchBtn.textContent = loading ? label : '查询天气';
}

function placeKey(place) {
  return `${place.name}|${place.admin1 || ''}|${place.country || ''}`.toLowerCase();
}

function makeActionButton(text, onClick, cls = 'btn btn-ghost btn-sm') {
  const btn = el2('button', cls, text);
  btn.type = 'button';
  btn.addEventListener('click', onClick);
  return btn;
}

/* --------------------------- 历史 / 收藏渲染 --------------------------- */

function persistHistory() {
  write(KEYS.HISTORY, state.history);
}

function pushHistory(place) {
  const key = placeKey(place);
  state.history = state.history.filter((p) => placeKey(p) !== key);
  state.history.unshift({ ...place, ts: Date.now() });
  state.history = state.history.slice(0, MAX_HISTORY);
  persistHistory();
  renderHistory();
  renderDatalist();
}

function renderHistory() {
  el.historyList.innerHTML = '';
  el.historyEmpty.hidden = state.history.length > 0;
  state.history.forEach((place) => {
    const chip = el2('button', 'chip');
    chip.type = 'button';
    chip.title = `查询 ${placeLabel(place)}`;
    chip.appendChild(el2('span', null, place.name));
    const x = el2('span', 'chip-x', '✕');
    x.setAttribute('role', 'button');
    x.setAttribute('aria-label', `删除历史 ${place.name}`);
    x.addEventListener('click', (e) => {
      e.stopPropagation();
      state.history = state.history.filter((p) => placeKey(p) !== placeKey(place));
      persistHistory();
      renderHistory();
      renderDatalist();
    });
    chip.appendChild(x);
    chip.addEventListener('click', () => loadWeather(place));
    el.historyList.appendChild(chip);
  });
}

function isFavorite(place) {
  return state.favorites.some((p) => placeKey(p) === placeKey(place));
}

function renderFavorites() {
  el.favList.innerHTML = '';
  el.favCount.textContent = String(state.favorites.length);
  el.favEmpty.hidden = state.favorites.length > 0;
  state.favorites.forEach((place) => {
    const chip = el2('button', 'chip');
    chip.type = 'button';
    chip.appendChild(el2('span', null, '★'));
    chip.appendChild(el2('span', null, place.name));
    const x = el2('span', 'chip-x', '✕');
    x.setAttribute('role', 'button');
    x.setAttribute('aria-label', `取消收藏 ${place.name}`);
    x.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(place, false);
    });
    chip.appendChild(x);
    chip.addEventListener('click', () => loadWeather(place));
    el.favList.appendChild(chip);
  });
  write(KEYS.FAVORITES, state.favorites);
}

function toggleFavorite(place, force) {
  const has = isFavorite(place);
  const next = force === undefined ? !has : force;
  if (next && !has) state.favorites.unshift({ ...place });
  if (!next && has) state.favorites = state.favorites.filter((p) => placeKey(p) !== placeKey(place));
  renderFavorites();
  renderDatalist();
  syncFavButton();
}

function syncFavButton() {
  const place = state.weather?.place;
  if (!place) return;
  const fav = isFavorite(place);
  el.favBtn.textContent = fav ? '★ 已收藏' : '☆ 收藏';
  el.favBtn.setAttribute('aria-pressed', String(fav));
}

function renderDatalist() {
  const names = new Set();
  state.favorites.forEach((p) => names.add(p.name));
  state.history.forEach((p) => names.add(p.name));
  FALLBACK_CITIES.slice(0, 10).forEach((p) => names.add(p.name));
  el.options.innerHTML = '';
  names.forEach((name) => {
    const opt = document.createElement('option');
    opt.value = name;
    el.options.appendChild(opt);
  });
}

/* ------------------------------- 背景 ------------------------------- */

function applySky(weather) {
  const meta = describeCode(weather.current.code);
  el.sky.dataset.weather = meta.theme;
  el.sky.dataset.day = weather.current.isDay ? '1' : '0';
}

/* ------------------------------- 渲染 ------------------------------- */

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function dayLabel(dateStr, index) {
  if (index === 0) return '今天';
  if (index === 1) return '明天';
  if (index === 2) return '后天';
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? dateStr : WEEKDAYS[d.getDay()];
}

function renderWeather(weather) {
  const { current, place } = weather;
  const meta = describeCode(current.code);
  const symbol = unitSymbol(state.unit);

  el.placeName.textContent = place.name;
  el.curIcon.textContent = meta.icon;
  el.curTemp.textContent = current.temp == null ? '--' : String(Math.round(current.temp));
  el.curUnit.textContent = symbol;
  el.curDesc.textContent = `${meta.label} · ${current.isDay ? '白天' : '夜间'}`;
  el.curPlace.textContent = placeLabel(place);
  el.curApparent.textContent = current.apparent == null ? '—' : `${Math.round(current.apparent)}${symbol}`;
  el.curHumidity.textContent = current.humidity == null ? '—' : `${Math.round(current.humidity)}%`;
  el.curWind.textContent = current.wind == null
    ? '—'
    : `${Math.round(current.wind)} ${windUnit(state.unit)} · ${windDir(current.windDirection)}`;
  el.curWind.title = `风力：${windLevel(current.wind)}`;
  el.curRain.textContent = `${Number(current.precipitation ?? 0).toFixed(1)} mm`;

  el.infoTz.textContent = weather.timezone || '—';
  el.infoCoord.textContent = `${Number(place.latitude).toFixed(3)}, ${Number(place.longitude).toFixed(3)}`;
  el.infoTime.textContent = current.time ? String(current.time).replace('T', ' ') : '—';
  el.infoSource.textContent = weather.mock ? '本地演示数据' : 'Open-Meteo Forecast API';
  el.infoFetched.textContent = formatTime(weather.fetchedAt);
  el.mockNotice.hidden = !weather.mock;

  // 未来 3 天：跳过第 1 天（今天），展示后 3 天
  const upcoming = weather.days.slice(1, 4);
  el.forecastGrid.innerHTML = '';
  upcoming.forEach((day, i) => {
    const dayMeta = describeCode(day.code);
    const card = el2('div', 'card card-hover forecast-card');
    card.appendChild(el2('div', 'f-day', dayLabel(day.date, i + 1)));
    card.appendChild(el2('div', 'f-date', day.date));
    card.appendChild(el2('div', 'f-icon', dayMeta.icon));
    const temp = el2('div', 'f-temp');
    temp.appendChild(el2('span', null, `${Math.round(day.max)}°`));
    temp.append(' / ');
    temp.appendChild(el2('span', null, `${Math.round(day.min)}°`));
    card.appendChild(temp);
    card.appendChild(el2('div', null, dayMeta.label));
    if (day.rainProb != null) card.appendChild(el2('div', 'f-rain', `降水概率 ${day.rainProb}%`));
    card.title = `${dayMeta.label}，最高 ${Math.round(day.max)}${symbol}，最低 ${Math.round(day.min)}${symbol}`;
    el.forecastGrid.appendChild(card);
  });

  el.weatherSection.hidden = false;
  el.emptyState.hidden = true;
  el.weatherSection.classList.add('fade-in');
  syncFavButton();
  applySky(weather);
}

/* ------------------------------ 流程控制 ------------------------------ */

async function loadWeather(place, { useMock = false } = {}) {
  state.controller?.abort();
  state.controller = new AbortController();
  el.suggestions.hidden = true;
  setStatus(null);
  setLoading(true);

  try {
    let weather;
    if (useMock) {
      weather = mockWeather(place, state.unit);
    } else {
      weather = await fetchWeather(place, { unit: state.unit, signal: state.controller.signal });
    }
    // 统计计数器：总查询次数 + 每个城市的查询次数
    write(KEYS.SEARCH_COUNT, read(KEYS.SEARCH_COUNT, 0) + 1);
    const cityCount = read(KEYS.CITY_COUNT, {});
    cityCount[place.name] = (Number(cityCount[place.name]) || 0) + 1;
    write(KEYS.CITY_COUNT, cityCount);

    state.weather = weather;
    renderWeather(weather);
    pushHistory({ ...place, ts: Date.now() });
    write(KEYS.LAST_CITY, place);
    el.input.value = place.name;
    if (weather.mock) {
      setStatus('warn', '当前展示的是离线演示数据（接口不可用时的兜底），界面交互与真实数据完全一致。');
    }
  } catch (err) {
    if (err?.code === 'ABORT') return;
    const message = err instanceof WeatherError ? err.message : '查询失败，请稍后重试';
    setStatus('danger', `${message}（${placeLabel(place)}）`, [
      makeActionButton('重试', () => loadWeather(place)),
      makeActionButton('使用演示数据', () => loadWeather(place, { useMock: true }), 'btn btn-soft btn-sm'),
    ]);
  } finally {
    setLoading(false);
  }
}

/** 搜索：先地理编码，多个结果让用户选择 */
async function handleSearch(keyword) {
  const q = String(keyword || '').trim();
  if (!q) return;
  state.lastQuery = q;
  state.controller?.abort();
  state.controller = new AbortController();
  setStatus(null);
  el.suggestions.hidden = true;
  setLoading(true);

  try {
    const { places, offline } = await searchCity(q, { signal: state.controller.signal });
    el.offlineHint.hidden = !offline;

    if (!places.length) {
      setStatus('warn', `没有找到「${q}」，试试更完整的城市名，例如「杭州」「Tokyo」，或使用「纬度,经度」格式（39.9,116.4）。`, [
        makeActionButton('用演示数据看看', () => loadWeather(FALLBACK_CITIES[0], { useMock: true }), 'btn btn-soft btn-sm'),
      ]);
      return;
    }

    if (places.length === 1) {
      setLoading(false);
      await loadWeather(places[0]);
      return;
    }

    // 多个同名城市 → 展示候选列表
    el.suggestions.innerHTML = '';
    places.forEach((place) => {
      const li = document.createElement('li');
      const btn = el2('button');
      btn.type = 'button';
      btn.appendChild(el2('span', 's-name', place.name));
      btn.appendChild(el2('span', 's-meta', [place.admin1, place.country].filter(Boolean).join(' · ')));
      btn.addEventListener('click', () => {
        el.suggestions.hidden = true;
        loadWeather(place);
      });
      li.appendChild(btn);
      el.suggestions.appendChild(li);
    });
    el.suggestions.hidden = false;
    setStatus('info', `找到 ${places.length} 个匹配「${q}」的城市，请选择：`);
  } catch (err) {
    if (err?.code === 'ABORT') return;
    const message = err instanceof WeatherError ? err.message : '城市搜索失败';
    setStatus('danger', message, [
      makeActionButton('重试', () => handleSearch(q)),
      makeActionButton('用演示数据看看', () => loadWeather(FALLBACK_CITIES[0], { useMock: true }), 'btn btn-soft btn-sm'),
    ]);
    // 地理编码不可用时，给出本地城市建议
    const local = FALLBACK_CITIES.filter((c) => c.name.includes(q)).slice(0, 6);
    if (local.length) {
      el.suggestions.innerHTML = '';
      local.forEach((place) => {
        const li = document.createElement('li');
        const btn = el2('button');
        btn.type = 'button';
        btn.appendChild(el2('span', 's-name', place.name));
        btn.appendChild(el2('span', 's-meta', '离线城市表'));
        btn.addEventListener('click', () => loadWeather(place, { useMock: true }));
        li.appendChild(btn);
        el.suggestions.appendChild(li);
      });
      el.suggestions.hidden = false;
    }
  } finally {
    setLoading(false);
  }
}

/* ------------------------------- 初始化 ------------------------------- */

function renderQuickCities() {
  el.quickCities.innerHTML = '';
  FALLBACK_CITIES.slice(0, 8).forEach((place) => {
    const chip = el2('button', 'chip', place.name);
    chip.type = 'button';
    chip.addEventListener('click', () => handleSearch(place.name));
    el.quickCities.appendChild(chip);
  });
}

function init() {
  el.unitSelect.value = state.unit;
  renderQuickCities();
  renderHistory();
  renderFavorites();
  renderDatalist();

  el.form.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSearch(el.input.value);
  });

  el.mockBtn.addEventListener('click', () => {
    const place = state.weather?.place || FALLBACK_CITIES[0];
    loadWeather(place, { useMock: true });
  });

  el.unitSelect.addEventListener('change', () => {
    state.unit = el.unitSelect.value;
    write(KEYS.UNIT, state.unit);
    if (state.weather) loadWeather(state.weather.place, { useMock: state.weather.mock });
  });

  el.clearHistoryBtn.addEventListener('click', () => {
    state.history = [];
    remove(KEYS.HISTORY);
    renderHistory();
    renderDatalist();
  });

  el.favBtn.addEventListener('click', () => {
    if (state.weather?.place) toggleFavorite(state.weather.place);
  });

  // 启动时优先恢复上次查询的城市，其次收藏第一个，最后默认北京
  const last = read(KEYS.LAST_CITY, null);
  const start = (last && last.name ? last : null) || state.favorites[0] || FALLBACK_CITIES[0];
  loadWeather(start);
}

init();
