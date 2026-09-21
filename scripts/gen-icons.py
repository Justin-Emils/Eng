"""从 E:\\code\\Eng\\素材 生成 App 图标全套(用 Pillow,不依赖外部工具)。

源图:深色图形 + 白底,内容边界 782x791(约 13.4% 非白像素)。
产出(app.json 引用的全部文件):
  icon.png                    1024x1024  白底 + 居中留边(标准图标)
  android-icon-foreground.png 1024x1024  透明底、深色图形(自适应图标前景)
  android-icon-background.png 1024x1024  纯色底(自适应图标背景)
  android-icon-monochrome.png 1024x1024  白色剪影 + 透明底(Android 13 主题图标)
  splash-icon.png              512x512   白色图形 + 透明底(启动页,压在品牌蓝上)
  favicon.png                   64x64
"""
import numpy as np
from PIL import Image

SRC = r'E:\code\Eng\素材\0376bc27c7a393a1294f3fd46d32b20b.jpg'
OUT = r'E:\code\Eng\article-reading\assets\images'
BG_COLOR = (230, 244, 254)  # 与 app.json 现有 adaptiveIcon.backgroundColor 一致

im = Image.open(SRC).convert('RGB')
a = np.asarray(im).astype(np.int16)

# 1. 找出内容边界(与纯白的差异 > 阈值)
diff = 255 - a.min(axis=2)
mask = diff > 18
ys, xs = np.where(mask)
x1, x2, y1, y2 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
art = im.crop((x1, y1, x2, y2))
print(f'内容裁剪: {art.size[0]}x{art.size[1]}')

# 2. 内容贴成正方形(留白 6%),再缩放
def square(img, pad_ratio=0.06, fill=(255, 255, 255)):
    w, h = img.size
    side = int(max(w, h) * (1 + pad_ratio * 2))
    canvas = Image.new('RGB', (side, side), fill)
    canvas.paste(img, ((side - w) // 2, (side - h) // 2))
    return canvas

icon = square(art).resize((1024, 1024), Image.LANCZOS)
icon.save(f'{OUT}\\icon.png')
icon.resize((64, 64), Image.LANCZOS).save(f'{OUT}\\favicon.png')

# 3. 自适应前景:白底 → 透明,保留原色(暗部不透明,亮部透明)
arr = np.asarray(square(art)).astype(np.float32)
lum = arr.mean(axis=2)
# alpha = (255 - luminance) 归一化,并去掉极轻微的白噪
alpha = np.clip((255 - lum - 10) / (255 - 10), 0, 1)
rgba = np.dstack([arr, alpha * 255]).astype(np.uint8)
fg = Image.fromarray(rgba, 'RGBA').resize((1024, 1024), Image.LANCZOS)
fg.save(f'{OUT}\\android-icon-foreground.png')

# 4. 自适应背景:纯色
Image.new('RGB', (1024, 1024), BG_COLOR).save(f'{OUT}\\android-icon-background.png')

# 5. 单色图标(Android 主题图标):同一 alpha 形状,填充纯白
alpha_only = (alpha * 255).astype(np.uint8)
mono = np.dstack([
    np.full_like(alpha_only, 255), np.full_like(alpha_only, 255),
    np.full_like(alpha_only, 255), alpha_only,
])
Image.fromarray(mono, 'RGBA').resize((1024, 1024), Image.LANCZOS).save(
    f'{OUT}\\android-icon-monochrome.png')

# 6. 启动页图标:白色图形压在品牌蓝上(深色图形直接放蓝底会看不清)
splash = np.dstack([
    np.full_like(alpha_only, 255), np.full_like(alpha_only, 255),
    np.full_like(alpha_only, 255), alpha_only,
])
Image.fromarray(splash, 'RGBA').resize((512, 512), Image.LANCZOS).save(
    f'{OUT}\\splash-icon.png')

print('已生成: icon.png / favicon.png / android-icon-foreground.png / '
      'android-icon-background.png / android-icon-monochrome.png / splash-icon.png')
