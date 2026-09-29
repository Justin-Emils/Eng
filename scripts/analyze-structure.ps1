# 参考图**结构量化**:不需要视觉模型,从像素里量出界面的几何节奏。
#
# 能可靠量出来的(纯统计,不是语义):
#   · 分隔线/边框的**粗细**(像素)以及占图宽的比例 —— 直接对应到 App 里该用几 dp;
#   · 水平/垂直分隔线的**位置分布** —— 反映布局网格与栏高;
#   · 正文带的**行高与行间距** —— 反映字号层级与排版节奏;
#   · 文字/线条的**笔画宽度**(游程中位数) —— 反映线重;
#   · 内容**留白边距**(上下左右占图比例);
#   · 高频能量(噪点/纹理的有无)。
#
# 量不出来的:角标是什么形状、字体家族、装饰母题是什么 —— 那是语义,需要视觉模型或人。
#
# 用法:& scripts/analyze-structure.ps1 -Dir "E:\code\Eng\素材\揭幕者"

param(
  [string]$Dir = "E:\code\Eng\素材\揭幕者",
  [int]$MaxFiles = 12
)

Add-Type -AssemblyName PresentationCore

function Get-Gray {
  param([string]$Path, [int]$MaxDim = 900)
  $dec = [System.Windows.Media.Imaging.BitmapDecoder]::Create([Uri]$Path, 'None', 'OnLoad')
  $frame = $dec.Frames[0]
  $conv = New-Object System.Windows.Media.Imaging.FormatConvertedBitmap($frame, [System.Windows.Media.PixelFormats]::Bgra32, $null, 0)
  $w0 = $conv.PixelWidth
  $h0 = $conv.PixelHeight
  $stride0 = $w0 * 4
  $buf0 = New-Object byte[] ($stride0 * $h0)
  $conv.CopyPixels($buf0, $stride0, 0)

  $step = 1
  $mx = [Math]::Max($w0, $h0)
  while (($mx / $step) -gt $MaxDim) { $step = $step + 1 }

  $w = [int]($w0 / $step)
  $h = [int]($h0 / $step)
  $gray = New-Object 'double[]' ($w * $h)
  for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
      $i = ($y * $step) * $stride0 + ($x * $step) * 4
      $b = [double]$buf0[$i]
      $g = [double]$buf0[$i + 1]
      $r = [double]$buf0[$i + 2]
      $gray[($y * $w) + $x] = 0.2126 * $r + 0.7152 * $g + 0.0722 * $b
    }
  }
  return @{ gray = $gray; w = $w; h = $h; ow = $w0; oh = $h0; step = $step }
}

function Median {
  param($arr)
  if ($arr.Count -eq 0) { return 0 }
  $s = $arr | Sort-Object
  return $s[[int]($s.Count / 2)]
}

function AnalyzeStructure {
  param($img)

  $gray = $img.gray
  $w = $img.w
  $h = $img.h

  # 全局阈值:亮像素 = 前景(深色界面的线条与文字)
  $all = New-Object System.Collections.Generic.List[double]
  for ($y = 0; $y -lt $h; $y += 2) {
    for ($x = 0; $x -lt $w; $x += 2) { $all.Add($gray[($y * $w) + $x]) }
  }
  $sorted = $all | Sort-Object
  $p70 = $sorted[[int]($sorted.Count * 0.70)]
  $p90 = $sorted[[int]($sorted.Count * 0.90)]
  $p50 = $sorted[[int]($sorted.Count * 0.50)]

  # 行/列的前景计数
  $rowInk = New-Object 'int[]' $h
  for ($y = 0; $y -lt $h; $y++) {
    $c = 0
    for ($x = 0; $x -lt $w; $x++) { if ($gray[($y * $w) + $x] -gt $p70) { $c = $c + 1 } }
    $rowInk[$y] = $c
  }
  $colInk = New-Object 'int[]' $w
  for ($x = 0; $x -lt $w; $x++) {
    $c = 0
    for ($y = 0; $y -lt $h; $y++) { if ($gray[($y * $w) + $x] -gt $p70) { $c = $c + 1 } }
    $colInk[$x] = $c
  }

  # 贯通式分隔线:该行前景占宽 > 55%
  $hLines = @()
  $run = 0
  for ($y = 0; $y -lt $h; $y++) {
    if ($rowInk[$y] -gt ($w * 0.55)) { $run = $run + 1 }
    else {
      if ($run -gt 0) { $hLines += @{ y = ($y - $run); t = $run } }
      $run = 0
    }
  }
  if ($run -gt 0) { $hLines += @{ y = ($h - $run); t = $run } }

  $vLines = @()
  $run = 0
  for ($x = 0; $x -lt $w; $x++) {
    if ($colInk[$x] -gt ($h * 0.55)) { $run = $run + 1 }
    else {
      if ($run -gt 0) { $vLines += @{ x = ($x - $run); t = $run } }
      $run = 0
    }
  }
  if ($run -gt 0) { $vLines += @{ x = ($w - $run); t = $run } }

  # 文字带:行前景占比在 3%–45% 之间,且连续
  $bands = @()
  $run = 0
  $start = 0
  for ($y = 0; $y -lt $h; $y++) {
    $r = $rowInk[$y] / $w
    if ($r -gt 0.03 -and $r -lt 0.45) {
      if ($run -eq 0) { $start = $y }
      $run = $run + 1
    } else {
      if ($run -ge 3) { $bands += @{ y = $start; t = $run } }
      $run = 0
    }
  }
  if ($run -ge 3) { $bands += @{ y = $start; t = $run } }

  # 笔画宽度:在文字带里沿 x 找连续亮游程的中位数
  $runs = New-Object System.Collections.Generic.List[int]
  foreach ($b in ($bands | Select-Object -First 40)) {
    for ($y = $b.y; $y -lt ($b.y + $b.t); $y++) {
      $c = 0
      for ($x = 0; $x -lt $w; $x++) {
        if ($gray[($y * $w) + $x] -gt $p90) { $c = $c + 1 }
        else { if ($c -gt 0) { $runs.Add($c); $c = 0 } }
      }
      if ($c -gt 0) { $runs.Add($c) }
    }
  }

  # 内容边距:前景像素的最小/最大行列
  $minX = $w; $maxX = -1; $minY = $h; $maxY = -1
  for ($y = 0; $y -lt $h; $y++) {
    if ($rowInk[$y] -gt 1) {
      if ($y -lt $minY) { $minY = $y }
      if ($y -gt $maxY) { $maxY = $y }
    }
  }
  for ($x = 0; $x -lt $w; $x++) {
    if ($colInk[$x] -gt 1) {
      if ($x -lt $minX) { $minX = $x }
      if ($x -gt $maxX) { $maxX = $x }
    }
  }

  # 高频能量:相邻像素差的均值(噪点/纹理的粗略指标)
  $hf = 0.0
  $n = 0
  for ($y = 0; $y -lt $h; $y += 2) {
    for ($x = 0; $x -lt ($w - 1); $x += 2) {
      $hf = $hf + [Math]::Abs($gray[($y * $w) + $x + 1] - $gray[($y * $w) + $x])
      $n = $n + 1
    }
  }

  return @{
    w = $w; h = $h; ow = $img.ow; oh = $img.oh; step = $img.step
    p50 = $p50; p70 = $p70; p90 = $p90
    hLines = $hLines; vLines = $vLines; bands = $bands
    stroke = (Median $runs); strokeN = $runs.Count
    minX = $minX; maxX = $maxX; minY = $minY; maxY = $maxY
    hf = ($hf / [Math]::Max(1, $n))
  }
}

$files = @()
if (Test-Path -LiteralPath $Dir) {
  $files = Get-ChildItem -LiteralPath $Dir -File |
    Where-Object { $_.Extension -match '^\.(png|jpg|jpeg|webp|gif|bmp)$' } |
    Sort-Object Name | Select-Object -First $MaxFiles
}
if ($files.Count -eq 0) { Write-Host ("在 " + $Dir + " 下没找到图片。"); exit 1 }

Write-Host ("结构量化: " + $Dir + "   共 " + $files.Count + " 张")
Write-Host ("(分析分辨率压到长边 <=900,比例仍按原图归一)")
Write-Host ""

foreach ($f in $files) {
  Write-Host ("========== " + $f.Name + " ==========")
  try { $img = Get-Gray -Path $f.FullName } catch { Write-Host ("  解码失败: " + $_.Exception.Message); continue }
  $s = AnalyzeStructure -img $img

  Write-Host ("  原图 " + $s.ow + "x" + $s.oh + "   分析 " + $s.w + "x" + $s.h + " (每 " + $s.step + " px 取 1)")
  Write-Host ("  亮度分位 P50=" + [int]$s.p50 + " P70=" + [int]$s.p70 + " P90=" + [int]$s.p90)

  Write-Host ("  水平贯通线: " + $s.hLines.Count + " 条")
  foreach ($l in ($s.hLines | Select-Object -First 6)) {
    $pctW = [Math]::Round($l.t * 100.0 / $s.h, 3)
    Write-Host ("    y=" + $l.y + " (" + [Math]::Round($l.y * 100.0 / $s.h, 1) + "% 处)  厚 " + $l.t + "px   [占高 " + $pctW + "%]")
  }
  Write-Host ("  垂直贯通线: " + $s.vLines.Count + " 条")
  foreach ($l in ($s.vLines | Select-Object -First 6)) {
    Write-Host ("    x=" + $l.x + " (" + [Math]::Round($l.x * 100.0 / $s.w, 1) + "% 处)  厚 " + $l.t + "px")
  }

  Write-Host ("  文字/内容带: " + $s.bands.Count + " 段")
  foreach ($b in ($s.bands | Select-Object -First 10)) {
    Write-Host ("    y=" + $b.y + " 高 " + $b.t + "px  [占高 " + [Math]::Round($b.t * 100.0 / $s.h, 2) + "%]")
  }

  if ($s.strokeN -gt 0) {
    Write-Host ("  笔画游程中位数 " + $s.stroke + "px (样本 " + $s.strokeN + ")  —— 线重/字重的粗略指标")
  } else {
    Write-Host "  笔画游程:样本不足"
  }

  $ml = [Math]::Round($s.minX * 100.0 / $s.w, 1)
  $mr = [Math]::Round(($s.w - $s.maxX) * 100.0 / $s.w, 1)
  $mt = [Math]::Round($s.minY * 100.0 / $s.h, 1)
  $mb = [Math]::Round(($s.h - $s.maxY) * 100.0 / $s.h, 1)
  Write-Host ("  内容边距 左 " + $ml + "%  右 " + $mr + "%  上 " + $mt + "%  下 " + $mb + "%")
  Write-Host ("  高频能量 " + [Math]::Round($s.hf, 2) + " (噪点/纹理的粗略指标,越大越花)")
  Write-Host ""
}
