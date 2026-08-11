@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
set "CI_MODE=0"
if /I "%~1"=="--ci" set "CI_MODE=1"
for %%I in ("%~dp0..\..") do set "ROOT=%%~fI"
cd /d "%ROOT%" || goto :error

if "%CI_MODE%"=="1" (
  if not exist "%ROOT%\technical-platform\database\flyway\manifest.json" goto :error
  if not exist "%ROOT%\technical-platform\database\flyway-overlays\oms\V94_1__bootstrap_tenant.sql" goto :error
  if not exist "%ROOT%\technical-platform\backend\modules\database-baseline\src\main\java\cn\shangjingu\platform\database\Phase03DatabaseMigrator.java" goto :error
  echo 中文路径数据库迁移脚本结构检查通过。
  exit /b 0
)

if not exist "%ROOT%\.env" (
  echo 缺少 .env。请先运行 install.bat，并配置本地安全凭据。
  goto :error
)
findstr /C:"__SET_LOCAL_" "%ROOT%\.env" >nul 2>&1
if not errorlevel 1 (
  echo .env 仍包含安全占位符，请先设置数据库角色密码和 tenant 部署事实。
  goto :error
)

for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%ROOT%\.env") do (
  if not "%%A"=="" set "%%A=%%B"
)

if not defined SJG_BOOTSTRAP_DB_URL set "SJG_BOOTSTRAP_DB_URL=jdbc:postgresql://localhost:%POSTGRES_PORT%/postgres"
if not defined SJG_BOOTSTRAP_DB_USERNAME set "SJG_BOOTSTRAP_DB_USERNAME=%POSTGRES_USER%"
if not defined SJG_BOOTSTRAP_DB_PASSWORD set "SJG_BOOTSTRAP_DB_PASSWORD=%POSTGRES_PASSWORD%"

call "%ROOT%\mvnw.cmd" -q -ntp -pl technical-platform/backend/modules/database-baseline -DskipTests compile org.codehaus.mojo:exec-maven-plugin:3.5.0:java -Dexec.mainClass=cn.shangjingu.platform.database.Phase03DatabaseMigrator -Dexec.classpathScope=runtime
if errorlevel 1 goto :error

echo 三库 Flyway migrate/validate/repeatability 已完成。
exit /b 0

:error
echo 数据库迁移失败，错误码 %ERRORLEVEL%。
exit /b 1
