"""
export_b1_to_sheet.py
Parse B1 words from Oxford 3000 PDF, enrich with IPA / Vietnamese / examples,
and insert as a new sheet 'B1' into oxford_3000_vocabulary.xlsx.
Preserve the standard 9-column schema and logical sheet order: ['A1', 'A2', 'B1', 'B2'].
"""

import os
import re
import json
import time
import concurrent.futures
import urllib.request
import urllib.parse
import pypdf
import pandas as pd
import eng_to_ipa as ipa
from openpyxl import load_workbook

os.chdir(r'c:\TTCN\english_vocabulary_practice')

INPUT_PDF  = 'The_Oxford_3000_by_CEFR_level.pdf'
OUTPUT_XLS = 'oxford_3000_vocabulary.xlsx'
SHEET_NAME = 'B1'
CEFR_LEVEL = 'B1'

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
}

SPECIAL_FIXES = {
    'bank (river)': ('bank', 'n.', '/bæŋk/', 'bờ sông, bờ đê', 'We sat on the grassy bank of the river enjoying the sunset.', 'Chúng tôi ngồi trên bờ sông đầy cỏ ngắm hoàng hôn.'),
    'close2': ('close', 'adv.', '/kloʊs/', 'gần, sát gần', 'The two houses were built very close to each other.', 'Hai ngôi nhà được xây rất sát nhau.'),
    'content1': ('content', 'n.', '/ˈkɑntɛnt/', 'nội dung, lượng', 'The educational content of this course is very comprehensive.', 'Nội dung giáo dục của khóa học này rất toàn diện.'),
    'kind (caring)': ('kind', 'adj.', '/kaɪnd/', 'tử tế, ân cần, tốt bụng', 'She was always very kind to animals and strangers.', 'Cô ấy luôn rất tốt bụng với động vật và người lạ.'),
    'lead1': ('lead', 'n.', '/lɛd/', 'chì (kim loại)', 'Lead is a dense metal that has been used for centuries.', 'Chì là một kim loại nặng đã được sử dụng trong nhiều thế kỷ.'),
    'lie2 (tell a lie)': ('lie', 'v.', '/laɪ/', 'nói dối', 'It is never a good idea to lie to your friends.', 'Nói dối bạn bè của mình không bao giờ là ý hay.'),
    'like (find sb/sth pleasant)': ('like', 'n.', '/laɪk/', 'sở thích, lượt thích', 'Her video received millions of likes and shares online.', 'Video của cô ấy đã nhận được hàng triệu lượt thích và chia sẻ trực tuyến.'),
    'live2': ('live', 'adj.', '/laɪv/', 'trực tiếp, sống động', 'The band gave an amazing live performance last night.', 'Ban nhạc đã có một buổi biểu diễn trực tiếp tuyệt vời tối qua.'),
    'mine (hole in the ground)': ('mine', 'n.', '/maɪn/', 'hầm mỏ, mỏ khoáng sản', 'His father worked in a deep coal mine for thirty years.', 'Bố anh ấy đã làm việc trong một mỏ than sâu suốt ba mươi năm.'),
    'plus1': ('plus', 'prep.', '/plʌs/', 'cộng với, thêm vào đó', 'The price is fifty dollars plus delivery charges.', 'Giá là năm mươi đô la cộng thêm phí giao hàng.'),
    'race (of people)': ('race', 'n.', '/reɪs/', 'chủng tộc', 'People of every race and background are welcome here.', 'Mọi người thuộc mọi chủng tộc và hoàn cảnh đều được chào đón ở đây.'),
    'ring2': ('ring', 'n.', '/rɪŋ/', 'chiếc nhẫn, vòng tròn', 'He gave her a beautiful gold ring for their anniversary.', 'Anh ấy tặng cô ấy một chiếc nhẫn vàng tuyệt đẹp nhân ngày kỷ niệm.'),
    'row1': ('row', 'n.', '/roʊ/', 'hàng, dãy', 'We found our seats in the front row of the theater.', 'Chúng tôi tìm thấy chỗ ngồi của mình ở hàng đầu tiên của nhà hát.'),
    'set (put)': ('set', 'v.', '/sɛt/', 'đặt, để, bố trí', 'She set the crystal vase carefully on the table.', 'Cô ấy cẩn thận đặt chiếc bình pha lê lên bàn.'),
    'set (group)': ('set', 'n.', '/sɛt/', 'bộ, tập hợp', 'He bought a new set of golf clubs last weekend.', 'Anh ấy đã mua một bộ gậy đánh golf mới vào cuối tuần trước.'),
    'stick (push into/attach)': ('stick', 'v.', '/stɪk/', 'dán, gắn, cắm chặt', 'Please stick this warning label on the cardboard box.', 'Vui lòng dán nhãn cảnh báo này lên hộp các-tông.'),
    'stick (piece of wood)': ('stick', 'n.', '/stɪk/', 'cành cây, que củi, gậy', 'The dog ran into the park to fetch a wooden stick.', 'Chú chó chạy vào công viên để nhặt một que gỗ.'),
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
            seen.add(t)
            res.append(t)
    return res

def fetch_dictionary_data(word, pos):
    full_pos = POS_MAP.get(pos, '')
    clean_w = word.strip().lower()
    url = f'https://api.dictionaryapi.dev/api/v2/entries/en/{urllib.parse.quote(clean_w)}'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    phonetic, example = '', ''
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            data = json.loads(r.read().decode('utf-8'))
            phonetic = data[0].get('phonetic', '')
            if not phonetic:
                for ph in data[0].get('phonetics', []):
                    if ph.get('text'):
                        phonetic = ph['text']
                        break
            for m in data[0].get('meanings', []):
                if not full_pos or m.get('partOfSpeech') == full_pos:
                    for d in m.get('definitions', []):
                        if d.get('example'):
                            example = d['example']
                            break
                    if example:
                        break
            if not example:
                for m in data[0].get('meanings', []):
                    for d in m.get('definitions', []):
                        if d.get('example'):
                            example = d['example']
                            break
                    if example:
                        break
    except Exception:
        pass

    # Standardize phonetic: if empty or bracketed [abc], use eng_to_ipa
    if not phonetic or '[' in phonetic or ']' in phonetic or not phonetic.startswith('/'):
        clean_ipa = re.sub(r'[^a-zA-Z\s\-\']', '', clean_w).strip()
        conv = ipa.convert(clean_ipa).replace('*', '')
        phonetic = f'/{conv}/'

    return phonetic, example

def translate_text(text):
    if not text or pd.isna(text) or str(text).strip() == '':
        return ''
    clean_t = str(text).strip()
    url = f'https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=vi&q={urllib.parse.quote(clean_t)}'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    for _ in range(3):
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                if isinstance(data, list) and len(data) > 0:
                    return str(data[0]).strip()
                return str(data).strip()
        except Exception:
            time.sleep(0.3)
    return ''

def contextual_vi(word, pos):
    if pos == 'v.':
        raw = translate_text(f'to {word}')
        if raw.lower().startswith('đến '):
            return raw[4:]
        return raw
    elif pos == 'adj.':
        raw = translate_text(f'being {word}')
        if raw.lower().startswith('đang '):
            return raw[5:]
        return raw
    elif pos == 'n.':
        raw = translate_text(f'the {word}')
        for pre in ('cái ', 'con ', 'sự ', 'các ', 'những '):
            if raw.lower().startswith(pre):
                return raw[len(pre):]
        return raw
    return translate_text(word)

def parse_b1_words():
    log('Reading PDF for B1 words...')
    reader = pypdf.PdfReader(INPUT_PDF)
    full_text = ''.join(p.extract_text() + '\n' for p in reader.pages)

    lines, cur, b1_lines = full_text.splitlines(), None, []
    for line in lines:
        line = line.strip()
        if not line or 'Oxford University Press' in line or 'The Oxford 3000' in line:
            continue
        if line in ('A1', 'A2', 'B1', 'B2'):
            cur = line
            continue
        if cur == 'B1':
            b1_lines.append(line)

    log(f'Raw B1 lines from PDF: {len(b1_lines)}')

    pos_pat = (
        r'^(.*?)\s+'
        r'((?:(?:n\.|v\.|adj\.|adv\.|prep\.|conj\.|pron\.|det\.|number'
        r'|exclam\.|modal v\.|indefinite article|article'
        r'|det\./pron\.|det\./adj\.|pron\.)'
        r'[\s,/]*)+)$'
    )

    items = []
    for line in b1_lines:
        m = re.match(pos_pat, line)
        if m:
            raw_w = m.group(1).strip()
            raw_pos = m.group(2).strip()
            pos_list = normalize_pos_list(raw_pos)
            for p in pos_list:
                items.append({'raw_word': raw_w, 'pos': p})
        else:
            parts = line.split()
            if parts:
                items.append({'raw_word': parts[0], 'pos': ' '.join(parts[1:])})

    log(f'Total B1 items after Multi-POS expansion: {len(items)}')
    return items

def process_item(item):
    raw_w = item['raw_word']
    pos = item['pos']

    # Check special fix dictionary first
    if raw_w in SPECIAL_FIXES:
        w, p, ph, m_vn, ex_en, ex_vi = SPECIAL_FIXES[raw_w]
        return {
            'word': w,
            'cefr_level': CEFR_LEVEL,
            'part_of_speech': p,
            'phonetic': ph,
            'vietnamese_meaning': m_vn,
            'example_en': ex_en,
            'example_vi': ex_vi,
            'topic': assign_topic(w),
        }

    # Clean word
    clean_w = re.sub(r'\d+', '', raw_w).strip()
    clean_w = re.sub(r'\(.*?\)', '', clean_w).strip()
    if not clean_w:
        clean_w = raw_w

    phonetic, example_en = fetch_dictionary_data(clean_w, pos)

    # Fallback example sentence
    if not example_en:
        if 'v.' in pos:
            example_en = f'They decided to {clean_w} the situation carefully.'
        elif 'adj.' in pos:
            example_en = f'This method is considered quite {clean_w} in modern research.'
        elif 'adv.' in pos:
            example_en = f'The project was {clean_w} completed by the team.'
        elif 'n.' in pos:
            example_en = f'The importance of {clean_w} cannot be overstated.'
        else:
            example_en = f'It is essential to understand the concept of {clean_w}.'

    vi_meaning = contextual_vi(clean_w, pos)
    if not vi_meaning or len(vi_meaning) > 60:
        vi_meaning = translate_text(clean_w)
    example_vi = translate_text(example_en)

    return {
        'word': clean_w,
        'cefr_level': CEFR_LEVEL,
        'part_of_speech': pos,
        'phonetic': phonetic,
        'vietnamese_meaning': vi_meaning,
        'example_en': example_en,
        'example_vi': example_vi,
        'topic': assign_topic(clean_w),
    }

def main():
    items = parse_b1_words()

    results = []
    batch_size = 20
    total = len(items)

    log(f'Starting data enrichment for {total} B1 items...')
    for start in range(0, total, batch_size):
        end = min(start + batch_size, total)
        batch = items[start:end]

        with concurrent.futures.ThreadPoolExecutor(max_workers=batch_size) as executor:
            futures = [executor.submit(process_item, it) for it in batch]
            for fut in concurrent.futures.as_completed(futures):
                try:
                    results.append(fut.result())
                except Exception as e:
                    log(f'  [ERROR] {e}')

        log(f'  Processed: {len(results)}/{total}')
        time.sleep(0.3)

    # Sort alphabetically by word then POS
    results.sort(key=lambda r: (r['word'].lower(), r['part_of_speech']))
    for idx, r in enumerate(results):
        r['id'] = idx + 1

    cols = ['id', 'word', 'cefr_level', 'part_of_speech', 'phonetic',
            'vietnamese_meaning', 'example_en', 'example_vi', 'topic']
    df = pd.DataFrame(results)[cols]
    log(f'\nTotal B1 rows to write: {len(df)}')
    log(df.head(5).to_string(index=False))

    # Verify no nulls and no brackets
    log('\nVerification of B1 data:')
    log(f'Null counts:\n{df.isna().sum().to_string()}')
    brackets = df[df['phonetic'].astype(str).str.contains(r'\[|\]', regex=True)]
    log(f'Brackets in phonetic count: {len(brackets)}')

    # ------------------------------------------------------------------
    # Write into existing workbook as sheet 'B1'
    # Preserve logical sheet order: ['A1', 'A2', 'B1', 'B2']
    # ------------------------------------------------------------------
    log(f'\nOpening {OUTPUT_XLS}...')
    book = load_workbook(OUTPUT_XLS)

    if SHEET_NAME in book.sheetnames:
        log(f"  Removing existing '{SHEET_NAME}' sheet first...")
        del book[SHEET_NAME]

    ws = book.create_sheet(SHEET_NAME)
    ws.append(list(df.columns))
    for row in df.itertuples(index=False):
        ws.append(list(row))

    # Reorder sheets to: ['A1', 'A2', 'B1', 'B2']
    target_order = ['A1', 'A2', 'B1', 'B2']
    # Keep only existing sheets in target_order + any extra
    existing_sheets = [s for s in target_order if s in book.sheetnames] + [s for s in book.sheetnames if s not in target_order]
    book._sheets = [book[s] for s in existing_sheets]

    log(f'New sheet order: {book.sheetnames}')
    book.save(OUTPUT_XLS)
    book.close()

    log(f"SUCCESS! Sheet '{SHEET_NAME}' with {len(df)} rows added to '{OUTPUT_XLS}'.")

if __name__ == '__main__':
    main()
