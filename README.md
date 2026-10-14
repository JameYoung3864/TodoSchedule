# 天气查询 + 待办清单（Weather & Todo）

一个纯前端课程作业项目：**天气查询**（Open-Meteo 免费 API）+ **待办清单**（localStorage 持久化），
原生 HTML / CSS / JavaScript（ES Modules）实现，**零第三方依赖、零构建步骤**。

**仓库**：<https://github.com/JameYoung3864/TodoSchedule>　|　
**在线演示**：<https://jameyoung3864.github.io/TodoSchedule/>（开启 Pages 后生效，见第九节）

> 如果你的作业要求 Vue3 + Vite + Tailwind，见文末「[换成 Vue3 版本](#-换成-vue3--vite--tailwind)」一节，业务逻辑可 1:1 迁移。

---

## 一、快速开始

因为使用了 ES Modules 和 `fetch`，请**通过 HTTP 打开页面**（直接双击 `file://` 会被浏览器的模块跨域策略拦截）。

### 方式一：运行 `server.py`（推荐，零依赖，已随项目提供）

```bash
cd p1_todo
python server.py
```

它会自动完成这些事，然后**自动打开浏览器**（默认地址 `http://127.0.0.1:8808`）：

- 以 `server.py` 所在目录为网站根目录（在哪运行都不影响）
- 端口被占用时自动往后找（8808 → 8809 → 8810 …），不用自己改
- 补齐 `.html / .js / .css / .json` 的 MIME 与 UTF-8，关闭缓存（改完代码刷新即生效）
- 访问不存在的地址时给出带页面导航的 404 提示

常用参数：

```bash
python server.py 9000            # 指定端口（临时覆盖默认值）
python server.py --no-browser    # 不自动打开浏览器
python server.py --host 0.0.0.0  # 手机连同一 WiFi 预览响应式效果
python server.py --help          # 查看全部参数
```

> 想永久换默认端口：改 `server.py` 顶部的 `DEFAULT_PORT = 8808` 一行即可。
> Windows 也可直接双击 `server.py`（若 `.py` 关联到 Python 即可运行；此时窗口会一直开着，按 `Ctrl + C` 或关闭窗口停止）。
> macOS / Linux：`python3 server.py`

### 方式二：Python 标准库一行命令（不依赖 server.py）

```bash
cd p1_todo
python -m http.server 8808
# 浏览器访问 http://localhost:8808
```

### 方式三：Node.js

```bash
cd p1_todo
npx --yes serve . -l 8808      # 或 npx --yes http-server -p 8808
# 浏览器访问 http://localhost:8808
```

### 方式四：VS Code Live Server

安装 **Live Server** 插件 → 右键 `index.html` → *Open with Live Server*。

### 方式五：本项目的 npm 脚本

```bash
npm run dev      # 等价于 npx serve . -l 8808
npm run serve    # 等价于 python server.py
npm test         # 运行零依赖自测（见第五节）
```

打开后建议按顺序体验：**天气首页 → 待办清单 → 统计 → 关于**。

---

## 二、功能清单（对照作业要求）

| 要求 | 实现情况 | 主要文件 |
| --- | --- | --- |
| 四个页面：首页天气 / 待办清单 / 统计 / 关于 | ✅ | `index.html` `todos.html` `stats.html` `about.html` |
| 输入城市调用 Open-Meteo 免费 API | ✅ 地理编码 + 天气预报两个接口 | `js/api.js` |
| 显示温度 / 天气 / 风速 / 湿度 | ✅ 另加体感温度、降水、风向、风力等级 | `js/weather.js` |
| 未来 3 天预报 | ✅ 每日图标、最高/最低温、降水概率 | `js/weather.js` |
| 搜索历史 | ✅ 去重、最多 8 条、可单条删除 / 一键清空 | `js/weather.js` |
| 收藏城市 | ✅ ★ 收藏 / 取消，chip 点击即查 | `js/weather.js` |
| 根据天气切换背景 | ✅ 晴 / 多云 / 雨 / 雷 / 雪 / 雾 × 白天/夜间，CSS 渐变过渡 | `css/style.css` `.sky[data-weather]` |
| 待办：添加 / 删除 / 编辑 / 完成 | ✅ 双击文字或 ✎ 进入行内编辑，Esc 取消 | `js/todos.js` |
| 待办：优先级 | ✅ 高/中/低，彩色左侧色条 + 徽标，可就地修改 | `js/todos.js` |
| 待办：筛选 / 搜索 / 排序 | ✅ 状态 + 优先级 + 关键词（防抖）+ 4 种排序 | `js/todos-store.js` |
| 待办：清空已完成 | ✅ 带二次确认，提示将删除的条数 | `js/todos.js` |
| 待办：统计完成率 | ✅ 进度条 + 完成率，统计页另有环形图 | `todos.html` `stats.html` |
| 数据保存 localStorage | ✅ 统一 `wtapp:` 前缀封装，隐私模式自动降级为内存 | `js/store.js` |
| 简洁现代 / 响应式 | ✅ 卡片式 UI，720 / 900 / 560px 三档断点，移动端汉堡菜单 | `css/style.css` |
| 深色模式 | ✅ 跟随系统 + 手动切换（记忆），`Shift`+`D` 快捷键 | `js/theme.js` |

**加分项**：°C/°F 单位切换、离线城市兜底表、接口失败/超时友好提示 + 演示数据、近 7 天完成趋势、
打印样式（可直接导出 PDF 交作业）、`aria-*` 无障碍属性、XSS 防护（全部用 `textContent` 渲染）。

---

## 三、目录结构

```
p1_todo/
├── index.html              天气首页：搜索、当前天气、未来 3 天预报、历史与收藏
├── todos.html              待办清单：增删改查、优先级、筛选、搜索、完成率
├── stats.html              统计页：完成率环图、优先级分布、7 天趋势、查询统计
├── about.html              关于页：技术栈、接口说明、运行步骤、本地数据概览
├── css/
│   └── style.css           全站样式（CSS 变量主题 + 组件 + 响应式 + 打印）
├── js/
│   ├── data.js             WMO 天气代码表、离线城市表、风速等级
│   ├── store.js            localStorage 封装（前缀、容错、内存降级、用量统计）
│   ├── api.js              Open-Meteo 封装：地理编码 / 天气预报 / 归一化 / 演示数据
│   ├── todos-store.js      待办数据模型：CRUD、筛选、排序、统计、示例数据
│   ├── theme.js            公共：深色模式、导航高亮、汉堡菜单、页脚年份
│   ├── weather.js          天气页控制器
│   ├── todos.js            待办页控制器
│   ├── stats.js            统计页控制器
│   └── about.js            关于页小段动态内容
├── server.py               一键启动的本地静态服务器（Python 标准库，零依赖）
├── tests/
│   ├── storage-stub.mjs    Node 环境下的 localStorage 模拟
│   ├── run-tests.mjs       25 项零依赖单元测试（数据层 / 接口层）
│   └── check-dom.mjs       静态检查：JS 选择器 ↔ HTML 元素是否一一对应
├── package.json            仅用于 npm 脚本与 ESM 标记，无任何依赖
├── LICENSE                 MIT 许可
├── .gitignore / .gitattributes / .nojekyll
├── deploy/
│   └── github-pages-workflow.yml  Pages 自动部署工作流模板（启用方式见第九节）
└── README.md
```

设计原则：**数据层（store / api / todos-store）不碰 DOM，页面层（weather / todos / stats）不碰存储细节**，
因此数据层可以在 Node 里直接跑单元测试。

---

## 四、用到的接口（免费、无需 API Key）

| 用途 | 接口 |
| --- | --- |
| 城市搜索（地理编码） | `https://geocoding-api.open-meteo.com/v1/search?name=杭州&count=6&language=zh&format=json` |
| 天气数据 | `https://api.open-meteo.com/v1/forecast?latitude=..&longitude=..&current=..&daily=..&timezone=auto&forecast_days=4` |

请求的字段：

```js
current = temperature_2m, relative_humidity_2m, apparent_temperature, is_day,
          precipitation, weather_code, wind_speed_10m, wind_direction_10m
daily   = weather_code, temperature_2m_max, temperature_2m_min,
          precipitation_probability_max, sunrise, sunset
forecast_days = 4        // 第 1 天是今天，页面展示后 3 天
temperature_unit = celsius | fahrenheit
wind_speed_unit  = kmh | mph
```

天气现象使用 WMO 天气代码（0 晴、3 阴、61 雨、71 雪、95 雷暴…），映射表见 `js/data.js`。

### 网络不可用时怎么办？

- 城市搜索失败 → 自动降级到 `js/data.js` 内置的 28 个常用城市，仍可搜索。
- 天气接口失败/超时（12s）→ 页面提示错误原因，并提供「重试」与「使用演示数据」按钮；
  演示数据由 `mockWeather()` 按「城市名 + 当天日期」稳定生成，页面会明确标注**演示数据**，不会假冒真实数据。

---

## 五、自测与验证

```bash
node tests/run-tests.mjs     # 或 npm test —— 25 项断言：存储封装、CRUD、筛选排序、统计、接口归一化、离线兜底
node tests/check-dom.mjs     # 静态检查 122 处选择器/链接 + 9 个 JS 文件的语法
```

预期输出：`结果：25 项通过，0 项失败` / `全部通过 ✅ 页面与脚本引用一致`。

---

## 六、手动验收清单（交作业前逐条打勾）

1. 首页输入「杭州」→ 显示温度、天气、风速、湿度、未来 3 天预报，背景随天气变化。
2. 输入「北京」→ 出现多个同名城市候选，选择其一后正确加载。
3. 收藏一个城市 → 刷新页面仍存在；点击收藏 chip → 直接查询（不再走地理编码）。
4. 搜索历史可单条删除、可整体清空；刷新后仍在。
5. 切换 °C / °F → 数值与单位同步变化；深色模式开关 + 刷新后保持。
6. 待办页：添加 3 条不同优先级的任务 → 勾选完成 → 进度条与完成率更新。
7. 双击任务文字编辑、✎ 按钮编辑、Esc 取消、🗑 删除（有确认框）。
8. 筛选「未完成」+ 优先级「高」+ 搜索关键词 → 列表结果正确；清空已完成有提示。
9. 刷新 / 关闭浏览器再打开 → 待办数据仍在（localStorage）。
10. 统计页：环形图、优先级分布、近 7 天趋势、查询次数/热门城市全部有数据。
11. 手机尺寸（DevTools 375×667）：导航折叠为汉堡菜单，卡片单列，无横向滚动。
12. 统计页「清空全部数据」→ 所有页面回到初始状态。

---

## 七、常见问题

**Q1：页面一直转圈或提示"网络请求失败"，控制台报 `TypeError: fetch failed` / `ERR_SSL`？**
浏览器无法访问 `api.open-meteo.com`（网络策略、代理或 DNS 问题）。可点击首页的「演示数据」按钮查看完整 UI；
命令行的连通性检查：`curl -I https://api.open-meteo.com/v1/forecast?latitude=39.9&longitude=116.4&current=temperature_2m`。

**Q2：控制台报 `Cannot use import statement outside a module` 或 `CORS policy`？**
说明你用 `file://` 打开了页面。请按第一节运行 `python server.py` 起一个本地 HTTP 服务器。

**Q2-1：运行 `python server.py` 提示端口被占用？**
正常不会报错——默认 8808，被占用时脚本会自动改用 8809、8810……（启动信息里会提示）；也可以直接指定，例如 `python server.py 9000`。

**Q2-2：`python` 命令不存在？**
Windows 可试 `py server.py`；macOS / Linux 用 `python3 server.py`；或改用 Node 的 `npx serve .`。

**Q3：数据存在哪里？会上传服务器吗？**
只存在你本机浏览器的 localStorage，键名统一以 `wtapp:` 开头（`wtapp:todos`、`wtapp:weather:history`、
`wtapp:weather:favorites`、`wtapp:weather:searchCount`、`wtapp:weather:cityCount`、`wtapp:weather:lastCity`、
`wtapp:unit`、`wtapp:theme`、`wtapp:todos:filter`），不会上传任何服务器。
在 DevTools → Application → Local Storage 中可以直接查看和重置。

**Q4：深色模式下某些颜色不好看？**
所有颜色都集中在 `css/style.css` 顶部的 `:root` 与 `[data-theme='dark']` 变量里，改变量即可全站生效。

**Q5：想加"删除单条历史记录""导入导出 JSON"之类？**
数据层已提供 `read/write/remove/clearAll/usage`，加功能只需在控制器里调用，不用碰存储细节。

**Q6：`git push` 报 `refusing to allow a Personal Access Token to create or update workflow ... without workflow scope`？**
GitHub 禁止普通权限的 token 推送 `.github/workflows/` 下的文件。本项目已把工作流模板放在
`deploy/github-pages-workflow.yml`，仓库里不含受限路径，所以正常 push 不会触发该错误；
若你自己手动把文件放到了 `.github/workflows/`，按第九节方式 B 的两种做法之一处理即可
（网页上创建该文件，或给 token 勾上 `workflow` 权限）。

**Q7：Pages 打开是 404？**
确认三件事：仓库是 **Public**；**Settings → Pages** 的 Source 已设置为 `main` + `/ (root)`（或 GitHub Actions）；
再等 1–2 分钟并 `Ctrl + F5` 强刷。本项目所有资源都是相对路径，放在 `/<仓库名>/` 子路径下也能正常工作。

---

## 八、换成 Vue3 + Vite + Tailwind

若作业强制要求 Vue3 技术栈，可按下面映射迁移（业务逻辑无需重写）：

```bash
npm create vite@latest weather-todo -- --template vue
cd weather-todo && npm i && npm i -D tailwindcss @tailwindcss/vite && npm i vue-router
```

| 本项目 | Vue3 对应 |
| --- | --- |
| `js/store.js` `js/api.js` `js/todos-store.js` | 直接复制到 `src/lib/`，原样使用（不依赖 DOM） |
| `index/todos/stats/about.html` | `src/views/` 下四个 `.vue` 组件 + `vue-router` 四个路由 |
| `js/weather.js` 里的渲染函数 | `WeatherView.vue` 的 `ref/computed` + 模板 |
| `js/todos.js` | `TodoView.vue` + `useTodos()` 组合式函数 |
| `js/theme.js` | `useTheme()` composable + `document.documentElement.classList.toggle('dark')` |
| `:root` / `[data-theme='dark']` 变量 | Tailwind 的 `dark:` 变体 + `@theme` 自定义颜色 |
| `css/style.css` 组件类 | Tailwind 原子类，卡片用 `rounded-2xl bg-white/80 backdrop-blur dark:bg-slate-900/80` |

---

## 九、部署到 GitHub / GitHub Pages

本项目是纯静态站点、所有资源都用**相对路径**，因此可以直接发布到
`https://<用户名>.github.io/<仓库名>/` 这样的子路径下，无需任何构建步骤。

> 本地仓库已经初始化并完成提交（分支 `main`），远端 `origin` 也已指向
> <https://github.com/JameYoung3864/TodoSchedule.git>，剩下就是推送 + 开启 Pages。

### 第 1 步：确认 GitHub 上的仓库已存在

仓库地址：**<https://github.com/JameYoung3864/TodoSchedule>**（Public）。

若还没创建，打开 <https://github.com/new> 新建：**Repository name** 填 `TodoSchedule`，
可见性选 **Public**（免费账号的 Pages 只对公开仓库开放），**不要**勾选 *Add a README file* /
*.gitignore* / *license*，保持空仓库。

### 第 2 步：推送

```bash
cd C:\Users\asus\Desktop\p1_todo
git push -u origin main
```

推送时会弹出浏览器 / 凭据窗口让登录 GitHub（Windows 已安装 Git Credential Manager，登录一次即可，
之后不用再输密码）。若远端地址需要改动：
`git remote set-url origin https://github.com/JameYoung3864/TodoSchedule.git`。

### 第 3 步：开启 GitHub Pages

**方式 A：直接从分支发布（推荐，零配置、不挑权限）**

打开 <https://github.com/JameYoung3864/TodoSchedule/settings/pages> →
**Source** 选 **Deploy from a branch** → 分支选 **`main`**、目录选 **`/ (root)`** → **Save**。
等 1–2 分钟，访问 <https://jameyoung3864.github.io/TodoSchedule/> 即可。
（本项目已放好 `.nojekyll`，避免 GitHub 用 Jekyll 处理静态文件。）

**方式 B：GitHub Actions 自动部署（可选，每次 push 自动发布）**

> 为什么默认不用它：GitHub 规定，**推送 `.github/workflows/` 下的文件需要 token 具备 `workflow` 权限**。
> 你当前的 Personal Access Token 没有该权限，会报
> `refusing to allow a Personal Access Token to create or update workflow ... without workflow scope`。
> 因此工作流模板被放在 `deploy/github-pages-workflow.yml`，仓库里不包含受限路径，普通 token 即可推送。

想启用自动部署，二选一：

1. **网页上创建（最简单，不需要改 token）**：打开
   <https://github.com/JameYoung3864/TodoSchedule/new/main/.github/workflows>，
   文件名填 `pages.yml`，内容复制 `deploy/github-pages-workflow.yml`，提交即可。
2. **给 token 加权限后本地创建**：在 GitHub → *Settings → Developer settings → Personal access tokens*
   给该 token 勾上 **`workflow`** 后保存，然后：
   ```bash
   mkdir -p .github/workflows
   cp deploy/github-pages-workflow.yml .github/workflows/pages.yml
   git add .github/workflows/pages.yml
   git commit -m "ci: 启用 GitHub Pages 自动部署"
   git push
   ```

启用后进入 **Settings → Pages**，把 **Source** 改为 **GitHub Actions** 即可。

### 第 4 步：访问线上地址

预计地址：**<https://jameyoung3864.github.io/TodoSchedule/>**

- 首页：<https://jameyoung3864.github.io/TodoSchedule/>
- 待办清单：<https://jameyoung3864.github.io/TodoSchedule/todos.html>
- 统计：<https://jameyoung3864.github.io/TodoSchedule/stats.html>
- 关于：<https://jameyoung3864.github.io/TodoSchedule/about.html>
- 部署状态：仓库 **Settings → Pages** 顶部会显示状态；若启用了 Actions 方式，可在 **Actions** 标签页查看构建进度

### 部署后需要注意

- **首次访问可能 404**：Pages 首次构建需要 1–2 分钟，稍等后刷新；若一直 404，检查 Settings → Pages 的 Source 是否设置正确。
- **天气接口**：Open-Meteo 支持 HTTPS 且允许跨域，部署到 Pages 后功能与本地一致；若浏览器插件/网络拦截了请求，页面上会有提示并可用「演示数据」查看界面。
- **localStorage 按域名隔离**：线上域名和你本地的 `127.0.0.1:8808` 各自独立，线上首次打开时待办是空的，属正常现象。
- **缓存**：GitHub Pages 有 CDN 缓存，更新后若没变化，用 `Ctrl + F5` 强制刷新。
- **私有仓库**：免费账号无法为私有仓库启用 Pages，本仓库已设为 Public，无需担心。

### 常用 git 命令备忘

```bash
git status                       # 查看改动
git add -A && git commit -m "..." # 提交
git push                         # 推送（首次用 git push -u origin main）
git log --oneline --graph        # 查看提交历史
```

---

## 十、许可与数据来源

- 天气数据：[Open-Meteo](https://open-meteo.com/)，遵循 **CC BY 4.0**，免费且无需 API Key，请勿用于商业生产。
- 本项目代码以 MIT 许可发布（见 `LICENSE`），可自由用于课程作业与学习。
