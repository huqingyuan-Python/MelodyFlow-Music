@echo off
chcp 65001 >nul 2>&1
title MelodyFlow Music - 停止服务

echo.
echo  正在停止 MelodyFlow Music 服务...
echo.

:: 关闭音乐服务
taskkill /f /im node.exe 2>nul
echo  服务已停止。
echo.
pause
