@echo off
setlocal EnableExtensions
chcp 65001 >nul
set "CI_MODE=0"
if /I "%~1"=="--ci" set "CI_MODE=1"
for %%I in ("%~dp0..\..") do set "ROOT=%%~fI"
cd /d "%ROOT%" || goto :error

echo [1/5] Java 21 / Maven smoke tests...
java -version 2>&1 | findstr /R /C:"version \"21[\.]" >nul || goto :error
if "%CI_MODE%"=="1" (
  call "%ROOT%\mvnw.cmd" -B -ntp -pl technical-platform/backend/apps/api,technical-platform/backend/apps/worker -am test || goto :error
) else (
  call "%ROOT%\mvnw.cmd" -B -ntp test || goto :error
)

echo [2/5] pnpm 锁文件安装...
call corepack enable || goto :error
call corepack prepare pnpm@10.34.0 --activate || goto :error
pushd "%ROOT%\technical-platform\web" || goto :error
call pnpm install --frozen-lockfile || (popd & goto :error)

echo [3/5] TypeScript / Vue 类型检查与单测...
call pnpm typecheck || (popd & goto :error)
call pnpm test || (popd & goto :error)

echo [4/5] Work / Tech 双端构建...
call pnpm build || (popd & goto :error)
popd

echo [5/5] Compose 配置检查...
if "%CI_MODE%"=="0" (
  where docker >nul 2>&1 || goto :error
  docker compose --env-file "%ROOT%\.env.example" -f "%ROOT%\docker\compose\docker-compose.dev.yml" config >nul || goto :error
)

echo 自检通过。
if "%CI_MODE%"=="1" exit /b 0
pause
exit /b 0

:error
echo 自检失败，错误码 %ERRORLEVEL%。
if "%CI_MODE%"=="1" exit /b 1
pause
exit /b 1
