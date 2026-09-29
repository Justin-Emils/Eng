"""行走动画抠底 v6:用 OpenCV 连通域判定背景(不再用 Pillow 的 floodfill)。

为什么换掉 Pillow:实测 `ImageDraw.floodfill` 对 `Image.fromarray` 生成的图**不生效**
(v3~v5 的"回填封闭透明"步骤把整片背景都判成了封闭区,导致整张图变不透明)。
OpenCV 的连通域分析是向量化的、边界行为明确,没有这个坑。

判定规则(与 v2 的思路一致,但实现可靠):
  1. 候选背景 = 灰度 ≤ 阈值(纯黑区域);
  2. **开运算(3×3)** 消掉 1~2px 的细桥 —— 那是 AV1 压缩在浅色衣服上留下的噪点;
  3. 只保留**与画面四边连通**的候选连通域 = 真背景;
  4. 把背景膨胀回 1px,避免角色边缘留一圈黑边;
  5. 角色身上的像素一律不透明(包括深色靴子/披风)。

用法:python scripts/gen-walk-mask6.py
"""
import glob
import os

import cv2
import numpy as np
from PIL import Image

ROOT = r'E:\code\Eng\article-reading'
FRAMES = os.path.join(ROOT, '.artifacts', 'anim-rgb')
OUT = os.path.join(ROOT, 'assets', 'anim', 'walk-transparent.webp')
FPS = 30
THRESH = 12
KERNEL = np.ones((3, 3), np.uint8)


def background_mask(gray: np.ndarray) -> np.ndarray:
    cand = (gray <= THRESH).astype(np.uint8)
    # 中值滤波:抹掉孤立噪点(压缩伪影)
    cand = cv2.medianBlur(cand * 255, 3)
    cand = (cand > 127).astype(np.uint8)
    # 开运算:细桥断开
    opened = cv2.morphologyEx(cand, cv2.MORPH_OPEN, KERNEL)
    # 连通域:只留与四边连通的
    n, labels = cv2.connectedComponents(opened, connectivity=8)
    border = set(labels[0, :].tolist()) | set(labels[-1, :].tolist())
    border |= set(labels[:, 0].tolist()) | set(labels[:, -1].tolist())
    border.discard(0)
    if not border:
        return np.zeros_like(opened, dtype=bool)
    keep = np.isin(labels, list(border))
    # 膨胀 1px 回去,避免角色边缘残留黑边
    keep = cv2.dilate(keep.astype(np.uint8), KERNEL) > 0
    return keep


def alpha_for(path: str) -> np.ndarray:
    rgb = np.asarray(Image.open(path).convert('RGB'))
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    bg = background_mask(gray)
    return np.where(bg, 0, 255).astype(np.uint8)


paths = sorted(glob.glob(os.path.join(FRAMES, '*.png')))
print(f'帧数 {len(paths)}')
probe = alpha_for(paths[16])
print(f'帧16 透明占比 {100*(probe<8).mean():.1f}%')

# 并集包围盒
x0 = y0 = 10 ** 9
x1 = y1 = -1
for p in paths:
    alpha = alpha_for(p)
    ys, xs = np.where(alpha > 40)
    if len(xs):
        x0, x1 = min(x0, int(xs.min())), max(x1, int(xs.max()))
        y0, y1 = min(y0, int(ys.min())), max(y1, int(ys.max()))
PAD = 8
h, w = cv2.imread(paths[0]).shape[:2]
box = (max(0, x0 - PAD), max(0, y0 - PAD), min(w, x1 + PAD + 1), min(h, y1 + PAD + 1))
print(f'包围盒 {box} → {(box[2]-box[0], box[3]-box[1])}')

out_dir = os.path.join(ROOT, '.artifacts', 'anim-masked6')
os.makedirs(out_dir, exist_ok=True)
for old in glob.glob(os.path.join(out_dir, '*.png')):
    os.remove(old)
for i, p in enumerate(paths):
    rgb = np.asarray(Image.open(p).convert('RGB'))
    alpha = alpha_for(p)
    rgba = np.dstack([rgb, alpha])
    Image.fromarray(rgba, 'RGBA').crop(box).save(os.path.join(out_dir, f'm{i:04d}.png'))

frames = [Image.open(f) for f in sorted(glob.glob(os.path.join(out_dir, '*.png')))]
frames[0].save(OUT, save_all=True, append_images=frames[1:],
               duration=int(1000 / FPS), loop=0, quality=80, method=4, lossless=False)
ratio = (np.asarray(frames[0])[:, :, 3] > 247).mean() * 100
print(f'已生成 {OUT} · {os.path.getsize(OUT)/1024:.0f} KB · {frames[0].size} · 不透明 {ratio:.1f}%')
