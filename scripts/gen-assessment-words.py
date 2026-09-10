# -*- coding: utf-8 -*-
"""
生成"自适应评估"测试词(与正文标蓝同一门槛口径):
完全人工策展 72 个词(真正常见/递进的单词),映射到统一门槛函数
(最低考试标签→档;无标签用词频)计算的实际档位,输出 assessment-words.ts。
不再自动补足,避免低质量词混入。
"""
import csv
import datetime
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV = ROOT / "wordlists" / "ecdict.csv"
OUT = ROOT / "src" / "data" / "assessment-words.ts"

BANDS = [
    (1500, ["zk"]),
    (3000, ["gk"]),
    (4200, ["cet4"]),
    (5500, ["ky", "cet6"]),
    (7500, ["toefl", "ielts"]),
    (9500, ["gre", "sat"]),
]
TAG_TO_BAND = {}
for threshold, tags in BANDS:
    for t in tags:
        TAG_TO_BAND.setdefault(t, threshold)

# 人工策展:由易到难,每个词都是正常的单词(最终档位以函数计算为准)
CURATED = [
    "cat", "dog", "book", "water", "house", "friend", "school", "apple", "mother", "teacher", "walk", "today",
    "journey", "appreciate", "assume", "aware", "benefit", "challenge", "consequence", "demand", "familiar", "promise", "weather", "travel",
    "efficient", "anticipate", "emerge", "inevitable", "reluctant", "phenomenon", "decline", "evident", "strategy", "estimate", "purchase", "debate",
    "controversy", "aesthetic", "deteriorate", "empirical", "facilitate", "hierarchy", "incentive", "legitimate", "ambiguous", "accumulate", "compensate", "abandon",
    "credible", "anomaly", "allude", "cogent", "ephemeral", "zealot", "adversary", "mitigate", "nuance", "pragmatic", "scrutiny", "alleviate",
    "aberrant", "acquiesce", "ameliorate", "esoteric", "flagrant", "pernicious", "specious", "ubiquitous", "vacillate", "abnegate", "abominate", "aboveboard",
]

META = {}
with open(CSV, encoding="utf-8", newline="") as f:
    for row in csv.DictReader(f):
        w = (row.get("word") or "").strip().lower()
        if not w:
            continue
        tags = [t for t in (row.get("tag") or "").replace(",", " ").split() if t in TAG_TO_BAND]
        frq = 0
        try:
            frq = int(float((row.get("frq") or "").strip() or 0))
        except ValueError:
            frq = 0
        META.setdefault(w, {"tags": tags, "frq": frq})


def actual_band(word):
    m = META.get(word)
    if not m:
        return None
    if m["tags"]:
        return min((TAG_TO_BAND[t] for t in m["tags"]), default=None)
    if m["frq"] > 0:
        t = 500 + (min(m["frq"], 40000) / 40000) * 11500
        return min((b for b, _ in BANDS), key=lambda b: abs(b - t))
    return None


def main():
    buckets = {b: [] for b, _ in BANDS}
    used = set()
    for w in CURATED:
        b = actual_band(w.lower())
        if b is not None and w.lower() not in used:
            used.add(w.lower())
            buckets[b].append(w.lower())

    items = []
    for band, _ in BANDS:
        for w in buckets[band]:
            items.append({"word": w, "threshold": band})

    now = datetime.datetime.now().isoformat()
    body = (
        "/**\n"
        " * 自适应评估测试词(自动生成)。档位口径与正文标蓝一致(最低考试标签→档)。\n"
        " * 来源: ECDICT(MIT);人工策展 72 词。生成时间: " + now + "\n"
        " * 词数: %d\n"
        " */\n" % len(items)
        + "export interface AssessWord { word: string; threshold: number; }\n\n"
        + "export const ASSESSMENT_WORDS: AssessWord[] = "
        + json.dumps(items, ensure_ascii=False)
        + ";\n"
    )
    OUT.write_text(body, encoding="utf-8")
    print("written %d words" % len(items), file=sys.stderr)
    for band, _ in BANDS:
        print("band %d: %d" % (band, len(buckets[band])), file=sys.stderr)


if __name__ == "__main__":
    main()
