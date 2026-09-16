# -*- coding: utf-8 -*-
"""
从 ECDICT csv 生成**广覆盖词频表** src/data/word-freq.ts。

为什么需要:难度估计用"覆盖率口径"(读懂 95% 实词需要多少词汇量),
它要求**绝大多数实词都能查到词频名次**。原来的 word-meta.ts 只收录
"考研标签词 + 自备词表"(6798 条),绝大多数实词查不到 → 难度全被顶到上限,
这也是"难度标签没意义、推荐不贴合水平"的数据层原因。

做法:
  1. 取 ECDICT 的 frq(COCA 类语料)与 bnc 名次,两者取更小者作为该词名次;
  2. 名次 > 40000 的词直接丢弃(它们映射的难度已经是上限,收进来只占体积);
  3. 顺带用 exchange 字段把变形词(was/were/making/children…)按同样名次收录;
  4. 输出为紧凑文本表(每行 "word 名次"),TS 侧启动时解析一次。

用法: python scripts/gen-word-freq.py
"""
import csv
import datetime
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV = ROOT / "wordlists" / "ecdict.csv"
OUT = ROOT / "src" / "data" / "word-freq.ts"
# 名次 > 30000 的词映射到的难度已接近上限(≈9300+),留着收益极小却占体积
MAX_RANK = 30000
# 变形词只收录高频那批;低频词的变形由词干还原(lookupCandidates)兜住
INFLECTION_MAX_RANK = 8000


def parse_num(s):
    s = (s or "").strip()
    if not s:
        return None
    try:
        v = int(float(s))
        return v if v > 0 else None
    except ValueError:
        return None


def exchange_forms(raw):
    """ECDICT exchange 形如 'p:was/i:being/3:is/d:been',取出所有变形词。"""
    forms = []
    if not raw:
        return forms
    for part in raw.split("/"):
        if ":" not in part:
            continue
        for form in part.split(":", 1)[1].split("/"):
            form = form.strip().lower()
            if re.fullmatch(r"[a-z][a-z'-]*", form or ""):
                forms.append(form)
    return forms


def main():
    if not CSV.exists():
        print("缺少 %s,请先运行 scripts/fetch-ecdict-meta.py --download-only" % CSV, file=sys.stderr)
        sys.exit(1)

    table = {}
    rows = 0
    with open(CSV, encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            rows += 1
            if rows % 200000 == 0:
                print("  parsed %d rows, kept %d forms" % (rows, len(table)), file=sys.stderr)
            word = (row.get("word") or "").strip().lower()
            if not word or not re.fullmatch(r"[a-z][a-z'-]*", word):
                continue
            frq = parse_num(row.get("frq"))
            bnc = parse_num(row.get("bnc"))
            cands = [v for v in (frq, bnc) if v is not None]
            if not cands:
                continue
            rank = min(cands)
            if rank > MAX_RANK:
                continue
            # 原词始终收录
            prev = table.get(word)
            if prev is None or rank < prev:
                table[word] = rank
            # 变形词只在高频区间收录(体积与准确率的折中)
            if rank <= INFLECTION_MAX_RANK:
                for form in exchange_forms(row.get("exchange")):
                    got = table.get(form)
                    if got is None or rank < got:
                        table[form] = rank

    lines = ["%s %d" % (w, table[w]) for w in sorted(table)]
    body = "\n".join(lines)
    now = datetime.datetime.now().isoformat()
    content = "\n".join(
        [
            "/**",
            " * 常用词词频名次表(自动生成,来源 ECDICT / MIT License © Linwei)。",
            " * 用途:难度估计的覆盖率口径(读懂 95% 实词所需词汇量)、生词率统计。",
            " * 收录:ECDICT 中 frq/bnc 名次 ≤ %d 的词及其变形词(was/making/children…)。" % MAX_RANK,
            " * 词条数: %d" % len(table),
            " * 生成时间: %s" % now,
            " * 格式:每行 'word 名次',运行时解析一次(见 domain/wordfreq.ts)。",
            " */",
            "",
            "export const WORD_FREQ_TEXT = `" + body + "`;",
            "",
            "export const WORD_FREQ_COUNT = %d;" % len(table),
            "",
        ]
    )
    OUT.write_text(content, encoding="utf-8")
    print("kept %d forms from %d rows" % (len(table), rows), file=sys.stderr)
    print("written: %s (%.1f KB)" % (OUT, OUT.stat().st_size / 1024), file=sys.stderr)


if __name__ == "__main__":
    main()
