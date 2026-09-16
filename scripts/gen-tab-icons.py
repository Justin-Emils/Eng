# -*- coding: utf-8 -*-
"""
从包内 Material Symbols 字体生成底部 Tab 图标 PNG(离线、Expo Go 与安装版都可用)。

背景:expo-router 的 NativeTabs 在 Android 上支持 md 图标,但那条路径要在运行时
用 expo-font 把字形渲染成图片,实测在 Expo Go 里不显示。改为直接用字体取出字形,
生成 24dp 的 PNG 资源(2 套颜色:未选中/选中),用 src 引用 —— 稳定且离线。

用法: python scripts/gen-tab-icons.py
输出: assets/tab-icons/*.png  +  preview.html(用于人工核对)
"""
import os
from pathlib import Path

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONT = (
    ROOT
    / "node_modules"
    / "@expo-google-fonts"
    / "material-symbols"
    / "400Regular"
    / "MaterialSymbols_400Regular.ttf"
)
OUT = ROOT / "assets" / "tab-icons"
SIZE = 96  # 24dp @4x
COLOR_IDLE = (138, 143, 152, 255)  # #8A8F98:浅色/深色背景都看得清
COLOR_ACTIVE = (47, 143, 240, 255)  # #2F8FF0:强调蓝

# 底部 5 个 tab → Material Symbols 字形
ICONS = {
    "today": "today",
    "library": "menu_book",
    "words": "bookmark",
    "review": "refresh",
    "profile": "person",
}


def glyph_codepoints():
    font = TTFont(FONT)
    cmap = font.getBestCmap()
    by_name = {}
    for cp, name in cmap.items():
        by_name.setdefault(name, cp)
    return by_name


def render(cp: int, color, path: Path, size: int = SIZE):
    font = ImageFont.truetype(str(FONT), int(size * 0.72))
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    ch = chr(cp)
    left, top, right, bottom = draw.textbbox((0, 0), ch, font=font)
    x = (size - (right - left)) / 2 - left
    y = (size - (bottom - top)) / 2 - top
    draw.text((x, y), ch, font=font, fill=color)
    img.save(path)


def main():
    if not FONT.exists():
        raise SystemExit("找不到字体: %s" % FONT)
    OUT.mkdir(parents=True, exist_ok=True)
    by_name = glyph_codepoints()
    rows = []
    for out_name, glyph in ICONS.items():
        cp = by_name.get(glyph)
        if cp is None:
            raise SystemExit("字体里没有字形: %s" % glyph)
        idle = OUT / f"{out_name}.png"
        active = OUT / f"{out_name}-active.png"
        render(cp, COLOR_IDLE, idle)
        render(cp, COLOR_ACTIVE, active)
        rows.append((out_name, glyph, idle.name, active.name))
        print("生成 %-20s <- %-10s (%s)" % (idle.name, glyph, hex(cp)))

    # 预览页(用于人工核对图标形状)
    cells = "\n".join(
        f'<div class="cell"><img src="{i}"><img src="{a}"><div>{n} · {g}</div></div>'
        for n, g, i, a in rows
    )
    html = f"""<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<style>
 body{{font-family:system-ui,"Microsoft YaHei",sans-serif;background:#fff;padding:24px}}
 .row{{display:flex;gap:18px;flex-wrap:wrap}}
 .cell{{text-align:center;font-size:12px;color:#555}}
 .cell img{{width:48px;height:48px;display:block;margin:0 auto 4px}}
 .dark{{background:#111;padding:24px;border-radius:14px;margin-top:22px}}
 .dark .cell{{color:#bbb}}
 h3{{font-size:14px;color:#333;margin:0 0 10px}}
 .dark h3{{color:#ddd}}
</style></head><body>
<h3>浅色背景(左:未选中 / 右:选中)</h3>
<div class="row">{cells}</div>
<div class="dark">
  <h3>深色背景</h3>
  <div class="row">{cells}</div>
</div>
</body></html>"""
    (OUT / "preview.html").write_text(html, encoding="utf-8")
    print("预览: %s" % (OUT / "preview.html"))


if __name__ == "__main__":
    main()
