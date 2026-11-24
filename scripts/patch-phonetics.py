# -*- coding: utf-8 -*-
"""
把 ECDICT 的音标"归一化"后补进 src/data/ext-words.ts。

背景:原生成脚本 fetch-ecdict-kaoyan.py 用一个极窄的字符白名单校验音标,
不合格就置空 —— 但 ECDICT 的音标里大量使用**西里尔形近字**:
  ә (U+04D9) 而不是 ə (U+0259)   —— 3131 次
  :  而不是 ː (U+02D0)             —— 1254 次
  є (U+0454) 而不是 ɛ (U+025B)     —— 67 次
  '  作为重音符号(应转 ˈ)
于是 4434/6798 条(65%)词条没有音标,包括 abandon / ability / abnormal 这类基础词。

本脚本:
  1. 流式读 ecdict.csv,把 word → 归一化音标;
  2. 只改 ext-words.ts 里的 phonetic 字段(不动释义,最小 diff);
  3. 已有音标也一并归一化(统一成标准 IPA)。
用法: python scripts/patch-phonetics.py [--apply]
"""
import csv, io, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV = ROOT / ".artifacts" / "ecdict" / "ecdict.csv"
OUT = ROOT / "src" / "data" / "ext-words.ts"

# 允许出现的字符(标准 IPA + ASCII)
ALLOWED = set("abcdefghijklmnopqrstuvwxyz"
              "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
              "0123456789 .-'ˈˌːəɪʊæɑɔɛʌɜθðʃʒŋɡɒɚɝɐɘɵøɨʉɯɤœɶʏʁħʕʔɫɾɹj")

# 形近字/非标准符号 → 标准 IPA
MAP = {
    "ә": "ə", "Ә": "ə",   # 西里尔 schwa
    "є": "ɛ", "Є": "ɛ",   # 西里尔 ukrainian ie
    "ө": "ə", "Ө": "ə",
    "ɑ": "ɑ", "а": "ɑ",   # 西里尔 a(少数条目误用)
    "е": "e",
    ":": "ː",             # ASCII 冒号 → 长音符
    "'": "ˈ", "’": "ˈ",   # 撇号 → 主重音
    ",": "ˌ",             # 逗号 → 次重音
    "ˈˈ": "ˈ",
}

def normalize(raw: str):
    if not raw:
        return None
    s = raw.strip()
    # 去掉包裹符号
    s = s.strip("[]()/／「」\"")
    # 多个变体只取第一个
    for sep in (";", "；"):
        if sep in s:
            s = s.split(sep)[0]
    s = s.strip()
    # 逐字符映射
    out = []
    for ch in s:
        if ch in ("^", "\\", "(", ")", "[", "]", "/", "$", "+", "|"):
            continue
        out.append(MAP.get(ch, ch))
    s = "".join(out)
    s = re.sub(r"\s+", " ", s).strip()
    s = s.strip(".")
    if not s:
        return None
    # 至少含有元音或字母,避免 "1" 这种
    if not re.search(r"[a-zA-Zæɑɒɔəɛɜɪʊʌɚɝ]", s):
        return None
    if any(ch not in ALLOWED for ch in s):
        return None
    return s

def load_csv():
    m = {}
    with io.open(CSV, encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            w = (row.get("word") or "").strip().lower()
            if not w or w in m:
                continue
            p = normalize(row.get("phonetic") or "")
            if p:
                m[w] = p
    return m

def main():
    apply = "--apply" in sys.argv
    if not CSV.exists():
        print("缺少 .artifacts/ecdict/ecdict.csv"); return 1
    ipa = load_csv()
    print(f"ECDICT 归一化音标: {len(ipa)} 条")

    src = io.open(OUT, encoding="utf-8", newline="").read()
    lines = src.split("\n")
    filled = normalized = unchanged = missing = 0

    for i, line in enumerate(lines):
        m = re.match(r'^(  ")([^"]+)(": \{"headword": ")([^"]+)(", )', line)
        if not m:
            continue
        word = m.group(2).lower()
        new = ipa.get(word)
        if not new:
            if '"phonetic"' not in line:
                missing += 1
            continue
        cur = re.search(r'"phonetic": "([^"]*)"', line)
        if cur:
            if cur.group(1) == new:
                unchanged += 1
                continue
            lines[i] = re.sub(r'"phonetic": "[^"]*"', f'"phonetic": "{new}"', line, count=1)
            normalized += 1
        else:
            lines[i] = line.replace(f'"headword": "{m.group(4)}", ',
                                    f'"headword": "{m.group(4)}", "phonetic": "{new}", ', 1)
            filled += 1

    print(f"  补上音标: {filled} · 归一化已有: {normalized} · 一致: {unchanged} · 仍缺: {missing}")
    if apply:
        io.open(OUT, "w", encoding="utf-8", newline="").write("\n".join(lines))
        print("  已写入 src/data/ext-words.ts")
    else:
        print("  (dry-run;加 --apply 才写文件)")
    return 0

if __name__ == "__main__":
    sys.exit(main())
