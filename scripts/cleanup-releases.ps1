# 清理 GitHub Releases:只保留起点版本与最新版本,删除中间的过程版本(含对应 tag)。
#
# 用法(在仓库根目录的终端里):
#   pwsh -File scripts/cleanup-releases.ps1 -DryRun     # 先看会删哪些
#   pwsh -File scripts/cleanup-releases.ps1             # 真删
#
# 依赖:本机 git 已保存 GitHub 凭据(即平时 git push 不用输密码即可)。

[CmdletBinding()]
param(
  [string]$Repo = 'Justin-Emils/Eng',
  [string[]]$Keep = @('v1.0.0', 'v1.0.11'),
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$cred = "protocol=https`nhost=github.com`n`n" | git credential fill 2>$null
$token = ($cred | Where-Object { $_ -like 'password=*' }) -replace '^password=', ''
if (-not $token) {
  Write-Host '未取到 GitHub 凭据。请先随便执行一次 git push(或 git ls-remote)让 git 记下凭据,再重跑本脚本。' -ForegroundColor Yellow
  exit 1
}

$headers = @{
  Authorization          = "token $token"
  Accept                 = 'application/vnd.github+json'
  'User-Agent'           = 'article-reading-cleanup'
  'X-GitHub-Api-Version' = '2022-11-28'
}

function Get-Releases {
  $all = @()
  $page = 1
  while ($true) {
    $batch = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases?per_page=100&page=$page" -Headers $headers
    if (-not $batch -or $batch.Count -eq 0) { break }
    $all += $batch
    $page++
  }
  return $all
}

$releases = Get-Releases
if (-not $releases -or $releases.Count -eq 0) { Write-Host '没有找到任何 Release。'; exit 0 }

$latest = ($releases | Sort-Object { [datetime]$_.published_at } -Descending | Select-Object -First 1).tag_name
if ($Keep -notcontains $latest) { $Keep += $latest }
Write-Host ("保留:{0}" -f ($Keep -join ', ')) -ForegroundColor Cyan
Write-Host ''

$deleted = 0
foreach ($r in $releases) {
  if ($Keep -contains $r.tag_name) {
    Write-Host ("跳过 {0}  ({1})" -f $r.tag_name, $r.name) -ForegroundColor DarkGray
    continue
  }

  Write-Host ("删除 Release {0}  ({1})" -f $r.tag_name, $r.name) -ForegroundColor Yellow
  if (-not $DryRun) {
    Invoke-RestMethod -Method Delete -Uri "https://api.github.com/repos/$Repo/releases/$($r.id)" -Headers $headers | Out-Null
    # 顺带删掉对应 tag,否则仓库仍会残留这些版本点
    try {
      Invoke-RestMethod -Method Delete -Uri "https://api.github.com/repos/$Repo/git/refs/tags/$($r.tag_name)" -Headers $headers | Out-Null
    } catch {
      Write-Host ("  tag {0} 未删除或不存在:{1}" -f $r.tag_name, $_.Exception.Message) -ForegroundColor DarkYellow
    }
  }
  $deleted++
}

if ($DryRun) {
  Write-Host ''
  Write-Host ("[试运行] 将会删除 {0} 个 Release。去掉 -DryRun 即真正执行。" -f $deleted) -ForegroundColor Cyan
} else {
  Write-Host ''
  Write-Host ("完成:已删除 {0} 个 Release,保留 {1}。" -f $deleted, ($Keep -join ', ')) -ForegroundColor Green
}
