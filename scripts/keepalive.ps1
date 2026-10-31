<#
  Supabase 保活脚本
  ------------------------------------------------------------------
  为什么需要:免费项目约 7 天无活动会被暂停,暂停后域名停止解析,
  App 就直接报「连不上云端服务」。这个脚本每跑一次都算一次活动。

  怎么跑:
    · 手动:右键「使用 PowerShell 运行」,或
      powershell -NoProfile -ExecutionPolicy Bypass -File scripts\keepalive.ps1
    · 自动:计划任务(见 docs/backend-ops.md),建议每天一次

  说明:/auth/v1/health 需要 apikey 头(publishable key 公开无害),
  返回 200 即表示项目活着。日志写到 .artifacts/keepalive.log。
#>

$ErrorActionPreference = 'Stop'
$base = 'https://saqgqexmcrygpyyndknt.supabase.co'
$key = 'sb_publishable_cwDnleuQwfo4O1igX5sBnw_gh4QwvY6'
$log = Join-Path $PSScriptRoot '..\.artifacts\keepalive.log'
$logDir = Split-Path $log -Parent
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }

$stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
try {
  $res = Invoke-WebRequest -Uri "$base/auth/v1/health" -Headers @{ apikey = $key } -TimeoutSec 30 -UseBasicParsing
  $line = "$stamp  OK   HTTP $($res.StatusCode)"
} catch {
  $line = "$stamp  FAIL $($_.Exception.Message)"
}
$line | Add-Content -Path $log -Encoding utf8
Write-Output $line