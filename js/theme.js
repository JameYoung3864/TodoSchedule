/**
 * theme.js —— 全站公共：主题（深色模式）、导航高亮、年份
 * 每个页面都引入，保证 UI 行为一致。
 */

import { KEYS, read, write } from './store.js';

const root = document.documentElement;
const media = window.matchMedia('(prefers-color-scheme: dark)');

/** 解析当前应使用的主题：用户显式选择 > 系统偏好 */
function resolveTheme() {
  const saved = read(KEYS.THEME, null);
  if (saved === 'light' || saved === 'dark') return saved;
  return media.matches ? 'dark' : 'light';
}

function applyTheme(theme, persist) {
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  if (persist) write(KEYS.THEME, theme);

  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    const isDark = theme === 'dark';
    btn.textContent = isDark ? '🌙' : '☀️';
    btn.setAttribute('aria-label', isDark ? '切换到浅色模式' : '切换到深色模式');
    btn.setAttribute('aria-pressed', String(isDark));
    btn.title = isDark ? '当前：深色模式' : '当前：浅色模式';
  });
}

function toggleTheme() {
  applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark', true);
}

/* ------------------------- 首屏防闪烁（内联脚本已先设好无障碍） ------------------------- */
applyTheme(resolveTheme(), false);

// 系统主题变化时，仅当用户没有手动锁定主题才跟随
media.addEventListener?.('change', () => {
  const saved = read(KEYS.THEME, null);
  if (saved !== 'light' && saved !== 'dark') applyTheme(resolveTheme(), false);
});

/* ------------------------------ 导航与交互 ------------------------------ */
document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
  btn.addEventListener('click', toggleTheme);
});

// 全局快捷键：Shift + D 切换深色模式
window.addEventListener('keydown', (e) => {
  if (e.shiftKey && (e.key === 'D' || e.key === 'd') && !/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName || '')) {
    e.preventDefault();
    toggleTheme();
  }
});

/** 移动端菜单 */
const navToggle = document.querySelector('[data-nav-toggle]');
const nav = document.querySelector('[data-nav]');
navToggle?.addEventListener('click', () => {
  const open = nav?.classList.toggle('is-open');
  navToggle.setAttribute('aria-expanded', String(Boolean(open)));
});
nav?.addEventListener('click', (e) => {
  if (e.target instanceof HTMLAnchorElement) nav.classList.remove('is-open');
});

/** 当前页导航高亮 */
const here = location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('[data-nav] a').forEach((a) => {
  const target = a.getAttribute('href');
  if (target === here) a.setAttribute('aria-current', 'page');
});

/** 页脚年份 */
document.querySelectorAll('[data-year]').forEach((el) => {
  el.textContent = String(new Date().getFullYear());
});

export { toggleTheme, applyTheme, resolveTheme };
