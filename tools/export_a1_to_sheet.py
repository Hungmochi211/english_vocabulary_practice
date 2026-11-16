"""
export_a1_to_sheet.py
Parse A1 words from Oxford 3000 PDF, enrich with IPA / Vietnamese / examples,
then write them as a new sheet 'A1' into oxford_3000_vocabulary.xlsx.
Same 9-column schema as the existing A2 / B2 sheets.
"""

import os, re, json, time, concurrent.futures
import urllib.request, urllib.parse
import pypdf
import pandas as pd
from openpyxl import load_workbook

# Always run from the project folder so relative paths work
os.chdir(r'c:\TTCN\english_vocabulary_practice')

INPUT_PDF  = 'The_Oxford_3000_by_CEFR_level.pdf'
OUTPUT_XLS = 'oxford_3000_vocabulary.xlsx'
SHEET_NAME = 'A1'
CEFR_LEVEL = 'A1'

TOPICS = [
    'Daily Life & Routines',
    'People & Relationships',
    'Education & Work',
    'Travel & Transportation',
    'Food & Health',
    'Home & Environment',
    'Entertainment & Media',
    'Communication & Feelings',
]

POS_MAP = {
    'n.': 'noun', 'v.': 'verb', 'adj.': 'adjective',
    'adv.': 'adverb', 'prep.': 'preposition', 'conj.': 'conjunction',
    'pron.': 'pronoun', 'det.': 'determiner', 'exclam.': 'interjection',
    'number': 'number', 'modal v.': 'verb',
    'indefinite article': 'article', 'article': 'article',
}


def log(msg):
    print(msg, flush=True)


def assign_topic(word):
    return TOPICS[sum(ord(c) for c in word) % len(TOPICS)]


def normalize_pos_list(pos_str):
    pos_str = str(pos_str).strip()
    raw = [p.strip() for p in re.split(r'[,/]', pos_str) if p.strip()]
    MAP = {
        'noun': 'n.', 'n': 'n.',
        'verb': 'v.', 'v': 'v.',
        'adjective': 'adj.', 'adj': 'adj.',
        'adverb': 'adv.', 'adv': 'adv.',
        'preposition': 'prep.', 'prep': 'prep.',
        'conjunction': 'conj.', 'conj': 'conj.',
        'pronoun': 'pron.', 'pron': 'pron.',
        'determiner': 'det.', 'det': 'det.',
        'exclamation': 'exclam.', 'exclam': 'exclam.',
    }
    tokens, seen, res = [], set(), []
    for t in raw:
        t = MAP.get(t, t if (t.endswith('.') or t == 'number') else t + '.')
        tokens.append(t)
    for t in tokens:
        if t not in seen:
            seen.add(t); res.append(t)
    return res


def fetch_dictionary_data(word, pos):
    full_pos = POS_MAP.get(pos, '')
    url = f'https://api.dictionaryapi.dev/api/v2/entries/en/{urllib.parse.quote(word.strip().lower())}'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    phonetic, example = '', ''
    try:
        with urllib.request.urlopen(req, timeout=6) as r:
            data = json.loads(r.read().decode('utf-8'))
            phonetic = data[0].get('phonetic', '')
            if not phonetic:
                for ph in data[0].get('phonetics', []):
                    if ph.get('text'):
                        phonetic = ph['text']; break
            for m in data[0].get('meanings', []):
                if not full_pos or m.get('partOfSpeech') == full_pos:
                    for d in m.get('definitions', []):
                        if d.get('example'):
                            example = d['example']; break
                    if example: break
            if not example:
                for m in data[0].get('meanings', []):
                    for d in m.get('definitions', []):
                        if d.get('example'):
                            example = d['example']; break
                    if example: break
    except Exception:
        pass
    return phonetic, example


def translate_vi(text):
    if not text:
        return ''
    url = (
        'https://translate.googleapis.com/translate_a/single'
        f'?client=gtx&sl=en&tl=vi&dt=t&q={urllib.parse.quote(text)}'
    )
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, timeout=6) as r:
            res = json.loads(r.read().decode('utf-8'))
            return ''.join(p[0] for p in res[0])
    except Exception:
        return ''


def contextual_vi(word, pos):
    if pos == 'v.':
        raw = translate_vi(f'to {word}')
        return raw[4:] if raw.lower().startswith('den ') else raw
    if pos == 'adj.':
        raw = translate_vi(f'being {word}')
        return raw[5:] if raw.lower().startswith('dang ') else raw
    if pos == 'n.':
        raw = translate_vi(f'the {word}')
        for pre in ('cai ', 'con ', 'su ', 'cac ', 'nhung '):
            if raw.lower().startswith(pre):
                return raw[len(pre):]
        return raw
    return translate_vi(word)


# ---------------------------------------------------------------------------
# PARSE A1 WORDS FROM PDF
# ---------------------------------------------------------------------------

def parse_a1_words():
    log('Reading PDF...')
    reader = pypdf.PdfReader(INPUT_PDF)
    full_text = ''.join(p.extract_text() + '\n' for p in reader.pages)

    lines, current_level, a1_lines = full_text.splitlines(), None, []
    for line in lines:
        line = line.strip()
        if not line or 'Oxford University Press' in line or 'The Oxford 3000' in line:
            continue
        if line in ('A1', 'A2', 'B1', 'B2'):
            current_level = line; continue
        if current_level == 'A1':
            a1_lines.append(line)

    log(f'Raw A1 lines: {len(a1_lines)}')

    pos_pat = (
        r'^(.*?)\s+'
        r'((?:(?:n\.|v\.|adj\.|adv\.|prep\.|conj\.|pron\.|det\.|number'
        r'|exclam\.|modal v\.|indefinite article|article'
        r'|det\./pron\.|det\./adj\.|pron\.)'
        r'[\s,/]*)+)$'
    )

    items = []
    for line in a1_lines:
        # Handle "a, an indefinite article" style (comma-separated words)
        m = re.match(pos_pat, line)
        if m:
            raw_word = m.group(1).strip()
            raw_pos  = m.group(2).strip()
            # Some lines like "a, an indefinite article" — take first token only
            raw_word = raw_word.split(',')[0].strip()
            for pos in normalize_pos_list(raw_pos):
                items.append({'raw_word': raw_word, 'pos': pos})
        else:
            parts = line.split()
            if parts:
                items.append({'raw_word': parts[0], 'pos': ' '.join(parts[1:])})

    log(f'Total A1 items (after POS expansion): {len(items)}')
    return items


# ---------------------------------------------------------------------------
# PROCESS SINGLE ITEM
# ---------------------------------------------------------------------------

def process_item(item):
    raw_word = item['raw_word']
    pos      = item['pos']

    # Clean: strip trailing digits and parenthetical notes
    clean_w = re.sub(r'\d+', '', raw_word).strip()
    clean_w = re.sub(r'\(.*?\)', '', clean_w).strip()
    if not clean_w:
        clean_w = raw_word

    phonetic, example_en = fetch_dictionary_data(clean_w, pos)

    # Fallback examples (simple A1-level)
    if not example_en:
        if   'v.'   in pos: example_en = f'I {clean_w} every day.'
        elif 'adj.' in pos: example_en = f'It is very {clean_w}.'
        elif 'adv.' in pos: example_en = f'She speaks {clean_w}.'
        elif 'n.'   in pos: example_en = f'This is a {clean_w}.'
        else:               example_en = f'I know what {clean_w} means.'

    vi_meaning = contextual_vi(clean_w, pos)
    if not vi_meaning or len(vi_meaning) > 60:
        vi_meaning = translate_vi(clean_w)
    example_vi = translate_vi(example_en)

    return {
        'word':               clean_w,
        'cefr_level':         CEFR_LEVEL,
        'part_of_speech':     pos,
        'phonetic':           phonetic,
        'vietnamese_meaning': vi_meaning,
        'example_en':         example_en,
        'example_vi':         example_vi,
        'topic':              assign_topic(clean_w),
    }


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

def main():
    items = parse_a1_words()

    results, batch_size, total = [], 15, len(items)
    log('Enriching A1 data with phonetics, translations, examples...')

    for start in range(0, total, batch_size):
        end   = min(start + batch_size, total)
        batch = items[start:end]

        with concurrent.futures.ThreadPoolExecutor(max_workers=batch_size) as ex:
            futures = [ex.submit(process_item, it) for it in batch]
            for fut in concurrent.futures.as_completed(futures):
                try:
                    results.append(fut.result())
                except Exception as e:
                    log(f'  [ERROR] {e}')

        log(f'  Processed: {len(results)}/{total}')
        time.sleep(0.4)

    # Sort alphabetically by word then POS
    results.sort(key=lambda r: (r['word'].lower(), r['part_of_speech']))
    for idx, r in enumerate(results):
        r['id'] = idx + 1

    cols = ['id', 'word', 'cefr_level', 'part_of_speech', 'phonetic',
            'vietnamese_meaning', 'example_en', 'example_vi', 'topic']
    df = pd.DataFrame(results)[cols]
    log(f'\nTotal A1 rows to write: {len(df)}')
    log(df.head(5).to_string(index=False))

    # --- Write into existing workbook using openpyxl directly ---
    log(f'\nOpening {OUTPUT_XLS}...')
    book = load_workbook(OUTPUT_XLS)

    if SHEET_NAME in book.sheetnames:
        log(f"  Sheet '{SHEET_NAME}' already exists - removing old one first.")
        del book[SHEET_NAME]

    ws = book.create_sheet(SHEET_NAME)

    # Header
    ws.append(list(df.columns))

    # Data rows
    for row in df.itertuples(index=False):
        ws.append(list(row))

    # Move A1 to first position
    book.move_sheet(SHEET_NAME, offset=-len(book.sheetnames) + 1)

    book.save(OUTPUT_XLS)
    book.close()

    log(f"SUCCESS! Sheet '{SHEET_NAME}' with {len(df)} rows added to '{OUTPUT_XLS}'.")


if __name__ == '__main__':
    main()
