"""行走动画抠底 v5:泛洪前先做中值滤波 —— 从根上断掉噪点细通道。

历次失败回顾(都记下来,免得再犯):
  v1 亮度当 alpha → 角色深色部分全被抠掉;
  v2 边界泛洪(阈值26)→ 仍有漏,浅色衣服上的压缩噪点与背景连成细通道;
  v3/v4 形态学(闭/开运算)→ **Pillow 的 MinFilter 在图像边缘把界外当 0**,
        外圈背景被腐蚀掉 → "与边界连通"的判定失效 → 整张图被填成不透明。

v5 的做法:v2 的边界泛洪 + **中值滤波预处理**。
  AV1 有损压缩在浅色衣服上留下的是 1~2px 的孤立近黑噪点;
  3×3 中值滤波会把这类孤立噪点抹平(它周围都是浅色),而角色身上成块的深色
  (靴子/披风,几十像素宽)不受影响。于是噪点造成的"桥"断开,泛洪不再漏进角色。

用法:python scripts/gen-walk-mask5.py
"""
import glob
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = r'E:\code\Eng\article-reading'
FRAMES = os.path.join(ROOT, '.artifacts', 'anim-rgb')
OUT = os.path.join(ROOT, 'assets', 'anim', 'walk-transparent.webp')
FPS = 30
FILL_THRESH = 10
SENTINEL = 128


def flood_background(gray: Image.Image) -> np.ndarray:
    filled = gray.copy()
    w, h = gray.size
    seeds = [(x, 0) for x in range(0, w, 8)] + [(x, h - 1) for x in range(0, w, 8)]
    seeds += [(0, y) for y in range(0, h, 8)] + [(w - 1, y) for y in range(0, h, 8)]
    hit = 0
    for seed in seeds:
        if gray.getpixel(seed) <= FILL_THRESH:
            ImageDraw.floodfill(filled, seed, SENTINEL, thresh=FILL_THRESH)
            hit += 1
    return (np.asarray(filled) == SENTINEL), hit


def alpha_for(img_rgb: Image.Image):
    gray = img_rgb.convert('L')
    # 中值滤波:抹掉孤立噪点(压缩伪影),保留成块的深色主体
    smooth = gray.filter(ImageFilter.MedianFilter(3))
    bg, _ = flood_background(smooth)
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    # 兜底:与边界不连通的透明区一定是角色内部,填实
    inv = Image.fromarray(np.where(alpha == 0, 255, 0).astype(np.uint8), 'L')
    w, h = inv.size
    for seed in [(x, 0) for x in range(0, w, 8)] + [(x, h - 1) for x in range(0, w, 8)]:
        if inv.getpixel(seed) == 255:
            ImageDraw.floodfill(inv, seed, 100, thresh=0)
    for seed in [(0, y) for y in range(0, h, 8)] + [(w - 1, y) for y in range(0, h, 8)]:
        if inv.getpixel(seed) == 255:
            ImageDraw.floodfill(inv, seed, 100, thresh=0)
    enclosed = np.asarray(inv) == 255
    filled = int(enclosed.sum())
    alpha[enclosed] = 255
    return alpha, int(bg.sum()), filled


paths = sorted(glob.glob(os.path.join(FRAMES, '*.png')))
print(f'帧数 {len(paths)}')

a, n_bg, n_fill = alpha_for(Image.open(paths[16]).convert('RGB'))
print(f'帧16: 泛洪背景 {n_bg} px · 回填封闭透明 {n_fill} px · 最终透明 {100*(a<8).mean():.1f}%')

x0 = y0 = 10 ** 9
x1 = y1 = -1
for p in paths:
    alpha, _, _ = alpha_for(Image.open(p).convert('RGB'))
    ys, xs = np.where(alpha > 40)
    if len(xs):
        x0, x1 = min(x0, int(xs.min())), max(x1, int(xs.max()))
        y0, y1 = min(y0, int(ys.min())), max(y1, int(ys.max()))
PAD = 8
w, h = Image.open(paths[0]).size
box = (max(0, x0 - PAD), max(0, y0 - PAD), min(w, x1 + PAD + 1), min(h, y1 + PAD + 1))
print(f'包围盒 {box} → {(box[2]-box[0], box[3]-box[1])}')

out_dir = os.path.join(ROOT, '.artifacts', 'anim-masked5')
os.makedirs(out_dir, exist_ok=True)
for old in glob.glob(os.path.join(out_dir, '*.png')):
    os.remove(old)
for i, p in enumerate(paths):
    img = Image.open(p).convert('RGB')
    alpha, _, _ = alpha_for(img)
    rgba = np.dstack([np.asarray(img), alpha])
    Image.fromarray(rgba, 'RGBA').crop(box).save(os.path.join(out_dir, f'm{i:04d}.png'))

frames = [Image.open(f) for f in sorted(glob.glob(os.path.join(out_dir, '*.png')))]
frames[0].save(OUT, save_all=True, append_images=frames[1:],
               duration=int(1000 / FPS), loop=0, quality=80, method=4, lossless=False)
ratio = (np.asarray(frames[0])[:, :, 3] > 247).mean() * 100
print(f'已生成 {OUT} · {os.path.getsize(OUT)/1024:.0f} KB · {frames[0].size} · 不透明 {ratio:.1f}%')
