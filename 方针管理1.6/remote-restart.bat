@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM ==================== 配置区 ====================
set TARGET_PC=192.168.21.208
set TARGET_USER=208电脑的用户名
set TARGET_PASSWORD=208电脑的密码
set PROJECT_PATH=C:\方针管理1.3
set PSEXEC_PATH=psexec.exe
REM ===============================================

echo ====================================
echo 远程重启 208 电脑服务器
echo 目标: %TARGET_PC%
echo ====================================
echo.

REM 检查 PsExec
if not exist "%PSEXEC_PATH%" (
    echo [错误] 未找到 PsExec 工具
    echo.
    echo 请下载 PsExec:
    echo https://learn.microsoft.com/zh-cn/sysinternals/downloads/psexec
    echo.
    echo 下载后放到当前目录或系统 PATH 中
    pause
    exit /b 1
)

echo [1/3] 终止远程 208 电脑上的 3000 端口进程...
"%PSEXEC_PATH%" \\%TARGET_PC% -u %TARGET_USER% -p %TARGET_PASSWORD% ^
    for /f "tokens=5" %%%%a in ('netstat -aon ^| findstr :3000') do taskkill /F /PID %%%%a 2^>nul
echo.

echo [2/3] 启动远程服务器...
"%PSEXEC_PATH%" \\%TARGET_PC% -u %TARGET_USER% -p %TARGET_PASSWORD% ^
    -d -i cmd /c "cd /d "%PROJECT_PATH%" && restart.bat"
echo.

echo [3/3] 完成！
echo 服务器正在后台运行
echo 访问: http://%TARGET_PC%:3000
echo ====================================
pause
