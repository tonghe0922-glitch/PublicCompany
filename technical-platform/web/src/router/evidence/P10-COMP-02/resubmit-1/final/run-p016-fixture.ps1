param(
    [Parameter(Mandatory = $true)][string]$Tenant,
    [Parameter(Mandatory = $true)][string]$Login,
    [Parameter(Mandatory = $true)][string]$Password
)

$env:PHASE11_P016_TENANT = $Tenant
$env:PHASE11_P016_LOGIN = $Login
$env:PHASE11_P016_PASSWORD = $Password
Set-Location -LiteralPath 'I:\PublicCompany_source_codex'
& .\mvnw.cmd -pl technical-platform/backend/apps/api -DskipTests '-Dexec.classpathScope=test' '-Dexec.mainClass=cn.shangjingu.platform.api.Phase11P016BrowserBackendFixture' org.codehaus.mojo:exec-maven-plugin:3.6.3:java
exit $LASTEXITCODE
