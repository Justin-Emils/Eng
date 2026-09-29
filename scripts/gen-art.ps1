# 原创美术资源生成器。
#
# 为什么要有它:早先的"纹样"其实是**拿现成零件凑的** —— 四角星是字体里的 ✦ 字形,
# 括号是四条 border,封面是几个色块叠圆。那不是美术,是拼装。
#
# 这个脚本用真正的 2D 绘制管线把素材**画**出来:
#   · GraphicsPath + 三次贝塞尔 —— 真实曲线(四角星的凹边、爆炸星芒、括号的斜切);
#   · AntiAlias + 高质量合成 —— 边缘干净;
#   · LinearGradientBrush —— 渐变;
#   · 网点/斜纹/噪点 —— 分别作为可平铺的纹理输出;
#   · CompositingMode.SourceCopy + 透明多边形 —— 真正的"缺口/撕裂"边缘。
#
# 只借参考里的**构图规律**(四角星、四角括号、斜切条、半调、金线框),
# 不复制它的任何具体造型 —— 立绘、Logo、图标一律不做。
#
# 输出到 assets/art/。饰件一律是**纯白 + alpha 的遮罩**,运行时用 tintColor 上色,
# 所以同一张素材能跟着主题变色。
#
# 用法:& scripts/gen-art.ps1

param(
  [string]$OutDir = "E:\code\Eng\article-reading\assets\art"
)

Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$TAU = [Math]::PI * 2
function Deg([double]$d) { return $d * [Math]::PI / 180.0 }

function New-Canvas {
  param([int]$w, [int]$h)
  $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)
  return @{ bmp = $bmp; g = $g }
}

function Save-Png {
  param($canvas, [string]$name)
  $canvas.g.Dispose()
  $path = Join-Path $OutDir $name
  $canvas.bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $canvas.bmp.Dispose()
  $len = (Get-Item -LiteralPath $path).Length
  Write-Host ("  " + $name.PadRight(22) + [Math]::Round($len / 1024.0, 1).ToString().PadLeft(7) + " KB")
}

function New-Brush {
  param([int]$a, [int]$r, [int]$g, [int]$b)
  return New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($a, $r, $g, $b))
}

# 四角星:四个尖角在上下左右,四条边用三次贝塞尔向内凹。
# 这是"凹边"星 —— 用矩形/菱形拼不出来,必须走曲线。
function New-Star4Path {
  param([double]$cx, [double]$cy, [double]$R, [double]$pull)
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $tips = New-Object 'System.Collections.Generic.List[object]'
  # 先算成标量再组装 —— PowerShell 5.1 解析不了"方法调用参数里嵌数组表达式"
  for ($k = 0; $k -lt 4; $k++) {
    $deg = 270 + 90 * $k
    $rad = Deg($deg)
    $tx = $cx + $R * [Math]::Cos($rad)
    $ty = $cy + $R * [Math]::Sin($rad)
    $row = @($tx, $ty)
    $tips.Add($row)
  }
  for ($k = 0; $k -lt 4; $k++) {
    $deg1 = 270 + 90 * $k
    $deg2 = 270 + 90 * $k + 45
    $rad1 = Deg($deg1)
    $rad2 = Deg($deg2)
    $rowA = $tips[$k]
    $nxt = ($k + 1) % 4
    $rowB = $tips[$nxt]
    $x1 = [single]$rowA[0]
    $y1 = [single]$rowA[1]
    $x2 = [single]$rowB[0]
    $y2 = [single]$rowB[1]
    $c1x = [single]($cx + $pull * [Math]::Cos($rad2))
    $c1y = [single]($cy + $pull * [Math]::Sin($rad2))
    $p.AddBezier($x1, $y1, $c1x, $c1y, $c1x, $c1y, $x2, $y2)
  }
  $p.CloseFigure()
  return $p
}

# 爆炸星芒:尖角与内凹点交替的多角形,带一点随机粗细,像"火花"
function New-BurstPath {
  param([double]$cx, [double]$cy, [double]$outerR, [double]$innerR, [int]$spikes)
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $n = $spikes * 2
  $prevX = 0.0
  $prevY = 0.0
  for ($i = 0; $i -lt $n; $i++) {
    $a = Deg(360.0 * $i / $n - 90)
    $rad = $outerR
    if ($i % 2 -eq 1) { $rad = $innerR }
    $x = [single]($cx + $rad * [Math]::Cos($a))
    $y = [single]($cy + $rad * [Math]::Sin($a))
    if ($i -eq 0) {
      $prevX = $x
      $prevY = $y
    } else {
      $p.AddLine([single]$prevX, [single]$prevY, $x, $y)
      $prevX = $x
      $prevY = $y
    }
  }
  $a0 = Deg(-90)
  $p.AddLine([single]$prevX, [single]$prevY, [single]($cx + $outerR * [Math]::Cos($a0)), [single]($cy + $outerR * [Math]::Sin($a0)))
  $p.CloseFigure()
  return $p
}

Write-Host "生成原创美术资源 -> $OutDir"
Write-Host ""

# ---------------------------------------------------------------- 1. 四角星
$c = New-Canvas 256 256
$path = New-Star4Path 128 128 118 56
$br = New-Brush 255 255 255 255
$c.g.FillPath($br, $path)
$br.Dispose()
$path.Dispose()
Save-Png $c "star4.png"

# ---------------------------------------------------------------- 2. 爆炸星芒
$c = New-Canvas 256 256
$path = New-BurstPath 128 128 124 46 16
$br = New-Brush 255 255 255 255
$c.g.FillPath($br, $path)
$br.Dispose()
$path.Dispose()
Save-Png $c "starburst.png"

# ---------------------------------------------------------------- 3. 角括号(单角)
# L 形,末端斜切,内角带一道小台阶 —— 比四条 border 有细节
$c = New-Canvas 64 64
$p = New-Object System.Drawing.Drawing2D.GraphicsPath
$p.AddLine(6, 44, 6, 6)
$p.AddLine(6, 6, 44, 6)
$p.AddLine(44, 6, 44, 12)
$p.AddLine(44, 12, 12, 12)
$p.AddLine(12, 12, 12, 44)
$p.CloseFigure()
$br = New-Brush 255 255 255 255
$c.g.FillPath($br, $p)
$br.Dispose()
$p.Dispose()
Save-Png $c "bracket.png"

# ---------------------------------------------------------------- 4. 分隔线饰
# 两端收细的横线 + 中间一枚小四角星 + 两侧短横
$c = New-Canvas 480 48
$cy = 24.0
$br = New-Brush 235 255 255 255
$star = New-Star4Path 240 24 19 9
$c.g.FillPath($br, $star)
$star.Dispose()
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(235, 255, 255, 255), 1.7)
# 左右各画一条:由粗到细用三段拼出收尾
foreach ($dir in @(-1, 1)) {
  $x0 = 240 + $dir * 34
  $x1 = 240 + $dir * 150
  $c.g.DrawLine($pen, [single]$x0, [single]$cy, [single]$x1, [single]$cy)
  $pen2 = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(120, 255, 255, 255), 1.0)
  $c.g.DrawLine($pen2, [single]$x1, [single]$cy, [single]($240 + $dir * 214), [single]$cy)
  $pen2.Dispose()
}
$pen.Dispose()
$br.Dispose()
Save-Png $c "rule.png"

# ---------------------------------------------------------------- 5. 半调网点(可平铺)
$c = New-Canvas 32 32
$br = New-Brush 210 255 255 255
foreach ($pt in @(@(8, 8), @(24, 8), @(8, 24), @(24, 24))) {
  $c.g.FillEllipse($br, [single]($pt[0] - 2.2), [single]($pt[1] - 2.2), [single]4.4, [single]4.4)
}
$br.Dispose()
Save-Png $c "halftone.png"

# ---------------------------------------------------------------- 6. 斜细纹(可平铺)
# 16x16 一个周期的 45° 细线。
# alpha 只给 64:这是**纹理**,不是线 —— 满 alpha 铺上去会和画面打架(见 plate-b 第一版)。
# 要用得重一点时在渲染端叠透明度,而不是把素材本身做死。
$c = New-Canvas 16 16
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(64, 255, 255, 255), 1.0)
$c.g.DrawLine($pen, [single](-16), [single](-16), [single]32, [single]32)
$pen.Dispose()
Save-Png $c "pinstripe.png"

# ---------------------------------------------------------------- 7. 颗粒噪点(可平铺)
$c = New-Canvas 64 64
$rnd = New-Object System.Random(20260921)
for ($y = 0; $y -lt 64; $y++) {
  for ($x = 0; $x -lt 64; $x++) {
    $a = $rnd.Next(0, 30)
    if ($a -gt 4) {
      $c.bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($a, 255, 255, 255))
    }
  }
}
Save-Png $c "grain.png"

# ------------------------------------------------------- 8. 封面版 A:丝绒 + 金色纹章
$W = 720
$H = 440
$c = New-Canvas $W $H
$rect = New-Object System.Drawing.Rectangle(0, 0, $W, $H)
$lg = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, [System.Drawing.Color]::FromArgb(255, 34, 22, 58), [System.Drawing.Color]::FromArgb(255, 12, 10, 24), 60.0)
$c.g.FillRectangle($lg, $rect)
$lg.Dispose()

# 左下同心弧(金线,只画弧段)
for ($i = 0; $i -lt 3; $i++) {
  $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(245, 226, 176, 104), 2.0)
  $r = 210 + $i * 26
  $c.g.DrawArc($pen, [single](30 - $r), [single]($H - 40 - $r), [single]($r * 2), [single]($r * 2), [single]268, [single]64)
  $pen.Dispose()
}

# 半调网点块(右上,低调)
$ht = [System.Drawing.Image]::FromFile((Join-Path $OutDir "halftone.png"))
$c.g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
$ia = New-Object System.Drawing.Imaging.ImageAttributes
$cm = New-Object System.Drawing.Imaging.ColorMatrix
$cm.Matrix33 = 0.55
$ia.SetColorMatrix($cm)
$destRect = New-Object System.Drawing.Rectangle(430, 20, 260, 180)
$c.g.DrawImage($ht, $destRect, 0, 0, $ht.Width, $ht.Height, [System.Drawing.GraphicsUnit]::Pixel, $ia)
$ia.Dispose()
$ht.Dispose()

# 中央四角星(金)
$br = New-Brush 250 232 182 106
$star = New-Star4Path 360 206 122 58
$c.g.FillPath($br, $star)
$star.Dispose()
$br.Dispose()

# 内金线框 + 四角括号
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(150, 226, 176, 104), 1.0)
$c.g.DrawRectangle($pen, 14, 14, ($W - 28), ($H - 28))
$pen.Dispose()
$bk = [System.Drawing.Image]::FromFile((Join-Path $OutDir "bracket.png"))
$brushes = @(
  @{ x = 8; y = 8; rot = 0 },
  @{ x = ($W - 72); y = 8; rot = 90 },
  @{ x = ($W - 72); y = ($H - 72); rot = 180 },
  @{ x = 8; y = ($H - 72); rot = 270 }
)
foreach ($b in $brushes) {
  $c.g.TranslateTransform($b.x, $b.y)
  $c.g.RotateTransform($b.rot)
  $c.g.DrawImage($bk, 0, 0)
  $c.g.ResetTransform()
}
$bk.Dispose()

# 右下角撕口:用 SourceCopy 把一块透明多边形"挖掉"
$c.g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
$hole = New-Object System.Drawing.Drawing2D.GraphicsPath
$hole.AddLine($W, 330, ($W - 92), $H)
$hole.AddLine(($W - 92), $H, $W, $H)
$hole.CloseFigure()
$clear = New-Brush 0 0 0 0
$c.g.FillPath($clear, $hole)
$clear.Dispose()
$hole.Dispose()
$c.g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
Save-Png $c "plate-a.png"

# ------------------------------------------------------- 9. 封面版 B:深红 + 斜切条 + 星芒
$c = New-Canvas $W $H
$lg = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, [System.Drawing.Color]::FromArgb(255, 118, 20, 40), [System.Drawing.Color]::FromArgb(255, 34, 8, 18), 110.0)
$c.g.FillRectangle($lg, $rect)
$lg.Dispose()

# 斜细纹叠加:只压**下三分之一**,不是整幅铺满。
# 第一版铺满之后整个版面变成斜纹墙,和中间的斜切条互相打架 ——
# 纹理要用在"局部气氛"上,不能当成背景底色。
$ps = [System.Drawing.Image]::FromFile((Join-Path $OutDir "pinstripe.png"))
$tb = New-Object System.Drawing.TextureBrush($ps, [System.Drawing.Drawing2D.WrapMode]::Tile)
$c.g.FillRectangle($tb, 0, 244, $W, 196)
$tb.Dispose()
$ps.Dispose()

# 斜切黑条(平行四边形)
$para = New-Object System.Drawing.Drawing2D.GraphicsPath
$para.AddLine(70, 176, ($W - 40), 176)
$para.AddLine(($W - 40), 176, ($W - 78), 268)
$para.AddLine(($W - 78), 268, 32, 268)
$para.CloseFigure()
$br = New-Brush 235 8 6 12
$c.g.FillPath($br, $para)
$br.Dispose()
# 斜条下的金色细线(同样斜切,露出一点)
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(230, 226, 176, 104), 2.0)
$c.g.DrawLine($pen, [single]32, [single]272, [single]($W - 78), [single]272)
$pen.Dispose()
$para.Dispose()

# 左上星芒
$br = New-Brush 240 232 182 106
$burst = New-BurstPath 92 86 46 16 12
$c.g.FillPath($br, $burst)
$burst.Dispose()
$br.Dispose()

# 右下小四角星
$br = New-Brush 235 238 208 150
$st = New-Star4Path ($W - 84) ($H - 78) 30 14
$c.g.FillPath($br, $st)
$st.Dispose()
$br.Dispose()

# 颗粒
$gr = [System.Drawing.Image]::FromFile((Join-Path $OutDir "grain.png"))
$tb2 = New-Object System.Drawing.TextureBrush($gr, [System.Drawing.Drawing2D.WrapMode]::Tile)
$c.g.FillRectangle($tb2, $rect)
$tb2.Dispose()
$gr.Dispose()

# 四角括号(奶白)
$bk = [System.Drawing.Image]::FromFile((Join-Path $OutDir "bracket.png"))
$brushes2 = @(
  @{ x = 10; y = 10; rot = 0 },
  @{ x = ($W - 74); y = 10; rot = 90 },
  @{ x = ($W - 74); y = ($H - 74); rot = 180 },
  @{ x = 10; y = ($H - 74); rot = 270 }
)
foreach ($b in $brushes2) {
  $c.g.TranslateTransform($b.x, $b.y)
  $c.g.RotateTransform($b.rot)
  $c.g.DrawImage($bk, 0, 0)
  $c.g.ResetTransform()
}
$bk.Dispose()
Save-Png $c "plate-b.png"

# ---------------------------------------------------------------- 10. 总览图
$cell = 200
$cols = 5
$rows = 3
$sheet = New-Canvas ($cell * $cols) ($cell * $rows)
$bg = New-Brush 255 12 11 10
$sheet.g.FillRectangle($bg, 0, 0, ($cell * $cols), ($cell * $rows))
$bg.Dispose()

$items = @(
  @{ f = "star4.png"; l = "star4" },
  @{ f = "starburst.png"; l = "starburst" },
  @{ f = "bracket.png"; l = "bracket" },
  @{ f = "rule.png"; l = "rule" },
  @{ f = "halftone.png"; l = "halftone tile" },
  @{ f = "pinstripe.png"; l = "pinstripe tile" },
  @{ f = "grain.png"; l = "grain tile" },
  @{ f = "plate-a.png"; l = "plate-a" },
  @{ f = "plate-b.png"; l = "plate-b" }
)
$font = New-Object System.Drawing.Font("Arial", 9)
$white = New-Brush 220 220 210 190
$tileColor = New-Brush 255 30 28 34

for ($i = 0; $i -lt $items.Count; $i++) {
  $col = $i % $cols
  $row = [int]($i / $cols)
  $ox = $col * $cell + 10
  $oy = $row * $cell + 10
  $img = [System.Drawing.Image]::FromFile((Join-Path $OutDir $items[$i].f))
  # 平铺类垫一块深底才看得见
  if ($items[$i].l -match "tile") {
    $sheet.g.FillRectangle($tileColor, $ox, $oy, 120, 120)
  }
  $iw = 120
  $ih = [int]($img.Height * $iw / $img.Width)
  if ($ih -gt 120) { $ih = 120; $iw = [int]($img.Width * $ih / $img.Height) }
  $sheet.g.DrawImage($img, $ox, $oy, $iw, $ih)
  $sheet.g.DrawString($items[$i].l, $font, $white, [single]$ox, [single]($oy + 128))
  $img.Dispose()
}
$font.Dispose()
$white.Dispose()
$OutDir = Split-Path $OutDir -Parent
$OutDir = Join-Path (Split-Path $OutDir -Parent) "docs\mockups"
Save-Png $sheet "art-assets-contact-sheet.png"

Write-Host ""
Write-Host "完成。"
