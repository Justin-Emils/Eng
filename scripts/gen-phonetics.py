# -*- coding: utf-8 -*-
"""
从 ECDICT 生成统一音标表 src/data/phonetics.ts。

为什么需要:词典有三层(ext-words → CORE_DICT → 文章重点词),后两层覆盖释义时
会把音标一起覆盖掉;CORE_DICT 本身压根没有音标字段。结果就是常用词(如 the/and)
反而显示"暂无音标"。

做法:把 ext-words ∪ CORE_DICT ∪ 全部文章正文词 ∪ 考研词形表 的词形收集起来,
从 ECDICT 取归一化音标,生成一份 word → IPA 的表;词典合并时用它兜底。

用法: python scripts/gen-phonetics.py
"""
import csv, io, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV = ROOT / ".artifacts" / "ecdict" / "ecdict.csv"
OUT = ROOT / "src" / "data" / "phonetics.ts"

sys.path.insert(0, str(ROOT / "scripts"))
from importlib import util
spec = util.spec_from_file_location("pp", ROOT / "scripts" / "patch-phonetics.py")
pp = util.module_from_spec(spec)
spec.loader.exec_module(pp)  # 复用 normalize()

def collect_words():
    words = set()

    # 1) ext-words 的 key
    s = io.open(ROOT / "src" / "data" / "ext-words.ts", encoding="utf-8").read()
    words |= {w.lower() for w in re.findall(r'(?m)^  "([^"]+)": \{', s)}

    # 2) CORE_DICT 的 key
    s = io.open(ROOT / "src" / "data" / "dict-core.ts", encoding="utf-8").read()
    words |= {w.lower() for w in re.findall(r'(?m)^  ([a-zA-Z][a-zA-Z\'-]*): \{', s)}

    # 3) 文章正文里的词
    art_dir = ROOT / "src" / "data" / "articles"
    art_text = []
    for f in art_dir.glob("*.ts"):
        if f.name in ("index.ts", "build.ts", "remote-registry.ts"):
            continue
        t = io.open(f, encoding="utf-8").read()
        for m in re.findall(r"(?:text|body|paragraphs?):\s*['\"]([^'\"]{20,})['\"]", t):
            art_text.append(m)
        # 纯字符串数组里的段落
        for m in re.findall(r"['\"]([A-Z][^'\"]{40,})['\"]", t):
            art_text.append(m)
    for chunk in art_text:
        for tok in re.findall(r"[A-Za-z][A-Za-z'-]+", chunk):
            w = tok.lower().strip("'-")
            if len(w) >= 2:
                words.add(w)

    # 3b) 文章重点词(keyWords 的 headword)——这些词直接作为词条展示,最需要音标
    for f in art_dir.glob("*.ts"):
        if f.name in ("index.ts", "build.ts", "remote-registry.ts"):
            continue
        t = io.open(f, encoding="utf-8").read()
        words |= {w.lower() for w in re.findall(r"headword:\s*'([^']+)'", t)}

    # 4) 考研词形表
    s = io.open(ROOT / "src" / "data" / "external-wordlist.ts", encoding="utf-8").read()
    m = re.search(r"\[\s*(.*?)\s*\]", s, re.S)
    if m:
        words |= {w.lower() for w in re.findall(r'"([A-Za-z][A-Za-z\'-]+)"', m.group(1))}
    return words

def main():
    if not CSV.exists():
        print("缺少 ecdict.csv"); return 1
    words = collect_words()
    print(f"目标词形: {len(words)}")

    # 流式读 CSV,只保留需要的
    ipa = {}
    with io.open(CSV, encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            w = (row.get("word") or "").strip().lower()
            if w not in words or w in ipa:
                continue
            p = pp.normalize(row.get("phonetic") or "")
            if p:
                ipa[w] = p
            if len(ipa) >= len(words):
                pass

    # 复合词(空格/连字符)拼读音
    def derive(w):
        for sep in ("-", " "):
            if sep in w:
                parts = [x for x in w.split(sep) if x]
                if parts and all(x in ipa for x in parts):
                    return ("-" if sep == "-" else " ").join(ipa[x] for x in parts)
        return None

    # 屈折形式:-ed / -s / -ing 按英语音变规则接在词根音标后面
    VOICELESS = set('ptkfθsʃ')          # 清辅音后 -ed/-s 读 /t/、/s/
    SIBILANT = ('s', 'z', 'ʃ', 'ʒ', 'tʃ', 'dʒ')
    VOWELS = set('iɪeɛæaɑɒɔʊuʌəɜɚɝ')
    def inflect(base_ipa, suffix):
        last = base_ipa[-1]
        if suffix == 'ed':
            if last in ('t', 'd'):
                return base_ipa + 'ɪd'
            if last in VOICELESS:
                return base_ipa + 't'
            return base_ipa + 'd'
        if suffix == 's':
            if base_ipa.endswith(SIBILANT):
                return base_ipa + 'ɪz'
            if last in VOICELESS:
                return base_ipa + 's'
            return base_ipa + 'z'
        if suffix == 'ing':
            return base_ipa + 'ɪŋ'
        # 派生后缀:直接拼接后缀本身的读音(比"词根（后缀）"这种写法干净得多)
        if suffix == 'ly':
            return base_ipa + 'li'
        if suffix == 'ness':
            return base_ipa + 'nəs'
        if suffix == 'ment':
            return base_ipa + 'mənt'
        if suffix in ('er', 'est'):
            # 比较级/最高级:词根以 ə/ɜ/ɑ 结尾(clear /kliə/)时补一个连接 r
            link = 'r' if base_ipa and base_ipa[-1] in ('ə', 'ɜ', 'ɑ') else ''
            return base_ipa + link + ('ə' if suffix == 'er' else 'ɪst')
        return None

    def from_inflection(w):
        for suffix, bases in (
            ('ed', [w[:-2], w[:-1]]),
            ('ing', [w[:-3], w[:-3] + 'e']),
            ('s', [w[:-1]]),
            ('ly', [w[:-2]]),
            ('er', [w[:-2], w[:-1]]),
            ('est', [w[:-3]]),
            ('ness', [w[:-4]]),
            ('ment', [w[:-4]]),
        ):
            if not w.endswith(suffix) or len(w) <= len(suffix) + 1:
                continue
            for b in bases:
                if b in ipa:
                    r = inflect(ipa[b], suffix)
                    if r:
                        return r
        return None

    derived = 0
    for w in sorted(words):
        if w in ipa:
            continue
        d = derive(w)
        if d:
            ipa[w] = d
            derived += 1
            continue
        f = from_inflection(w)
        if f:
            ipa[w] = f
            derived += 1

    print(f"生成音标: {len(ipa)} 条(其中复合词推导 {derived}),未覆盖 {len(words)-len(ipa)}")

    lines = [
        "/**",
        " * 统一音标表(ECDICT 子集,音标已归一化为标准 IPA)。",
        " * 来源: ECDICT(https://github.com/skywind3000/ECDICT) MIT License。",
        f" * 生成时间: {__import__('datetime').datetime.now().isoformat()}",
        f" * 词条数: {len(ipa)}",
        " *",
        " * 用途:词典的三层数据(ext-words / CORE_DICT / 文章重点词)后两层覆盖释义时会把",
        " * 音标一起覆盖掉,由这份表在合并时兜底,保证「能查到释义的词也能看到音标」。",
        " * 生成脚本: scripts/gen-phonetics.py(请勿手改)。",
        " */",
        "",
        "export const PHONETICS: Record<string, string> = {",
    ]
    for w in sorted(ipa):
        lines.append(f'  {json.dumps(w, ensure_ascii=False)}: {json.dumps(ipa[w], ensure_ascii=False)},')
    lines.append("};")
    lines.append("")
    io.open(OUT, "w", encoding="utf-8", newline="\n").write("\n".join(lines))
    print(f"已写入 {OUT.relative_to(ROOT)}({OUT.stat().st_size/1024:.0f} KB)")
    return 0

if __name__ == "__main__":
    sys.exit(main())
