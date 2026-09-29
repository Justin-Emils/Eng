# 从启动屏动画里抠出角色,做成可复用的"形象"素材。
#
# 背景:`assets/anim/walk-blue.webp` 是 720x720 / 96 帧的角色行走动画,但**没有 alpha** ——
# 角色被合成在不透明的品牌蓝 RGB(30,137,237) 上(这个值之前逐像素量过:边框环上 100% 一致)。
# 所以它只能在启动屏那个同色底的场景里用,App 内部一次都用不了。
#
# 好消息:背景是**纯平色**,可以从像素里抠掉。做法:
#   1. 采样边框环拿到背景色 C;
#   2. 按"与 C 的通道最大差"分三档决定 alpha:
#        d <= 6        -> alpha 0(纯背景)
#        d >= 36       -> alpha 255(纯角色),颜色原样
#        中间          -> 半透明边缘:alpha 按 d 线性映射,
#                         并把颜色**反预乘**回真实色 X = C + (P - C) / alpha
#      (不做反预乘的话,边缘会留一圈蓝边,抠图常见的"蓝毛边")
#   3. 在若干关键帧上取姿势,裁到角色包围盒,输出 PNG。
#
# 这是**用户自己的素材**,不涉及第三方版权。
#
# 用法:& scripts/extract-mascot.ps1

param(
  [string]$Src = "E:\code\Eng\article-reading\assets\anim\walk-blue.webp",
  [string]$OutDir = "E:\code\Eng\article-reading\assets\mascot",
  [int]$Poses = 6,
  [int]$T0 = 6,
  [int]$T1 = 36
)

Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

function Get-Frame {
  param($dec, [int]$idx)
  $fr = $dec.Frames[$idx]
  $conv = New-Object System.Windows.Media.Imaging.FormatConvertedBitmap($fr, [System.Windows.Media.PixelFormats]::Bgra32, $null, 0)
  $w = $conv.PixelWidth
  $h = $conv.PixelHeight
  $s = $w * 4
  $buf = New-Object byte[] ($s * $h)
  $conv.CopyPixels($buf, $s, 0)
  return @{ buf = $buf; w = $w; h = $h; stride = $s }
}

$dec = [System.Windows.Media.Imaging.BitmapDecoder]::Create([Uri]$Src, 'None', 'OnLoad')
$n = $dec.Frames.Count
Write-Host ("源: " + [System.IO.Path]::GetFileName($Src) + "   帧数 " + $n)

$g0 = Get-Frame $dec 0
$W = $g0.w
$H = $g0.h
$buf0 = $g0.buf
$stride = $g0.stride

# ---- 1. 从边框环取背景色(用众数,避免被角色碰到边缘的少数像素带偏)
$counts = @{}
for ($x = 0; $x -lt $W; $x++) {
  foreach ($y in @(1, 3, ($H - 4), ($H - 2))) {
    $i = $y * $stride + $x * 4
    $k = "" + $buf0[$i + 2] + "," + $buf0[$i + 1] + "," + $buf0[$i]
    if ($counts.ContainsKey($k)) { $counts[$k] = $counts[$k] + 1 } else { $counts[$k] = 1 }
  }
}
$top = $counts.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 1
$parts = $top.Key -split ","
$bgR = [int]$parts[0]
$bgG = [int]$parts[1]
$bgB = [int]$parts[2]
Write-Host ("背景色 RGB(" + $bgR + "," + $bgG + "," + $bgB + ")  占边框环 " + [Math]::Round($top.Value * 100.0 / ($W * 4), 1) + "%")

# ---- 2. 粗略找角色包围盒(每 4 像素抽一个,够用了)
$minX = $W; $maxX = -1; $minY = $H; $maxY = -1
for ($y = 0; $y -lt $H; $y += 4) {
  for ($x = 0; $x -lt $W; $x += 4) {
    $i = $y * $stride + $x * 4
    $dr = [Math]::Abs([int]$buf0[$i + 2] - $bgR)
    $dg = [Math]::Abs([int]$buf0[$i + 1] - $bgG)
    $db = [Math]::Abs([int]$buf0[$i] - $bgB)
    $d = $dr
    if ($dg -gt $d) { $d = $dg }
    if ($db -gt $d) { $d = $db }
    if ($d -ge $T1) {
      if ($x -lt $minX) { $minX = $x }
      if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }
      if ($y -gt $maxY) { $maxY = $y }
    }
  }
}
if ($maxX -lt 0) { Write-Host "没找到角色(整帧都是背景色)"; exit 1 }

# 留出边距,并保证宽高一致,这样各姿势能对齐
$padX = 26
$padTop = 30
$padBottom = 34
$bx0 = [Math]::Max(0, $minX - $padX)
$bx1 = [Math]::Min($W - 1, $maxX + $padX)
$by0 = [Math]::Max(0, $minY - $padTop)
$by1 = [Math]::Min($H - 1, $maxY + $padBottom)
$cw = $bx1 - $bx0 + 1
$ch = $by1 - $by0 + 1
Write-Host ("角色包围盒 x" + $minX + "-" + $maxX + " y" + $minY + "-" + $maxY + "  裁切后 " + $cw + "x" + $ch)

# ---- 3. 取姿势帧
$step = [int][Math]::Floor($n / $Poses)
$chosen = @()
for ($p = 0; $p -lt $Poses; $p++) { $chosen += (($p * $step) % $n) }

$made = @()
foreach ($idx in $chosen) {
  $frame = Get-Frame $dec $idx
  $b = $frame.buf
  $s = $frame.stride

  $bmp = New-Object System.Drawing.Bitmap($cw, $ch, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $kept = 0
  for ($y = 0; $y -lt $ch; $y++) {
    $sy = $by0 + $y
    for ($x = 0; $x -lt $cw; $x++) {
      $sx = $bx0 + $x
      $i = $sy * $s + $sx * 4
      $pb = [int]$b[$i]
      $pg = [int]$b[$i + 1]
      $pr = [int]$b[$i + 2]

      $dr = [Math]::Abs($pr - $bgR)
      $dg = [Math]::Abs($pg - $bgG)
      $db = [Math]::Abs($pb - $bgB)
      $d = $dr
      if ($dg -gt $d) { $d = $dg }
      if ($db -gt $d) { $d = $db }

      if ($d -le $T0) {
        $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        continue
      }
      $kept++
      if ($d -ge $T1) {
        $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $pr, $pg, $pb))
      } else {
        $a = ($d - $T0) / [double]($T1 - $T0)
        $ai = [int][Math]::Round($a * 255)
        # 反预乘:把混进背景色的边缘还原成角色本身的颜色
        $rr = $bgR + ($pr - $bgR) / $a
        $gg = $bgG + ($pg - $bgG) / $a
        $bb = $bgB + ($pb - $bgB) / $a
        $ri = [int][Math]::Round($rr)
        $gi = [int][Math]::Round($gg)
        $bi = [int][Math]::Round($bb)
        if ($ri -gt 255) { $ri = 255 }
        if ($ri -lt 0) { $ri = 0 }
        if ($gi -gt 255) { $gi = 255 }
        if ($gi -lt 0) { $gi = 0 }
        if ($bi -gt 255) { $bi = 255 }
        if ($bi -lt 0) { $bi = 0 }
        $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($ai, $ri, $gi, $bi))
      }
    }
  }

  $name = "pose-" + ($idx.ToString("00")) + ".png"
  $path = Join-Path $OutDir $name
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  $made += @{ name = $name; idx = $idx; kept = $kept; path = $path }
  Write-Host ("  " + $name + "  帧 " + $idx + "  非背景像素 " + $kept + "  " + [Math]::Round((Get-Item $path).Length / 1024.0, 1) + " KB")
}

# ---- 4. 出一张核对图:深底 + 浅底各一行,方便看透明边缘有没有蓝毛边
$sheetW = $cw * $Poses
$sheetH = ($ch * 2) + 46
$sheet = New-Object System.Drawing.Bitmap($sheetW, $sheetH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$sg = [System.Drawing.Graphics]::FromImage($sheet)
$dark = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 12, 11, 10))
$light = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 244, 241, 248))
$crimson = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 118, 20, 40))
$sg.FillRectangle($dark, 0, 0, $sheetW, ($ch + 23))
$sg.FillRectangle($light, 0, ($ch + 23), $sheetW, ($ch + 23))
$sg.FillRectangle($crimson, 0, (($ch + 23) * 2), $sheetW, 46)
$sg.Dispose()

$ox = 0
foreach ($m in $made) {
  $img = [System.Drawing.Image]::FromFile($m.path)
  $gg2 = [System.Drawing.Graphics]::FromImage($sheet)
  $gg2.DrawImage($img, $ox, 0, $cw, $ch)
  $gg2.DrawImage($img, $ox, ($ch + 23), $cw, $ch)
  $gg2.DrawImage($img, $ox, (($ch + 23) * 2), $cw, $ch)
  $gg2.Dispose()
  $img.Dispose()
  $ox += $cw
}

$outRoot = Split-Path $OutDir -Parent
$outRoot = Split-Path $outRoot -Parent
$sheetPath = Join-Path $outRoot "docs\mockups\mascot-poses.png"
New-Item -ItemType Directory -Force -Path (Split-Path $sheetPath -Parent) | Out-Null
$sheet.Save($sheetPath, [System.Drawing.Imaging.ImageFormat]::Png)
$sheet.Dispose()
Write-Host ""
Write-Host ("核对图: " + $sheetPath)
Write-Host "完成。"
