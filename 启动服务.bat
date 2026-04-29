@echo off
chcp 65001 >nul
title MelodyFlow 音源服务

echo ========================================
echo    MelodyFlow 多平台音源服务
echo    支持：网易云音乐、QQ音乐
echo ========================================
echo.

:: 尝试设置 PATH 或使用完整路径
set NODE_EXE=
if exist "C:\Program Files\nodejs\node.exe" (
    set "NODE_EXE=C:\Program Files\nodejs\node.exe"
) else if exist "C:\Program Files (x86)\nodejs\node.exe" (
    set "NODE_EXE=C:\Program Files (x86)\nodejs\node.exe"
) else (
    :: 尝试从 PATH 中查找
    for %%i in (node) do (
        set NODE_EXE=%%~$PATH:i
    )
)

if "%NODE_EXE%"=="" (
    echo [错误] 未检测到 Node.js
    echo 请先安装 Node.js: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo 使用 Node.js: %NODE_EXE%
echo.

:: 获取脚本所在目录
set "SCRIPT_DIR=%~dp0music-server"
cd /d "%SCRIPT_DIR%"

echo [1/3] 检查依赖...
if not exist "node_modules" (
    echo [2/3] 正在安装依赖 (使用国内镜像)...
    "%NODE_EXE%" npm install --registry=https://registry.npmmirror.com
    if errorlevel 1 (
        echo [警告] 镜像安装失败，尝试官方源...
        "%NODE_EXE%" npm install
    )
)

echo [3/3] 启动音源服务...
echo.
echo   服务地址: http://127.0.0.1:3000
echo   平台: 网易云音乐 / QQ音乐
echo.
echo   首次使用请在设置页面配置音源地址为: http://127.0.0.1:3000
echo.
echo 按 Ctrl+C 停止服务
echo ========================================
echo.

"%NODE_EXE%" server.js
