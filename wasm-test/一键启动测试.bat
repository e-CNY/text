@echo off
chcp 65001 >nul
title WASM 本地测试服务器

echo ==================================================
echo 正在启动本地 Web 服务器...
echo.
echo 请不要关闭此黑窗口！关闭后网页将无法正常运行。
echo 关闭此窗口即可停止服务器。
echo ==================================================
echo.

:: 延迟 1 秒后自动在默认浏览器中打开地址
start "" "http://localhost:8000"

:: 启动 Python 内置的 HTTP 服务器，端口 8000
python -m http.server 8000

:: 如果上面的 python 命令报错，尝试使用 py 命令 (Windows 常见)
if %errorlevel% neq 0 (
    echo.
    echo 尝试使用 py 命令启动...
    py -m http.server 8000
    if %errorlevel% neq 0 (
        echo.
        echo ? 启动失败！请确保你安装了 Python，并且将其加入到了环境变量中。
        pause
    )
)