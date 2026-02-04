@echo off
chcp 65001 > nul
echo ========================================
echo   清理数据库并重新同步数据
echo ========================================
echo.

cd /d "%~dp0"

echo 1. 停止服务器...
taskkill /F /IM node.exe 2>nul
timeout /t 2 >nul

echo 2. 备份旧数据库...
if exist "database\kpi.db" (
    copy "database\kpi.db" "database\kpi.db.backup.%date:~0,4%%date:~5,2%%date:~8,2%.%time:~0,2%%time:~3,2%%time:~6,2%" >nul
    echo    数据库已备份
)

echo 3. 删除旧数据库...
del /Q "database\kpi.db" 2>nul
del /Q "database\kpi.db-shm" 2>nul
del /Q "database\kpi.db-wal" 2>nul
echo    数据库已删除

echo 4. 重启服务器...
echo    请在另一个窗口运行: npm start
echo.

echo ========================================
echo   完成！数据库已重置
echo ========================================
pause
