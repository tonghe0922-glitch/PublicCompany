@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
set "CI_MODE=0"
if /I "%~1"=="--ci" set "CI_MODE=1"
for %%I in ("%~dp0..\..") do set "ROOT=%%~fI"
cd /d "%ROOT%" || goto :error

if "%CI_MODE%"=="1" (
  if not exist "%ROOT%\docker\compose\docker-compose.dev.yml" goto :error
  if not exist "%ROOT%\technical-platform\web\package.json" goto :error
  if not exist "%ROOT%\technical-platform\backend\apps\api\pom.xml" goto :error
  if not exist "%ROOT%\technical-platform\backend\apps\worker\pom.xml" goto :error
  if not exist "%ROOT%\technical-platform\web\admin.html" goto :error
  if not exist "%ROOT%\technical-platform\web\src\portals\admin\main.ts" goto :error
  if not exist "%ROOT%\scripts\windows\migrate.bat" goto :error
  if not exist "%ROOT%\scripts\database\migrate.sh" goto :error
  echo 中文路径启动脚本结构检查通过。
  exit /b 0
)

if not exist "%ROOT%\.env" (
  echo 缺少 .env。请先运行 install.bat，并配置本地安全凭据。
  goto :error
)
findstr /C:"__SET_LOCAL_" "%ROOT%\.env" >nul 2>&1
if not errorlevel 1 (
  echo .env 仍包含安全占位符，请先设置本地密码、数据库角色密码和 tenant 部署事实。
  goto :error
)

for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%ROOT%\.env") do (
  if not "%%A"=="" set "%%A=%%B"
)

where docker >nul 2>&1 || goto :error
docker compose --env-file "%ROOT%\.env" -f "%ROOT%\docker\compose\docker-compose.dev.yml" up -d --wait --wait-timeout 180 || goto :error

call "%ROOT%\scripts\windows\migrate.bat" || goto :error

start "SJG API" /D "%ROOT%" cmd /k "call mvnw.cmd -f technical-platform\backend\apps\api\pom.xml spring-boot:run"
start "SJG Worker" /D "%ROOT%" cmd /k "call mvnw.cmd -f technical-platform\backend\apps\worker\pom.xml spring-boot:run"
start "SJG Work" /D "%ROOT%\technical-platform\web" cmd /k "pnpm dev:work"
start "SJG Tech" /D "%ROOT%\technical-platform\web" cmd /k "pnpm dev:admin"

echo 开发环境已完成基础设施启动与 Flyway 迁移，应用以独立 runtime 数据库角色启动。
pause
exit /b 0

:error
echo 启动前检查或数据库迁移失败，未继续启动应用。
if "%CI_MODE%"=="1" exit /b 1
pause
exit /b 1
