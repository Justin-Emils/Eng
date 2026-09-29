# 参考图配色测量 v2:面积加权的真实色值 + 强调色族统计。
#
# v1 的两个问题:
#   1. 主色只报"量化桶中心"(如 #221133),那不是真实像素值,只是 4bit 桶的格点;
#   2. "最高饱和色"按**单个像素**取,会被面积极小的杂色带偏
#      (001 报出 #462900 就是个例子)。
# v2 改成:
#   · 主色按桶**累加真实 RGB 再求平均**,报出真实均值色;
#   · 强调色按**色相族**(每 15°)聚合,只统计 S>=0.30 且 V>=0.20 的像素,
#     报每个色族的面积加权均色、占全图比例、占饱和像素比例 —— 这才看得出
#     "哪个颜色是活动的强调色",而不是哪个像素偶然最艳。
#
# 用法:& scripts/analyze-reference.ps1 -Dir "E:\path\to\refs"

param(
  [string]$Dir = "E:\code\Eng\素材\揭幕者",
  [int]$Top = 12,
  [int]$MaxFiles = 12,
  [double]$SatMin = 0.30,
  [double]$ValMin = 0.20
)

Add-Type -AssemblyName PresentationCore

function Get-FrameBytes {
  param([string]$Path)
  $dec = [System.Windows.Media.Imaging.BitmapDecoder]::Create([Uri]$Path, 'None', 'OnLoad')
  $frame = $dec.Frames[0]
  $conv = New-Object System.Windows.Media.Imaging.FormatConvertedBitmap($frame, [System.Windows.Media.PixelFormats]::Bgra32, $null, 0)
  $w = $conv.PixelWidth
  $h = $conv.PixelHeight
  $stride = $w * 4
  $buf = New-Object byte[] ($stride * $h)
  $conv.CopyPixels($buf, $stride, 0)
  return @{ buf = $buf; w = $w; h = $h; stride = $stride }
}

function HexOf {
  param([double]$r, [double]$g, [double]$b)
  $ri = [int][Math]::Round($r)
  $gi = [int][Math]::Round($g)
  $bi = [int][Math]::Round($b)
  if ($ri -gt 255) { $ri = 255 }
  if ($ri -lt 0) { $ri = 0 }
  if ($gi -gt 255) { $gi = 255 }
  if ($gi -lt 0) { $gi = 0 }
  if ($bi -gt 255) { $bi = 255 }
  if ($bi -lt 0) { $bi = 0 }
  return ('#{0:x2}{1:x2}{2:x2}' -f $ri, $gi, $bi)
}

# 返回 HSL(h 0-360, s/l 0-1)
function HslOf {
  param([double]$r, [double]$g, [double]$b)
  $rn = $r / 255.0
  $gn = $g / 255.0
  $bn = $b / 255.0
  $mx = [Math]::Max($rn, [Math]::Max($gn, $bn))
  $mn = [Math]::Min($rn, [Math]::Min($gn, $bn))
  $l = ($mx + $mn) / 2
  $h = 0.0
  $s = 0.0
  if ($mx -ne $mn) {
    $d = $mx - $mn
    if ($l -gt 0.5) { $s = $d / (2 - $mx - $mn) } else { $s = $d / ($mx + $mn) }
    if ($mx -eq $rn) {
      $h = ($gn - $bn) / $d
      if ($gn -lt $bn) { $h = $h + 6 }
    } elseif ($mx -eq $gn) {
      $h = (($bn - $rn) / $d) + 2
    } else {
      $h = (($rn - $gn) / $d) + 4
    }
    $h = $h * 60
  }
  return @{ h = $h; s = $s; l = $l }
}

$files = @()
if (Test-Path -LiteralPath $Dir) {
  $files = Get-ChildItem -LiteralPath $Dir -File |
    Where-Object { $_.Extension -match '^\.(png|jpg|jpeg|webp|gif|bmp)$' } |
    Sort-Object Name | Select-Object -First $MaxFiles
}
if ($files.Count -eq 0) { Write-Host ("在 " + $Dir + " 下没找到图片。"); exit 1 }

Write-Host ("扫描: " + $Dir + "   共 " + $files.Count + " 张")
$outDir = Join-Path $Dir "palette-report"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$globalFamilies = @{}
$globalSatTotal = 0
$globalAllTotal = 0

foreach ($f in $files) {
  Write-Host ""
  Write-Host ("========== " + $f.Name + " ==========")
  try {
    $img = Get-FrameBytes -Path $f.FullName
  } catch {
    Write-Host ("  解码失败: " + $_.Exception.Message)
    continue
  }

  $buf = $img.buf
  $w = $img.w
  $h = $img.h
  $stride = $img.stride
  $step = 1
  while ((($w / $step) * ($h / $step)) -gt 500000) { $step = $step + 1 }

  $buckets = @{}
  $families = @{}
  $sampled = 0
  $dark = 0
  $satTotal = 0

  for ($y = 0; $y -lt $h; $y += $step) {
    for ($x = 0; $x -lt $w; $x += $step) {
      $i = $y * $stride + $x * 4
      $b = [int]$buf[$i]
      $g = [int]$buf[$i + 1]
      $r = [int]$buf[$i + 2]
      $sampled = $sampled + 1

      $k = (($r -shr 4) * 256 + ($g -shr 4) * 16 + ($b -shr 4))
      if ($buckets.ContainsKey($k)) {
        $e = $buckets[$k]
        $e.n = $e.n + 1
        $e.r = $e.r + $r
        $e.g = $e.g + $g
        $e.b = $e.b + $b
      } else {
        $buckets[$k] = @{ n = 1; r = [double]$r; g = [double]$g; b = [double]$b }
      }

      $lum = 0.2126 * $r + 0.7152 * $g + 0.0722 * $b
      if ($lum -lt 64) { $dark = $dark + 1 }

      $hsl = HslOf $r $g $b
      $v = [Math]::Max($r, [Math]::Max($g, $b)) / 255.0
      if ($hsl.s -ge $SatMin -and $v -ge $ValMin) {
        $satTotal = $satTotal + 1
        $hk = [int]([Math]::Floor($hsl.h / 15))
        if ($hk -ge 24) { $hk = 23 }
        if ($families.ContainsKey($hk)) {
          $e = $families[$hk]
          $e.n = $e.n + 1
          $e.r = $e.r + $r
          $e.g = $e.g + $g
          $e.b = $e.b + $b
        } else {
          $families[$hk] = @{ n = 1; r = [double]$r; g = [double]$g; b = [double]$b }
        }
        if ($globalFamilies.ContainsKey($hk)) {
          $e = $globalFamilies[$hk]
          $e.n = $e.n + 1
          $e.r = $e.r + $r
          $e.g = $e.g + $g
          $e.b = $e.b + $b
        } else {
          $globalFamilies[$hk] = @{ n = 1; r = [double]$r; g = [double]$g; b = [double]$b }
        }
        $globalSatTotal = $globalSatTotal + 1
      }
      $globalAllTotal = $globalAllTotal + 1
    }
  }

  $darkPct = [Math]::Round($dark * 100 / $sampled, 1)
  Write-Host ("  尺寸 " + $w + "x" + $h + "   抽样 " + $sampled + "   暗部 " + $darkPct + "%")

  Write-Host "  主色(面积加权真实均值):"
  $topEntries = $buckets.GetEnumerator() | Sort-Object { -$_.Value.n } | Select-Object -First $Top
  $swatches = @()
  foreach ($t in $topEntries) {
    $e = $t.Value
    $ar = $e.r / $e.n
    $ag = $e.g / $e.n
    $ab = $e.b / $e.n
    $pct = [Math]::Round($e.n * 100 / $sampled, 2)
    Write-Host ("    " + (HexOf $ar $ag $ab) + "   " + $pct + "%")
    $swatches += @{ r = [int][Math]::Round($ar); g = [int][Math]::Round($ag); b = [int][Math]::Round($ab) }
  }

  if ($satTotal -gt 0) {
    Write-Host ("  强调色族(S>=" + $SatMin + ", 占全图 " + [Math]::Round($satTotal * 100 / $sampled, 2) + "%):")
    $famTop = $families.GetEnumerator() | Sort-Object { -$_.Value.n } | Select-Object -First 6
    foreach ($t in $famTop) {
      $e = $t.Value
      $ar = $e.r / $e.n
      $ag = $e.g / $e.n
      $ab = $e.b / $e.n
      $hk = [int]$t.Key
      Write-Host ("    " + ($hk * 15) + "-" + (($hk + 1) * 15) + "°   " + (HexOf $ar $ag $ab) + "   占全图 " + [Math]::Round($e.n * 100 / $sampled, 2) + "%   占饱和 " + [Math]::Round($e.n * 100 / $satTotal, 1) + "%")
    }
  } else {
    Write-Host "  强调色族:无"
  }

  try {
    Add-Type -AssemblyName System.Drawing -ErrorAction Stop
    $barW = 120
    $barH = 46
    $bmp = New-Object System.Drawing.Bitmap(($barW * $swatches.Count), $barH)
    $gr = [System.Drawing.Graphics]::FromImage($bmp)
    $gr.Clear([System.Drawing.Color]::FromArgb(11, 10, 9))
    for ($k = 0; $k -lt $swatches.Count; $k++) {
      $sw = $swatches[$k]
      $br = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($sw.r, $sw.g, $sw.b))
      $gr.FillRectangle($br, ($k * $barW), 0, ($barW - 2), $barH)
      $br.Dispose()
    }
    $gr.Dispose()
    $bmp.Save((Join-Path $outDir ($f.BaseName + "-palette.png")), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
  } catch {
    Write-Host "  (System.Drawing 不可用,跳过色板出图)"
  }
}

Write-Host ""
Write-Host ("========== " + $files.Count + " 张汇总:强调色族 ==========")
Write-Host ("饱和像素占全部抽样 " + [Math]::Round($globalSatTotal * 100 / $globalAllTotal, 2) + "%")
$famAll = $globalFamilies.GetEnumerator() | Sort-Object { -$_.Value.n }
foreach ($t in $famAll) {
  $e = $t.Value
  $ar = $e.r / $e.n
  $ag = $e.g / $e.n
  $ab = $e.b / $e.n
  $pctAll = [Math]::Round($e.n * 100 / $globalAllTotal, 2)
  $pctSat = [Math]::Round($e.n * 100 / $globalSatTotal, 1)
  if ($pctSat -lt 1) { continue }
  $hk = [int]$t.Key
  Write-Host ("  " + ($hk * 15) + "-" + (($hk + 1) * 15) + "°   " + (HexOf $ar $ag $ab) + "   占全图 " + $pctAll + "%   占饱和 " + $pctSat + "%")
}
Write-Host ""
Write-Host "色板 PNG 在 palette-report 下。"
