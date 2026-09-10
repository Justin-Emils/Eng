# -*- coding: utf-8 -*-
"""
下载 ECDICT csv 到本地 wordlists/ecdict.csv(断点续传),成功后生成词难度元数据。
用法: python scripts/fetch-ecdict-meta.py
  --download-only  只下载不解析
分块 Range 请求,遇 ConnectionReset 自动重试。
"""
import csv
import datetime
import io
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
import ssl
from pathlib import Path

URL = "https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv"
ROOT = Path(__file__).resolve().parent.parent
LOCAL = ROOT / "wordlists" / "ecdict.csv"
OUT = ROOT / "src" / "data" / "word-meta.ts"
USERLIST = ROOT / "src" / "data" / "external-wordlist.ts"
CHUNK = 2 * 1024 * 1024  # 2MB 每块
MAX_RETRY = 12

KEEP_TAGS = ("zk", "gk", "cet4", "cet6", "ky", "toefl", "ielts", "gre", "sat")
TOTAL_SIZE = 65933428


def get_size(url):
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "curl/8"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return int(r.headers.get("Content-Length") or 0)


def download():
    if LOCAL.exists() and LOCAL.stat().st_size >= TOTAL_SIZE * 0.99:
        print("local csv already complete:", LOCAL, file=sys.stderr)
        return
    LOCAL.parent.mkdir(parents=True, exist_ok=True)
    ctx = ssl.create_default_context()
    exist = LOCAL.stat().st_size if LOCAL.exists() else 0
    while exist < TOTAL_SIZE:
        ok = False
        for attempt in range(MAX_RETRY):
            headers = {"User-Agent": "curl/8", "Range": "bytes=%d-" % exist}
            req = urllib.request.Request(URL, headers=headers)
            try:
                with urllib.request.urlopen(req, timeout=90, context=ctx) as r, open(LOCAL, "ab") as f:
                    while True:
                        b = r.read(256 * 1024)
                        if not b:
                            break
                        f.write(b)
                exist = LOCAL.stat().st_size
                print("progress %.1f%% (%d/%d)" % (exist * 100.0 / TOTAL_SIZE, exist, TOTAL_SIZE), file=sys.stderr)
                ok = True
                break
            except (urllib.error.URLError, ConnectionResetError, TimeoutError, OSError) as e:
                print("chunk fail retry", attempt, type(e).__name__, str(e)[:80], file=sys.stderr)
                time.sleep(2 + attempt)
        if not ok:
            raise RuntimeError("download failed after retries")
    print("download complete:", LOCAL, file=sys.stderr)


def load_user_words():
    if not USERLIST.exists():
        return set()
    try:
        txt = USERLIST.read_text(encoding="utf-8")
        m = re.search(r"EXTERNAL_WORDLIST:\s*readonly string\[\]\s*=\s*(\[.*?\]);", txt, re.S)
        return set(json.loads(m.group(1))) if m else set()
    except Exception:
        return set()


def parse_num(s):
    s = (s or "").strip()
    try:
        return int(float(s)) if s else None
    except ValueError:
        return None


def build(user_words):
    meta = {}
    rows = 0
    with open(LOCAL, encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows += 1
            if rows % 200000 == 0:
                print("  parsed", rows, file=sys.stderr)
            word = (row.get("word") or "").strip().lower()
            if not word:
                continue
            tags = [t for t in (row.get("tag") or "").replace(",", " ").split() if t in KEEP_TAGS]
            if not ("ky" in tags or word in user_words):
                continue
            meta[word] = {"tags": tags, "frq": parse_num(row.get("frq")), "bnc": parse_num(row.get("bnc"))}
    return meta, rows


def main():
    download_only = "--download-only" in sys.argv
    download()
    if download_only:
        return
    user_words = load_user_words()
    print("user words:", len(user_words), file=sys.stderr)
    meta, rows = build(user_words)
    print("meta for %d words of %d rows" % (len(meta), rows), file=sys.stderr)
    now = datetime.datetime.now().isoformat()
    L = []
    L.append("/**")
    L.append(" * 词难度元数据(ECDICT 子集,自动生成)。来源: ECDICT(MIT);")
    L.append(" * tags=考试标签(zk/gk/cet4/cet6/ky/toefl/ielts/gre/sat),frq/bnc=语料词频名次。")
    L.append(" * 生成时间: " + now)
    L.append(" * 词条数: %d" % len(meta))
    L.append(" */")
    L.append("export const WORD_META: Record<string, { tags: string[]; frq: number | null; bnc: number | null }> = {")
    for word in sorted(meta):
        L.append("  %s: %s," % (json.dumps(word), json.dumps(meta[word], ensure_ascii=False)))
    L.append("};")
    L.append("")
    OUT.write_text("\n".join(L), encoding="utf-8")
    print("written:", OUT, file=sys.stderr)


if __name__ == "__main__":
    main()
