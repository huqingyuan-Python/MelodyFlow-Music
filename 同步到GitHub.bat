@echo off
chcp 65001 >nul 2>&1
title MelodyFlow Music - 同步到 GitHub

echo.
echo  ========================================
echo    MelodyFlow Music 同步到 GitHub
echo  ========================================
echo.
echo  本脚本将推送本地更改到 GitHub:
echo    - README 重构 (中/英/日)
echo    - 启动服务.bat 增强版
echo    - start-server-macos.sh (新增)
echo    - start-server-linux.sh (新增)
echo.

cd /d "%~dp0"
echo  正在推送...
git push origin main

if errorlevel 1 (
    echo.
    echo  [失败] 请检查网络，或手动运行:
    echo    git push origin main
    echo.
    pause
) else (
    echo.
    echo  [成功] 已推送到 GitHub!
    echo  访问: https://github.com/huqingyuan-Python/MelodyFlow-Music
    echo.
    pause
)
