@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
echo ====================================
echo 重启开发服务器
echo ====================================
echo.
echo [1/3] 查找端口3000占用情况...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do (
    echo 发现占用进程 PID: %%a
    echo [2/3] 正在终止进程...
    taskkill /F /PID %%a 2>nul
    echo 进程 %%a 已终止
)
echo [3/3] 启动服务器...
echo ====================================
node server.js
if errorlevel 1 (
    echo.
    echo [错误] 服务器启动失败
    pause
)
