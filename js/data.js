/**
 * data.js —— 静态数据表
 * 1) WMO 天气代码 → 中文描述 / 图标 / 背景主题
 * 2) 离线城市表：地理编码接口不可用时的兜底数据
 */

/** WMO Weather interpretation codes (WW) */
export const WMO_CODES = {
  0: { label: '晴', icon: '☀️', theme: 'clear' },
  1: { label: '大部晴朗', icon: '🌤️', theme: 'clear' },
  2: { label: '局部多云', icon: '⛅', theme: 'cloudy' },
  3: { label: '阴', icon: '☁️', theme: 'cloudy' },
  45: { label: '有雾', icon: '🌫️', theme: 'fog' },
  48: { label: '雾凇', icon: '🌫️', theme: 'fog' },
  51: { label: '小毛毛雨', icon: '🌦️', theme: 'rain' },
  53: { label: '毛毛雨', icon: '🌦️', theme: 'rain' },
  55: { label: '大毛毛雨', icon: '🌧️', theme: 'rain' },
  56: { label: '冻毛毛雨', icon: '🌧️', theme: 'rain' },
  57: { label: '强冻毛毛雨', icon: '🌧️', theme: 'rain' },
  61: { label: '小雨', icon: '🌦️', theme: 'rain' },
  63: { label: '中雨', icon: '🌧️', theme: 'rain' },
  65: { label: '大雨', icon: '🌧️', theme: 'rain' },
  66: { label: '冻雨', icon: '🌧️', theme: 'rain' },
  67: { label: '强冻雨', icon: '🌧️', theme: 'rain' },
  71: { label: '小雪', icon: '🌨️', theme: 'snow' },
  73: { label: '中雪', icon: '🌨️', theme: 'snow' },
  75: { label: '大雪', icon: '❄️', theme: 'snow' },
  77: { label: '雪粒', icon: '🌨️', theme: 'snow' },
  80: { label: '小阵雨', icon: '🌦️', theme: 'rain' },
  81: { label: '阵雨', icon: '🌧️', theme: 'rain' },
  82: { label: '强阵雨', icon: '⛈️', theme: 'rain' },
  85: { label: '小阵雪', icon: '🌨️', theme: 'snow' },
  86: { label: '大阵雪', icon: '❄️', theme: 'snow' },
  95: { label: '雷阵雨', icon: '⛈️', theme: 'thunder' },
  96: { label: '雷阵雨伴冰雹', icon: '⛈️', theme: 'thunder' },
  99: { label: '强雷暴伴冰雹', icon: '⛈️', theme: 'thunder' },
};

const UNKNOWN_CODE = { label: '未知天气', icon: '🌈', theme: 'clear' };

/** 根据天气代码取元信息 */
export function describeCode(code) {
  return WMO_CODES[code] || UNKNOWN_CODE;
}

/** 风速（km/h）→ 蒲福风级描述 */
export function windLevel(kmh) {
  if (kmh == null) return '—';
  const table = [
    [1, '无风'], [5, '软风'], [11, '轻风'], [19, '微风'], [28, '和风'],
    [38, '清劲风'], [49, '强风'], [61, '疾风'], [74, '大风'], [88, '烈风'],
    [102, '狂风'], [117, '暴风'],
  ];
  for (const [max, name] of table) if (kmh < max) return name;
  return '飓风';
}

/**
 * 离线城市兜底表（接口不可用时仍可搜索常用城市）
 * 数据来源：Open-Meteo Geocoding API 的常见城市坐标
 */
export const FALLBACK_CITIES = [
  { id: 'cn-bj', name: '北京', admin1: '北京市', country: '中国', latitude: 39.9075, longitude: 116.39723, timezone: 'Asia/Shanghai' },
  { id: 'cn-sh', name: '上海', admin1: '上海市', country: '中国', latitude: 31.22222, longitude: 121.45806, timezone: 'Asia/Shanghai' },
  { id: 'cn-gz', name: '广州', admin1: '广东省', country: '中国', latitude: 23.11667, longitude: 113.25, timezone: 'Asia/Shanghai' },
  { id: 'cn-sz', name: '深圳', admin1: '广东省', country: '中国', latitude: 22.54554, longitude: 114.0683, timezone: 'Asia/Shanghai' },
  { id: 'cn-hz', name: '杭州', admin1: '浙江省', country: '中国', latitude: 30.29365, longitude: 120.16142, timezone: 'Asia/Shanghai' },
  { id: 'cn-nj', name: '南京', admin1: '江苏省', country: '中国', latitude: 32.06167, longitude: 118.77778, timezone: 'Asia/Shanghai' },
  { id: 'cn-cd', name: '成都', admin1: '四川省', country: '中国', latitude: 30.66667, longitude: 104.06667, timezone: 'Asia/Shanghai' },
  { id: 'cn-cq', name: '重庆', admin1: '重庆市', country: '中国', latitude: 29.56026, longitude: 106.55771, timezone: 'Asia/Shanghai' },
  { id: 'cn-wh', name: '武汉', admin1: '湖北省', country: '中国', latitude: 30.58333, longitude: 114.26667, timezone: 'Asia/Shanghai' },
  { id: 'cn-xa', name: '西安', admin1: '陕西省', country: '中国', latitude: 34.25833, longitude: 108.92861, timezone: 'Asia/Shanghai' },
  { id: 'cn-tj', name: '天津', admin1: '天津市', country: '中国', latitude: 39.14222, longitude: 117.17667, timezone: 'Asia/Shanghai' },
  { id: 'cn-sy', name: '沈阳', admin1: '辽宁省', country: '中国', latitude: 41.79222, longitude: 123.43278, timezone: 'Asia/Shanghai' },
  { id: 'cn-hrb', name: '哈尔滨', admin1: '黑龙江省', country: '中国', latitude: 45.75, longitude: 126.65, timezone: 'Asia/Shanghai' },
  { id: 'cn-zz', name: '郑州', admin1: '河南省', country: '中国', latitude: 34.75778, longitude: 113.64861, timezone: 'Asia/Shanghai' },
  { id: 'cn-cs', name: '长沙', admin1: '湖南省', country: '中国', latitude: 28.22861, longitude: 112.93889, timezone: 'Asia/Shanghai' },
  { id: 'cn-qd', name: '青岛', admin1: '山东省', country: '中国', latitude: 36.06623, longitude: 120.38299, timezone: 'Asia/Shanghai' },
  { id: 'cn-xm', name: '厦门', admin1: '福建省', country: '中国', latitude: 24.47979, longitude: 118.08186, timezone: 'Asia/Shanghai' },
  { id: 'cn-km', name: '昆明', admin1: '云南省', country: '中国', latitude: 25.03889, longitude: 102.71833, timezone: 'Asia/Shanghai' },
  { id: 'cn-lz', name: '兰州', admin1: '甘肃省', country: '中国', latitude: 36.05639, longitude: 103.79222, timezone: 'Asia/Shanghai' },
  { id: 'cn-wlmq', name: '乌鲁木齐', admin1: '新疆', country: '中国', latitude: 43.80096, longitude: 87.60046, timezone: 'Asia/Shanghai' },
  { id: 'cn-ls', name: '拉萨', admin1: '西藏', country: '中国', latitude: 29.65, longitude: 91.1, timezone: 'Asia/Shanghai' },
  { id: 'cn-hk', name: '香港', admin1: '香港', country: '中国', latitude: 22.28552, longitude: 114.15769, timezone: 'Asia/Hong_Kong' },
  { id: 'cn-tp', name: '台北', admin1: '台湾', country: '中国', latitude: 25.04776, longitude: 121.53185, timezone: 'Asia/Taipei' },
  { id: 'jp-tk', name: '东京', admin1: '东京都', country: '日本', latitude: 35.6895, longitude: 139.69171, timezone: 'Asia/Tokyo' },
  { id: 'us-ny', name: 'New York', admin1: 'New York', country: '美国', latitude: 40.71427, longitude: -74.00597, timezone: 'America/New_York' },
  { id: 'gb-ld', name: 'London', admin1: 'England', country: '英国', latitude: 51.50853, longitude: -0.12574, timezone: 'Europe/London' },
  { id: 'sg-sg', name: 'Singapore', admin1: '', country: '新加坡', latitude: 1.28967, longitude: 103.85007, timezone: 'Asia/Singapore' },
  { id: 'fr-pa', name: 'Paris', admin1: 'Île-de-France', country: '法国', latitude: 48.85341, longitude: 2.3488, timezone: 'Europe/Paris' },
];

/** 离线城市模糊搜索 */
export function searchFallbackCities(keyword) {
  const kw = String(keyword || '').trim().toLowerCase();
  if (!kw) return [];
  return FALLBACK_CITIES.filter((c) =>
    c.name.toLowerCase().includes(kw) ||
    String(c.admin1 || '').toLowerCase().includes(kw) ||
    String(c.country || '').toLowerCase().includes(kw)
  ).map((c) => ({ ...c, fallback: true }));
}
