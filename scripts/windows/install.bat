@echo off
setlocal EnableExtensions
chcp 65001 >nul
set "CI_MODE=0"
if /I "%~1"=="--ci" set "CI_MODE=1"
for %%I in ("%~dp0..\..") do set "ROOT=%%~fI"
cd /d "%ROOT%" || goto :error

echo [1/3] 验证并安装 Java/Maven 依赖...
call "%ROOT%\mvnw.cmd" -B -ntp -DskipTests install || goto :error

echo [2/3] 激活 pnpm 10.34.0...
where corepack >nul 2>&1 || goto :error
call corepack enable || goto :error
call corepack prepare pnpm@10.34.0 --activate || goto :error

echo [3/3] 安装前端锁定依赖...
pushd "%ROOT%\technical-platform\web" || goto :error
call pnpm install --frozen-lockfile
set "RC=%ERRORLEVEL%"
popd
if not "%RC%"=="0" goto :error

if not exist "%ROOT%\.env" (
  copy /Y "%ROOT%\.env.example" "%ROOT%\.env" >nul || goto :error
  echo 已创建 .env，请先替换其中所有 __SET_LOCAL_*__ 安全占位后再启动。
)

echo 安装检查完成。
if "%CI_MODE%"=="1" exit /b 0
pause
exit /b 0

:error
echo 安装失败，错误码 %ERRORLEVEL%。
if "%CI_MODE%"=="1" exit /b 1
pause
exit /b 1
