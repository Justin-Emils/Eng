"""透明动画的体积攻坚:试三种编码策略,挑能压到 1 MB 以内的。

背景:Pillow 写动图 WebP 时 quality 基本不起作用(实测 78→50 只从 2855→2644 KB),
说明走了无损路径。alpha 又来自亮度渐变、软边多,无损压缩率极差。

三种策略:
  A. 显式传 lossless=False(看能否强制有损)
  B. alpha 二值化(阈值 110):硬边但 alpha 只有 0/255 两种值,压缩率极高
  C. alpha 量化到 4 级(0/85/170/255):介于两者之间

用法:python scripts/gen-walk-anim4.py
"""
import glob
import os

import numpy as np
from PIL import Image

ROOT = r'E:\code\Eng\article-reading'
CROPS = os.path.join(ROOT, '.artifacts', 'anim-crops')
OUT = os.path.join(ROOT, 'assets', 'anim', 'walk-transparent.webp')
tmp = os.path.join(ROOT, 'assets', 'anim', '_sweep.webp')
FPS = 30

paths = sorted(glob.glob(os.path.join(CROPS, 'c*.png')))
base = Image.open(paths[0]).convert('RGBA')
size = base.size
print(f'裁切帧 {len(paths)} 张 · {size}')


def variant(kind):
    frames = []
    for p in paths:
        im = Image.open(p).convert('RGBA')
        arr = np.asarray(im).copy()
        alpha = arr[:, :, 3]
        if kind == 'binary':
            arr[:, :, 3] = np.where(alpha >= 110, 255, 0).astype(np.uint8)
        elif kind == 'quant':
            arr[:, :, 3] = ((alpha // 85) * 85).astype(np.uint8)
        frames.append(Image.fromarray(arr))
    return frames


def measure(label, frames, **kw):
    frames[0].save(tmp, save_all=True, append_images=frames[1:],
                   duration=int(1000 / FPS), loop=0, method=4, **kw)
    kb = os.path.getsize(tmp) / 1024
    print(f'  {label} → {kb:.0f} KB')
    return kb


# A. 强制有损
fa = variant('keep')
measure('A 原 alpha + lossless=False', fa, lossless=False, quality=70)
for im in fa:
    im.close()

# B. alpha 二值化
fb = variant('binary')
kb_b = measure('B alpha 二值化 + lossless=False', fb, lossless=False, quality=80)
kb_b2 = measure('B2 alpha 二值化 + 无损', fb, lossless=True)

# C. alpha 四级量化
fc = variant('quant')
kb_c = measure('C alpha 四级 + lossless=False', fc, lossless=False, quality=80)

# 选择:B2(无损二值)通常同时做到体积小与边缘干净
if kb_b2 <= 1000:
    fb[0].save(OUT, save_all=True, append_images=fb[1:],
               duration=int(1000 / FPS), loop=0, lossless=True, method=4)
    print('选中:B2 无损二值 alpha')
elif kb_b <= 1000:
    fb[0].save(OUT, save_all=True, append_images=fb[1:],
               duration=int(1000 / FPS), loop=0, lossless=False, quality=80, method=4)
    print('选中:B 有损二值 alpha')
else:
    fc[0].save(OUT, save_all=True, append_images=fc[1:],
               duration=int(1000 / FPS), loop=0, lossless=False, quality=80, method=4)
    print('选中:C 四级量化 alpha')
for im in fb + fc:
    im.close()
if os.path.exists(tmp):
    os.remove(tmp)
print(f'已生成 {OUT} · {os.path.getsize(OUT)/1024:.0f} KB')
