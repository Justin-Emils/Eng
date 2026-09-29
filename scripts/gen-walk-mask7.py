"""行走动画抠底 v7:补"被包围的纯黑背景" + 软边抗锯齿。

用户反馈的两个问题:
  1. **后脑头发处有块黑斑没扣干净** —— 那块黑其实是**背景**,但被头发从四面包围,
     与画面四边不连通,v6 的"只保留与边界连通的连通域"规则于是把它当成了角色内部。
     修法:被包围、但**本身是纯黑(≤ PURE_BLACK)**且面积够大的连通域,也判为背景。
     依据:角色真正的深色部位(靴子/披风)实测灰度在 26~60,不会落进 ≤6 的范围。
  2. **边缘不够光滑** —— alpha 是二值,必然锯齿。修法两步:
     · 高斯模糊产生 1px 的过渡带(抗锯齿);
     · **边缘去污**:把不透明区域的颜色向外扩 1px 填进过渡带,
       避免过渡带里残留黑背景与角色的混色形成深色描边晕。

用法:python scripts/gen-walk-mask7.py
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
THRESH = 12        # 候选背景灰度上限(纯黑底实测 0)
PURE_BLACK = 6     # "被包围但确实是背景"的判定上限
MIN_ENCLOSED = 16  # 被包围背景的最小面积(滤掉噪点)
KERNEL = np.ones((3, 3), np.uint8)


def background_mask(gray: np.ndarray) -> np.ndarray:
    cand = (gray <= THRESH).astype(np.uint8)
    cand = (cv2.medianBlur(cand * 255, 3) > 127).astype(np.uint8)
    opened = cv2.morphologyEx(cand, cv2.MORPH_OPEN, KERNEL)

    n, labels, stats, _ = cv2.connectedComponentsWithStats(opened, connectivity=8)
    h, w = gray.shape
    border = set(labels[0, :].tolist()) | set(labels[-1, :].tolist())
    border |= set(labels[:, 0].tolist()) | set(labels[:, -1].tolist())
    border.discard(0)

    keep = np.zeros_like(opened)
    for i in range(1, n):
        is_border = i in border
        # 被包围的连通域:只有"整块都是纯黑且面积够大"才当背景(后脑那种发间空隙)
        if not is_border:
            if stats[i, cv2.CC_STAT_AREA] < MIN_ENCLOSED:
                continue
            region = labels == i
            if int(gray[region].max()) > PURE_BLACK:
                continue
        keep[labels == i] = 1

    return cv2.dilate(keep.astype(np.uint8), KERNEL) > 0


def render(path: str) -> np.ndarray:
    rgb = np.asarray(Image.open(path).convert('RGB'))
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    bg = background_mask(gray)
    mask = np.where(bg, 0, 255).astype(np.uint8)

    # 1) 软边:高斯模糊产生 1px 过渡带
    soft = cv2.GaussianBlur(mask, (3, 3), 0.85)

    # 2) 边缘去污:把不透明区域的颜色向外扩 1px,填进过渡带
    solid = (mask > 200).astype(np.uint8)
    grown = cv2.dilate(rgb, KERNEL)
    edge_band = (solid == 0) & (soft > 8)
    rgb_clean = np.where(edge_band[:, :, None], grown, rgb)

    return np.dstack([rgb_clean, soft])


paths = sorted(glob.glob(os.path.join(FRAMES, '*.png')))
print(f'帧数 {len(paths)}')

# 自检:残留的"不透明且纯黑"像素(应只剩角色真正的深色,量很小)
probe = render(paths[16])
alpha, rgb = probe[:, :, 3], probe[:, :, :3].astype(int)
dark_opaque = int(((alpha > 200) & (rgb.max(axis=2) <= 6)).sum())
print(f'帧16: 透明 {100*(alpha < 8).mean():.1f}% · 半透明过渡带 {100*((alpha >= 8) & (alpha <= 247)).mean():.1f}% · 残留纯黑不透明 {dark_opaque} px')

x0 = y0 = 10 ** 9
x1 = y1 = -1
for p in paths:
    a = render(p)[:, :, 3]
    ys, xs = np.where(a > 40)
    if len(xs):
        x0, x1 = min(x0, int(xs.min())), max(x1, int(xs.max()))
        y0, y1 = min(y0, int(ys.min())), max(y1, int(ys.max()))
PAD = 8
h, w = cv2.imread(paths[0]).shape[:2]
box = (max(0, x0 - PAD), max(0, y0 - PAD), min(w, x1 + PAD + 1), min(h, y1 + PAD + 1))
print(f'包围盒 {box} → {(box[2]-box[0], box[3]-box[1])}')

out_dir = os.path.join(ROOT, '.artifacts', 'anim-masked7')
os.makedirs(out_dir, exist_ok=True)
for old in glob.glob(os.path.join(out_dir, '*.png')):
    os.remove(old)
for i, p in enumerate(paths):
    Image.fromarray(render(p), 'RGBA').crop(box).save(os.path.join(out_dir, f'm{i:04d}.png'))

frames = [Image.open(f) for f in sorted(glob.glob(os.path.join(out_dir, '*.png')))]
frames[0].save(OUT, save_all=True, append_images=frames[1:],
               duration=int(1000 / FPS), loop=0, quality=82, method=4, lossless=False)
print(f'已生成 {OUT} · {os.path.getsize(OUT)/1024:.0f} KB · {frames[0].size}')
