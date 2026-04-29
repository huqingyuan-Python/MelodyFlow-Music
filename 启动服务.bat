@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion

:: ============================================
::    MelodyFlow Music - 一键部署脚本 (Windows)
:: ============================================

set "SCRIPT_DIR=%~dp0"
set "MUSIC_DIR=%SCRIPT_DIR%music-server"
set "USER_DIR=%SCRIPT_DIR%user-server"
set "NODE_EXE="

title MelodyFlow Music - 部署脚本

echo.
echo  ========================================
echo    MelodyFlow Music 部署脚本
echo    适用平台: Windows
echo  ========================================
echo.

:: ===== 1. 检测 / 安装 Node.js =====
echo [1/7] 检测 Node.js ...

if exist "C:\Program Files\nodejs\node.exe" (
    set "NODE_EXE=C:\Program Files\nodejs\node.exe"
) else if exist "C:\Program Files (x86)\nodejs\node.exe" (
    set "NODE_EXE=C:\Program Files (x86)\nodejs\node.exe"
) else (
    for %%i in (node) do set "NODE_FOUND=%%~$PATH:i"
    if not "!NODE_FOUND!"=="" set "NODE_EXE=!NODE_FOUND!"
)

if "!NODE_EXE!"=="" (
    echo.
    echo  [未检测到 Node.js，准备下载安装...]
    echo.
    echo  正在打开 Node.js 下载页面...
    echo  请下载 LTS 版本，下载完成后运行本脚本即可
    echo.
    echo  下载地址: https://nodejs.org/zh-cn/
    echo.
    echo  如果下载太慢，请使用国内镜像:
    echo    https://npmmirror.com/mirrors/node/
    echo.
    echo  也可使用国内加速版（来自 npmmirror）:
    echo    https://cdn.npmmirror.com/binaries/node/
    echo.
    echo  安装完成后重新运行本脚本
    echo.
    pause
    exit /b 1
)

for /f "delims=" %%v in ('!NODE_EXE! --version 2^>nul') do set "NODE_VER=%%v"
echo   已安装: !NODE_EXE!  !NODE_VER!

:: ===== 2. 获取局域网 IP =====
echo.
echo [2/7] 检测局域网 IP ...
set "LAN_IP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "127.0.0.1"') do (
    for %%b in (%%a) do (
        if not "%%b"=="" (
            if "!LAN_IP!"=="" set "LAN_IP=%%b"
        )
    )
)
set "LAN_IP=!LAN_IP: =!"
if "!LAN_IP!"=="" set "LAN_IP=127.0.0.1"
echo   局域网 IP: !LAN_IP!

:: ===== 3. 安装音乐服务依赖 =====
echo.
echo [3/7] 安装音乐服务依赖（npmmirror 镜像）...
cd /d "!MUSIC_DIR!"
if not exist "node_modules" (
    echo   首次运行，正在安装...
    "!NODE_EXE!" npm install --registry=https://registry.npmmirror.com
    if errorlevel 1 (
        echo   [警告] npmmirror 安装失败，尝试腾讯镜像...
        "!NODE_EXE!" npm install --registry=https://mirrors.cloud.tencent.com/npm/
    )
) else (
    echo   依赖已就绪，跳过
)

:: ===== 4. 安装用户服务依赖 =====
echo.
echo [4/7] 安装用户服务依赖（npmmirror 镜像）...
cd /d "!USER_DIR!"
if not exist "node_modules" (
    echo   首次运行，正在安装...
    "!NODE_EXE!" npm install --registry=https://registry.npmmirror.com
    if errorlevel 1 (
        echo   [警告] npmmirror 安装失败，尝试腾讯镜像...
        "!NODE_EXE!" npm install --registry=https://mirrors.cloud.tencent.com/npm/
    )
) else (
    echo   依赖已就绪，跳过
)

:: ===== 5. 安装用户服务头像目录 =====
echo.
echo [5/7] 检查用户数据目录 ...
if not exist "!USER_DIR!\uploads" mkdir "!USER_DIR!\uploads"
if not exist "!USER_DIR!\melodyflow.db" (
    echo   数据库将在首次运行时自动创建
)

:: ===== 6. 启动用户服务（后台）=====
echo.
echo [6/7] 启动用户服务（端口 3001）...
cd /d "!USER_DIR!"
start "MelodyFlow 用户服务" cmd /c "!NODE_EXE! server.js"
echo   用户服务已在后台启动（端口 3001）

:: ===== 7. 启动音乐服务（前台）=====
echo.
echo [7/7] 启动音乐服务（端口 3000）...
echo.
echo  ================================================
echo   音乐服务: http://127.0.0.1:3000
echo   用户服务: http://127.0.0.1:3001
echo   局域网 IP: !LAN_IP!
echo.
echo   前端使用: 直接打开项目目录中的 index.html
echo   局域网访问: http://!LAN_IP!/index.html
echo.
echo   注意: 用户服务已在后台运行（端口 3001）
echo   如需停止，双击运行「停止服务.bat」，或关闭对应窗口
echo.
echo   按 Ctrl+C 停止音乐服务（用户服务需手动关闭）
echo  ================================================
echo.

:: 延迟打开浏览器
timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:3000/health"

:: 启动音乐服务（前台）
cd /d "!MUSIC_DIR!"
"!NODE_EXE!" server.js
