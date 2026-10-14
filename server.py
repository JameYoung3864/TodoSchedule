#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
server.py —— 一键启动本项目的本地静态服务器（Python 3.7+，零第三方依赖）

用法：
    python server.py                 # 默认 http://127.0.0.1:8808 并自动打开浏览器
    python server.py 9000            # 指定端口
    python server.py --port 9000     # 同上（等价写法）
    python server.py --no-browser    # 不自动打开浏览器
    python server.py --host 0.0.0.0  # 允许局域网内其它设备访问（如手机预览响应式）
    python server.py --help

它做了什么：
    1. 以本文件所在目录为网站根目录（双击运行也不会因为工作目录不同而失败）
    2. 端口被占用时自动尝试后续端口（8809、8810…）
    3. 明确指定 .html/.js/.css/.json 的 MIME 与 UTF-8 编码，避免模块加载失败
    4. 关闭浏览器缓存（开发时改了代码刷新即可看到效果）
    5. 404 时给出友好的页面导航
"""

import argparse
import os
import socket
import sys
import threading
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# 默认端口：改这里即可换默认端口（也可用命令行参数临时指定，如 python server.py 9000）
DEFAULT_PORT = 8808
PAGES = [
    ("index.html", "天气首页"),
    ("todos.html", "待办清单"),
    ("stats.html", "统计页"),
    ("about.html", "关于页"),
]

# 控制台编码处理，避免打印中文时出现乱码或 UnicodeEncodeError：
#   - 输出到终端：跟随控制台实际代码页（中文 Windows 传统控制台是 GBK）
#   - 输出被重定向 / 管道：使用 UTF-8（供日志与工具链消费）
def _setup_console():
    for stream in (sys.stdout, sys.stderr):
        try:
            if stream.isatty():
                encoding = None
                if sys.platform == "win32":
                    try:
                        import ctypes

                        cp = ctypes.windll.kernel32.GetConsoleOutputCP()
                        encoding = "utf-8" if cp == 65001 else "cp%d" % cp
                    except Exception:
                        encoding = None
                stream.reconfigure(encoding=encoding, errors="replace")
            else:
                stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError, OSError):
            pass


_setup_console()


class Handler(SimpleHTTPRequestHandler):
    """静态文件处理器：补齐 MIME 类型、禁用缓存、友好 404。"""

    server_version = "WeatherTodoDevServer/1.0"
    protocol_version = "HTTP/1.1"

    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".html": "text/html; charset=utf-8",
        ".htm": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".mjs": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon",
        ".md": "text/markdown; charset=utf-8",
    }

    def end_headers(self):
        # 开发环境：始终取最新文件
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        # 打印成 [时间] 请求行 的形式，去掉冗长的版本信息
        sys.stderr.write("  %s  %s\n" % (self.log_date_time_string(), fmt % args))

    def send_error(self, code, message=None, explain=None):
        if code == 404:
            body = self._not_found_page().encode("utf-8")
            self.send_response(404)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)
            return
        super().send_error(code, message, explain)

    def _not_found_page(self):
        links = "\n".join(
            '      <li><a href="/%s">%s</a> —— <code>/%s</code></li>' % (f, title, f)
            for f, title in PAGES
        )
        return """<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>404 · 页面不存在</title>
<style>
  body { font-family: "Microsoft YaHei", system-ui, sans-serif; max-width: 640px;
         margin: 12vh auto; padding: 0 1.5rem; line-height: 1.7; color: #16192b; }
  code { background: #eef2ff; padding: .1rem .35rem; border-radius: 6px; }
  ul { line-height: 2; }
  a { color: #4f6ef7; }
  .tip { color: #6b7280; font-size: .9rem; }
  @media (prefers-color-scheme: dark) {
    body { color: #eef2ff; background: #0c1018; } code { background: #1c2437; }
  }
</style></head><body>
  <h1>404 · 找不到 %(path)s</h1>
  <p>本服务器只提供 <code>%(root)s</code> 目录下的静态文件。</p>
  <p>你可能想访问：</p>
  <ul>
%(links)s
  </ul>
  <p class="tip">提示：本项目使用 ES Modules，请通过本服务器访问，不要直接双击 HTML 文件。</p>
</body></html>
""" % {"path": self.path, "root": ROOT, "links": links}


class Server(ThreadingHTTPServer):
    """多线程 HTTP 服务器。

    注意：Windows 上 socketserver 默认的 allow_reuse_address=True 会允许两个进程
    同时绑定同一端口（端口被"抢占"而不报错），因此 Windows 下必须关闭它，
    端口占用才能被正确检测出来并自动切换。
    """

    daemon_threads = True
    allow_reuse_address = sys.platform != "win32"


def create_server(host, preferred, handler, tries=12):
    """依次尝试 preferred、preferred+1… 返回 (服务器实例, 实际端口, 偏移量)"""
    last_error = None
    for offset in range(tries):
        port = preferred + offset
        try:
            return Server((host, port), handler), port, offset
        except OSError as err:
            last_error = err
            continue
    raise SystemExit(
        "端口 %d ~ %d 都被占用，请用 --port 指定其它端口。（最后一个错误：%s）"
        % (preferred, preferred + tries - 1, last_error)
    )


def local_ip():
    """尽力获取局域网 IP，失败返回 None"""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            return sock.getsockname()[0]
    except OSError:
        return None


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="天气查询 + 待办清单 · 本地开发服务器（零依赖）",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("port_pos", nargs="?", type=int, help="端口号（与 --port 等价）")
    parser.add_argument("-p", "--port", type=int, default=DEFAULT_PORT, help="监听端口，默认 %d" % DEFAULT_PORT)
    parser.add_argument("--host", default="127.0.0.1", help="监听地址，默认 127.0.0.1；用 0.0.0.0 可局域网访问")
    parser.add_argument("--no-browser", action="store_true", help="启动后不自动打开浏览器")
    args = parser.parse_args(argv)

    preferred = args.port_pos or args.port
    handler = partial(Handler, directory=str(ROOT))
    httpd, port, offset = create_server(args.host, preferred, handler)

    url = "http://%s:%d/" % ("127.0.0.1" if args.host in ("0.0.0.0", "::") else args.host, port)

    # flush=True：即使输出被重定向到文件或管道，也能立刻看到启动信息
    def say(text=""):
        print(text, flush=True)

    say("")
    say("=" * 62)
    say("  天气查询 + 待办清单  本地服务器已启动")
    say("=" * 62)
    say("  网站根目录 : %s" % ROOT)
    say("  访问地址   : %s" % url)
    if offset:
        say("  端口说明   : %d 被占用，已自动改用 %d" % (preferred, port))
    if args.host == "0.0.0.0":
        ip = local_ip()
        if ip:
            say("  局域网访问 : http://%s:%d/   （手机连同一 WiFi 可预览响应式）" % (ip, port))
    say("  页面       : " + "  ".join("/%s" % f for f, _ in PAGES))
    say("  停止服务   : 按 Ctrl + C")
    say("=" * 62)
    say("")

    if not args.no_browser:
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()
        say("  已尝试打开默认浏览器，若未弹出请手动访问上面的地址。\n")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        say("\n  已停止服务器，感谢使用。\n")
    finally:
        httpd.server_close()
    return 0


if __name__ == "__main__":
    if sys.version_info < (3, 7):
        raise SystemExit("需要 Python 3.7 及以上版本，当前为 %s" % sys.version.split()[0])
    os.chdir(ROOT)  # 保证相对路径（日志、目录）都基于项目根目录
    sys.exit(main())
