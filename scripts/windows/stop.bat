@echo off
setlocal EnableExtensions
chcp 65001 >nul
set "CI_MODE=0"
if /I "%~1"=="--ci" set "CI_MODE=1"
for %%I in ("%~dp0..\..") do set "ROOT=%%~fI"
cd /d "%ROOT%" || goto :error

if "%CI_MODE%"=="1" (
  if not exist "%ROOT%\docker\compose\docker-compose.dev.yml" goto :error
  echo 中文路径停止脚本结构检查通过。
  exit /b 0
)

if exist "%ROOT%\.env" (
  docker compose --env-file "%ROOT%\.env" -f "%ROOT%\docker\compose\docker-compose.dev.yml" down
) else (
  docker compose --env-file "%ROOT%\.env.example" -f "%ROOT%\docker\compose\docker-compose.dev.yml" down
)

taskkill /FI "WINDOWTITLE eq SJG API*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq SJG Worker*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq SJG Employee*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq SJG Center*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq SJG Tech*" /T /F >nul 2>&1

echo 开发环境停止命令已完成。
pause
exit /b 0

:error
echo 停止脚本路径检查失败。
if "%CI_MODE%"=="1" exit /b 1
pause
exit /b 1
