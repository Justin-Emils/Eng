"""重新生成图标:给自适应图标留出 Android 的安全区。

问题:启动器会把自适应图标裁成圆/水滴/方等形状,只有中心 **66%**(内切圆直径)
是保证可见的。之前按"裁白边 + 6% 边距"生成,图形几乎铺满画布,所以桌面上显示不全。

尺寸约定:
  icon.png / favicon.png       图形占 72%(传统方形图标,留少量边距即可)
  android-icon-foreground.png  图形占 62%(落在 66% 安全区内,任何形状都不切)
  android-icon-monochrome.png  同上 62%(白色剪影)
  splash-icon.png              图形占 62%(白色,压品牌蓝)
  android-icon-background.png  纯白
"""
import numpy as np
from PIL import Image

SRC = r'E:\code\Eng\素材\0376bc27c7a393a1294f3fd46d32b20b.jpg'
OUT = r'E:\code\Eng\article-reading\assets\images'

im = Image.open(SRC).convert('RGB')
arr = np.asarray(im).astype(np.int16)
mask = (255 - arr.min(axis=2)) > 18
ys, xs = np.where(mask)
art = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)).convert('RGBA')
print('内容裁剪:', art.size)


def place(img, fill_ratio, side=1024, bg=None):
    """把内容按 fill_ratio 缩放后居中放到 side×side 画布上。"""
    target = int(side * fill_ratio)
    w, h = img.size
    scale = min(target / w, target / h)
    resized = img.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.LANCZOS)
    canvas = Image.new('RGBA', (side, side), bg or (255, 255, 255, 255))  # 留白必须用白色:透明像素的 RGB 是 (0,0,0),会被亮度→alpha 误判成不透明黑边
    canvas.paste(resized, ((side - resized.size[0]) // 2, (side - resized.size[1]) // 2), resized)
    return canvas


# 1. 方形图标(白底,图形 72%)
icon = place(art, 0.72, bg=(255, 255, 255, 255))
icon.convert('RGB').save(f'{OUT}\\icon.png')
icon.convert('RGB').resize((64, 64), Image.LANCZOS).save(f'{OUT}\\favicon.png')

# 2. 自适应前景(图形 62%,白底按亮度转 alpha)
fg_src = place(art, 0.62)
a = np.asarray(fg_src).astype(np.float32)
lum = a[:, :, :3].mean(axis=2)
alpha = np.clip((255 - lum - 10) / (255 - 10), 0, 1)
Image.fromarray(np.dstack([a[:, :, :3], alpha * 255]).astype(np.uint8)).save(
    f'{OUT}\\android-icon-foreground.png')

# 3. 单色剪影 + 启动页图标(同一几何,纯白)
mono_alpha = (alpha * 255).astype(np.uint8)
white = np.dstack([np.full_like(mono_alpha, 255), np.full_like(mono_alpha, 255),
                   np.full_like(mono_alpha, 255), mono_alpha])
Image.fromarray(white).resize((1024, 1024), Image.LANCZOS).save(
    f'{OUT}\\android-icon-monochrome.png')
Image.fromarray(white).resize((512, 512), Image.LANCZOS).save(f'{OUT}\\splash-icon.png')

# 4. 自适应背景(纯白)
Image.new('RGB', (1024, 1024), (255, 255, 255)).save(f'{OUT}\\android-icon-background.png')

# 校验:前景里非透明像素的包围盒应落在中心 62% 内
fg = np.asarray(Image.open(f'{OUT}\\android-icon-foreground.png').convert('RGBA'))[:, :, 3]
yy, xx = np.where(fg > 40)
side = fg.shape[0]
print(f'前景内容范围: x {xx.min()}-{xx.max()} / y {yy.min()}-{yy.max()} (画布 {side})')
print(f'占画布宽度 {(xx.max()-xx.min()+1)/side*100:.1f}% (安全区要求 ≤66%)')
print('已重新生成全套图标')
