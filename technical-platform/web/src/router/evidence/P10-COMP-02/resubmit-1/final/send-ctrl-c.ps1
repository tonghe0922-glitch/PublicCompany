param([Parameter(Mandatory = $true)][int]$TargetProcessId)

Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class ConsoleSignal {
    [DllImport("kernel32.dll", SetLastError = true)] public static extern bool FreeConsole();
    [DllImport("kernel32.dll", SetLastError = true)] public static extern bool AttachConsole(uint processId);
    [DllImport("kernel32.dll", SetLastError = true)] public static extern bool GenerateConsoleCtrlEvent(uint ctrlEvent, uint processGroupId);
    [DllImport("kernel32.dll", SetLastError = true)] public static extern bool SetConsoleCtrlHandler(IntPtr handler, bool add);
}
'@

[ConsoleSignal]::FreeConsole() | Out-Null
if (-not [ConsoleSignal]::AttachConsole([uint32]$TargetProcessId)) {
    throw "ATTACH_CONSOLE_FAILED:$([Runtime.InteropServices.Marshal]::GetLastWin32Error())"
}
[ConsoleSignal]::SetConsoleCtrlHandler([IntPtr]::Zero, $true) | Out-Null
if (-not [ConsoleSignal]::GenerateConsoleCtrlEvent(0, 0)) {
    throw "CTRL_C_FAILED:$([Runtime.InteropServices.Marshal]::GetLastWin32Error())"
}
Start-Sleep -Seconds 2
[ConsoleSignal]::FreeConsole() | Out-Null
