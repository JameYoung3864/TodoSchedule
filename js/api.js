/**
 * api.js —— Open-Meteo 免费 API 封装（不依赖 DOM，可在 Node 中测试）
 *
 * 使用的三个免费接口（无需 API Key）：
 *   1. 地理编码  GET https://geocoding-api.open-meteo.com/v1/search
 *   2. 天气预报  GET https://api.open-meteo.com/v1/forecast
 *
 * 设计要点：
 *   - 统一超时 / 取消（AbortController）
 *   - 网络失败时：城市搜索降级到本地城市表，天气数据可切换演示数据
 *   - 返回值全部做归一化（normalize），页面层不接触原始字段
 */

import { FALLBACK_CITIES, searchFallbackCities } from './data.js';

const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const DEFAULT_TIMEOUT = 12_000;

/** 业务错误类型，带 code 便于页面区分处理 */
export class WeatherError extends Error {
  constructor(message, code = 'UNKNOWN', cause) {
    super(message);
    this.name = 'WeatherError';
    this.code = code;
    if (cause) this.cause = cause;
  }
}

/** 带超时的 fetch + JSON 解析 */
async function fetchJSON(url, { signal, timeout = DEFAULT_TIMEOUT } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeout);
  const onAbort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener('abort', onAbort, { once: true });
  }

  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new WeatherError(`接口返回 ${res.status}`, 'HTTP', null);
    return await res.json();
  } catch (err) {
    if (err instanceof WeatherError) throw err;
    if (err?.name === 'AbortError') {
      if (signal?.aborted) throw new WeatherError('请求已取消', 'ABORT', err);
      throw new WeatherError('请求超时，请检查网络后重试', 'TIMEOUT', err);
    }
    throw new WeatherError('网络请求失败，可能是网络不可用或接口被拦截', 'NETWORK', err);
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

/** 归一化地理编码结果 */
function normalizePlace(item) {
  return {
    id: item.id ?? `${item.name}-${item.latitude}`,
    name: item.name,
    admin1: item.admin1 || '',
    country: item.country || '',
    latitude: Number(item.latitude),
    longitude: Number(item.longitude),
    timezone: item.timezone || 'auto',
    fallback: Boolean(item.fallback),
  };
}

/** 展示用的完整地名：北京市 · 中国 */
export function placeLabel(place) {
  if (!place) return '';
  return [place.name, place.admin1 && place.admin1 !== place.name ? place.admin1 : '', place.country]
    .filter(Boolean)
    .join(' · ');
}

/**
 * 城市搜索
 * @returns {Promise<{places: Array, offline: boolean}>} offline=true 表示走了本地兜底数据
 */
export async function searchCity(keyword, { signal, count = 6 } = {}) {
  const q = String(keyword || '').trim();
  if (!q) throw new WeatherError('请输入城市名称', 'EMPTY');

  // 纯数字坐标直接解析：39.9,116.4
  const coord = q.match(/^(-?\d+(?:\.\d+)?)\s*[,，]\s*(-?\d+(?:\.\d+)?)$/);
  if (coord) {
    return {
      offline: false,
      places: [normalizePlace({
        id: `coord-${coord[1]}-${coord[2]}`,
        name: `${coord[1]}, ${coord[2]}`,
        country: '坐标定位',
        latitude: coord[1],
        longitude: coord[2],
        timezone: 'auto',
      })],
    };
  }

  const url = `${GEO_URL}?name=${encodeURIComponent(q)}&count=${count}&language=zh&format=json`;
  try {
    const data = await fetchJSON(url, { signal });
    const places = (data.results || []).map(normalizePlace);
    if (!places.length) {
      return { places: [], offline: false };
    }
    return { places, offline: false };
  } catch (err) {
    if (err.code === 'ABORT') throw err;
    const places = searchFallbackCities(q);
    if (places.length) return { places: places.map(normalizePlace), offline: true };
    throw err;
  }
}

const CURRENT_FIELDS = [
  'temperature_2m', 'relative_humidity_2m', 'apparent_temperature',
  'is_day', 'precipitation', 'weather_code', 'wind_speed_10m', 'wind_direction_10m',
].join(',');

const DAILY_FIELDS = [
  'weather_code', 'temperature_2m_max', 'temperature_2m_min',
  'precipitation_probability_max', 'sunrise', 'sunset',
].join(',');

/** 归一化天气数据 */
function normalizeWeather(data, place, unit) {
  const c = data.current || {};
  const d = data.daily || {};
  const days = (d.time || []).map((date, i) => ({
    date,
    code: d.weather_code?.[i] ?? 0,
    max: d.temperature_2m_max?.[i] ?? null,
    min: d.temperature_2m_min?.[i] ?? null,
    rainProb: d.precipitation_probability_max?.[i] ?? null,
    sunrise: d.sunrise?.[i] || null,
    sunset: d.sunset?.[i] || null,
  }));

  return {
    place,
    unit,
    timezone: data.timezone || place.timezone,
    fetchedAt: Date.now(),
    mock: false,
    current: {
      time: c.time,
      temp: c.temperature_2m,
      apparent: c.apparent_temperature,
      humidity: c.relative_humidity_2m,
      precipitation: c.precipitation,
      code: c.weather_code ?? 0,
      isDay: c.is_day !== 0,
      wind: c.wind_speed_10m,
      windDirection: c.wind_direction_10m,
    },
    days,
  };
}

/**
 * 查询天气
 * @param {{latitude:number, longitude:number}} place
 * @param {{unit?:'celsius'|'fahrenheit', signal?:AbortSignal}} options
 */
export async function fetchWeather(place, { unit = 'celsius', signal } = {}) {
  const params = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: CURRENT_FIELDS,
    daily: DAILY_FIELDS,
    timezone: place.timezone && place.timezone !== 'auto' ? place.timezone : 'auto',
    forecast_days: '4',
    temperature_unit: unit,
    wind_speed_unit: unit === 'fahrenheit' ? 'mph' : 'kmh',
  });

  const data = await fetchJSON(`${FORECAST_URL}?${params}`, { signal });
  return normalizeWeather(data, place, unit);
}

/** 温度单位符号 */
export function unitSymbol(unit) {
  return unit === 'fahrenheit' ? '°F' : '°C';
}

export function windUnit(unit) {
  return unit === 'fahrenheit' ? 'mph' : 'km/h';
}

/** 摄氏度 → 目标单位 */
export function convertTemp(celsius, unit) {
  if (celsius == null) return null;
  return unit === 'fahrenheit' ? Math.round((celsius * 9) / 5 + 32) : Math.round(celsius);
}

/** 字符串哈希（保证同一城市演示数据稳定） */
function hashCode(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * 离线演示数据：网络不可用时让页面依然可演示（页面上会明确标注「演示数据」）
 * 依据城市名 + 日期生成，保证同一天同一城市结果稳定。
 */
export function mockWeather(place, unit = 'celsius') {
  const seed = hashCode(`${place.name}-${new Date().toDateString()}`);
  const codes = [0, 1, 2, 3, 61, 63, 80, 71, 45, 95];
  const code = codes[seed % codes.length];
  const base = 8 + (seed % 20);            // 8 ~ 27 摄氏度
  const midday = new Date().getHours() >= 6 && new Date().getHours() < 19;
  const daily = [];

  for (let i = 0; i < 4; i += 1) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const iso = date.toISOString().slice(0, 10);
    const swing = ((seed >> (i + 1)) % 6) - 3;
    const dayMin = base + swing - 4;
    const dayMax = base + swing + 4;
    daily.push({
      date: iso,
      code: i === 0 ? code : codes[(seed + i * 3) % codes.length],
      max: unit === 'fahrenheit' ? Math.round((dayMax * 9) / 5 + 32) : dayMax,
      min: unit === 'fahrenheit' ? Math.round((dayMin * 9) / 5 + 32) : dayMin,
      rainProb: (seed + i * 17) % 101,
      sunrise: null,
      sunset: null,
    });
  }

  const cur = daily[0];
  return {
    place,
    unit,
    timezone: place.timezone || 'Asia/Shanghai',
    fetchedAt: Date.now(),
    mock: true,
    current: {
      time: new Date().toISOString().slice(0, 16),
      temp: Math.round((cur.max + cur.min) / 2 + (midday ? 1 : 0)),
      apparent: Math.round((cur.max + cur.min) / 2 - (midday ? 0 : 2)),
      humidity: 40 + (seed % 50),
      precipitation: Number(((seed % 30) / 10).toFixed(1)),
      code: cur.code,
      isDay: midday,
      wind: 3 + (seed % 25),
      windDirection: (seed % 36) * 10,
    },
    days: daily,
  };
}

/** 风向角度 → 中文方位 */
export function windDir(deg) {
  if (deg == null) return '—';
  const dirs = ['北', '东北偏北', '东北', '东北偏东', '东', '东南偏东', '东南', '东南偏南',
    '南', '西南偏南', '西南', '西南偏西', '西', '西北偏西', '西北', '西北偏北'];
  return `${dirs[Math.round(deg / 22.5) % 16]}风`;
}

export const CITY_COUNT = FALLBACK_CITIES.length;
