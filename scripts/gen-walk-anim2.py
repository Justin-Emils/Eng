"""把 PNG 帧序列合成透明行走动画(快速版)。

相比上一版的改动:
  - 去掉质量扫描(method=6 对 96 帧要跑十几分钟,4 轮更久)
  - 只保存一次,用默认压缩(method=4)
  - 逐帧读入后立即裁切,避免同时持有 96 张 720×720 的 RGBA(约 200MB)

用法:python scripts/gen-walk-anim2.py
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
if not files:
    raise SystemExit(f'没有找到帧文件:{FRAMES}(先跑 ffmpeg 导出)')

# 第一遍:只求并集包围盒(不保留图像,省内存)
x0 = y0 = 10 ** 9
x1 = y1 = -1
size = None
for f in files:
    im = Image.open(f).convert('RGBA')
    if size is None:
        size = im.size
    alpha = np.asarray(im)[:, :, 3]
    ys, xs = np.where(alpha > 40)
    if len(xs):
        x0, x1 = min(x0, int(xs.min())), max(x1, int(xs.max()))
        y0, y1 = min(y0, int(ys.min())), max(y1, int(ys.max()))
    im.close()

w, h = size
box = (max(0, x0 - PAD), max(0, y0 - PAD), min(w, x1 + PAD + 1), min(h, y1 + PAD + 1))
print(f'帧数 {len(files)} · 单帧 {size} · 并集包围盒 {box} → 裁切 {(box[2]-box[0], box[3]-box[1])}')
print(f'像素数降到原来的 {100*(box[2]-box[0])*(box[3]-box[1])/(w*h):.1f}%')

# 第二遍:逐帧裁切后立即保存为临时 PNG,再统一合成(避免一次性持有全部大图)
crop_dir = os.path.join(ROOT, '.artifacts', 'anim-crops')
os.makedirs(crop_dir, exist_ok=True)
for old in glob.glob(os.path.join(crop_dir, '*.png')):
    os.remove(old)
crops = []
for i, f in enumerate(files):
    im = Image.open(f).convert('RGBA').crop(box)
    out = os.path.join(crop_dir, f'c{i:04d}.png')
    im.save(out)
    crops.append(out)
    im.close()

frames = [Image.open(p) for p in crops]
frames[0].save(OUT, save_all=True, append_images=frames[1:],
               duration=int(1000 / FPS), loop=0, quality=78, method=4)
for im in frames:
    im.close()
print(f'已生成 {OUT} · {os.path.getsize(OUT)/1024:.0f} KB · 尺寸 {box[2]-box[0]}×{box[3]-box[1]}')
