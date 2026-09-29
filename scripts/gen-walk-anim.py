"""把导出的 PNG 帧序列合成为**带透明通道**的行走动画 WebP。

背景:
  原始素材是「浅色角色 + 纯黑背景」的 webm。直接用 ffmpeg 转 WebP 时,
  动图的帧间混合会让透明区不擦除上一帧 → 出现"每帧叠加"的鬼影。
  所以改成两步:ffmpeg 逐帧导出 PNG(亮度作 alpha)→ Pillow 逐帧完整写入动图。

体积优化:
  角色只占 720×720 画面的约 6%,先裁到所有帧的**并集包围盒**(走动时会左右摆,
  不能按单帧裁),像素数降到约 12%,体积随之大幅下降。

用法:python scripts/gen-walk-anim.py
"""
import glob
import os

import numpy as np
from PIL import Image

ROOT = r'E:\code\Eng\article-reading'
FRAMES = os.path.join(ROOT, '.artifacts', 'anim-frames')
OUT = os.path.join(ROOT, 'assets', 'anim', 'walk-transparent.webp')
PAD = 16
FPS = 30

files = sorted(glob.glob(os.path.join(FRAMES, 'f*.png')))
frames = [Image.open(f).convert('RGBA') for f in files]
print(f'读取帧 {len(frames)} 张,单帧 {frames[0].size}')

# 1) 并集包围盒
x0 = y0 = 10 ** 9
x1 = y1 = -1
for im in frames:
    alpha = np.asarray(im)[:, :, 3]
    ys, xs = np.where(alpha > 40)
    x0, x1 = min(x0, int(xs.min())), max(x1, int(xs.max()))
    y0, y1 = min(y0, int(ys.min())), max(y1, int(ys.max()))
w, h = frames[0].size
box = (max(0, x0 - PAD), max(0, y0 - PAD), min(w, x1 + PAD + 1), min(h, y1 + PAD + 1))
print(f'并集包围盒 {box} → 裁切尺寸 {(box[2]-box[0], box[3]-box[1])}')
crops = [im.crop(box) for im in frames]
ratio = (box[2] - box[0]) * (box[3] - box[1]) / (w * h)
print(f'像素数降到原来的 {ratio*100:.1f}%')

# 2) 质量扫描
tmp = os.path.join(ROOT, 'assets', 'anim', '_sweep.webp')
for quality, method in [(85, 6), (78, 6), (70, 6), (62, 6)]:
    crops[0].save(tmp, save_all=True, append_images=crops[1:],
                  duration=int(1000 / FPS), loop=0, quality=quality, method=method)
    print(f'  quality={quality} method={method} → {os.path.getsize(tmp)/1024:.0f} KB')
if os.path.exists(tmp):
    os.remove(tmp)

# 3) 以 78/6 落盘(体积与画质平衡点)
crops[0].save(OUT, save_all=True, append_images=crops[1:],
              duration=int(1000 / FPS), loop=0, quality=78, method=6)
print(f'已生成 {OUT} · {os.path.getsize(OUT)/1024:.0f} KB · 尺寸 {crops[0].size}')
