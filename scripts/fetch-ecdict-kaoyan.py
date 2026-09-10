# -*- coding: utf-8 -*-
"""
从 ECDICT(MIT License)生成考研词释义库:
流式读取 ecdict.csv。保留满足任一条件的词条:
  (a) tag 含 'ky'(ECDICT 自带考研标签),或
  (b) 词形在用户词表 external-wordlist(考研红宝书词形表)中。
输出 src/data/ext-words.ts(DictEntry),供离线词典并入。

音标字段会做字符清洗:不含标准 IPA/ASCII 的字符置空(ECDICT 源内音标质量不稳)。
用法: python scripts/fetch-ecdict-kaoyan.py
"""
import csv
import datetime
import io
import json
import re
import sys
import urllib.request
import ssl
from pathlib import Path

URL = "https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv"
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "data" / "ext-words.ts"
USERLIST = ROOT / "src" / "data" / "external-wordlist.ts"

# 可接受的音标字符(ASCII + 常见 IPA 符号)
PHONETIC_OK = re.compile(r"^[A-Za-z0-9 ˌˈ.\-əɪʊæɑɔɛʌɜːθðʃʒŋɡɒ'ˈ]+$", re.IGNORECASE)


def load_user_words():
    """从 external-wordlist.ts 读取词形集合(尽力解析)。"""
    if not USERLIST.exists():
        return set()
    try:
        txt = USERLIST.read_text(encoding="utf-8")
        m = re.search(r"EXTERNAL_WORDLIST:\s*readonly string\[\]\s*=\s*(\[.*?\]);", txt, re.S)
        if not m:
            return set()
        return set(json.loads(m.group(1)))
    except Exception as e:
        print("warn: parse user list failed", e, file=sys.stderr)
        return set()


def fetch_filter(user_words):
    ctx = ssl.create_default_context()
    req = urllib.request.Request(URL, headers={"User-Agent": "curl/8"})
    entries = {}
    source_rows = 0
    both_hits = 0
    with urllib.request.urlopen(req, timeout=600, context=ctx) as resp:
        reader = csv.DictReader(io.TextIOWrapper(resp, encoding="utf-8", newline=""))
        for row in reader:
            source_rows += 1
            if source_rows % 200000 == 0:
                print("  scanned", source_rows, file=sys.stderr)
            word = (row.get("word") or "").strip().lower()
            if not word:
                continue
            tag = (row.get("tag") or "").strip().replace(",", " ")
            is_ky = "ky" in tag.split()
            in_user = word in user_words
            if not (is_ky or in_user):
                continue
            if is_ky and in_user:
                both_hits += 1
            zh = (row.get("translation") or "").replace("\\n", "\n").strip()
            en = (row.get("definition") or "").replace("\\n", "\n").strip()
            if not zh and not en:
                continue
            pos = (row.get("pos") or "").strip()
            phonetic = (row.get("phonetic") or "").strip()
            if phonetic and not PHONETIC_OK.match(phonetic):
                phonetic = ""
            entries[word] = {
                "headword": word,
                "phonetic": phonetic or None,
                "pos": pos,
                "zh": zh,
                "en": en,
                "example": None,
            }
    return entries, source_rows, both_hits


def build_ts(entries, source_rows, both_hits, user_count):
    now = datetime.datetime.now().isoformat()
    src_note = (
        "考研词释义库(ECDICT 子集)。来源: ECDICT(https://github.com/skywind3000/ECDICT) "
        "MIT License;词条 = ECDICT tag=ky(考研) ∪ 用户考研词形表;释义版权归 ECDICT 数据来源,按 MIT 使用。"
    )
    L = []
    L.append("/**")
    L.append(" * " + src_note)
    L.append(" * 生成时间: " + now)
    L.append(" * 词条数: %d (扫描 %d 行; ky∩用户词表 %d; 用户词表 %d)" % (
        len(entries), source_rows, both_hits, user_count))
    L.append(" */")
    L.append("import type { DictEntry } from '@/data/dict-core';")
    L.append("")
    L.append("export type ExternalDictEntry = DictEntry;")
    L.append("")
    L.append("export const EXTERNAL_DICT_META = {")
    L.append("  generatedAt: %s," % json.dumps(now))
    L.append("  source: '考研英语(ECDICT ky ∪ 用户词形表, MIT)',")
    L.append("  count: %d," % len(entries))
    L.append("};")
    L.append("")
    L.append("export const EXTERNAL_DICT: Record<string, ExternalDictEntry> = {")
    for word in sorted(entries):
        e = entries[word]
        # 移除 None 值字段(null 不符合 DictEntry 可选字段类型)
        clean = {k: v for k, v in e.items() if v is not None}
        L.append("  %s: %s," % (json.dumps(word), json.dumps(clean, ensure_ascii=False)))
    L.append("};")
    L.append("")
    return "\n".join(L)


def main():
    user_words = load_user_words()
    print("user wordlist size: %d" % len(user_words), file=sys.stderr)
    entries, source_rows, both_hits = fetch_filter(user_words)
    print("kept %d words (both=%d)" % (len(entries), both_hits), file=sys.stderr)
    OUT.write_text(build_ts(entries, source_rows, both_hits, len(user_words)), encoding="utf-8")
    print("written:", OUT, file=sys.stderr)


if __name__ == "__main__":
    main()
