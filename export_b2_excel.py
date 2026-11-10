import pypdf
import re
import urllib.request
import urllib.parse
import json
import time
import concurrent.futures
import pandas as pd
import eng_to_ipa as ipa
import os

TOPICS = [
    'Business & Workplace',
    'Society & Law',
    'Science & Technology',
    'Media & Culture',
    'Health & Environment',
    'Academic & Education',
    'Travel & Global Issues',
    'Personal & Social Psychology'
]

def assign_topic(word):
    h = sum(ord(c) for c in word) % len(TOPICS)
    return TOPICS[h]

POS_MAP = {
    'n.': 'noun',
    'v.': 'verb',
    'adj.': 'adjective',
    'adv.': 'adverb',
    'prep.': 'preposition',
    'conj.': 'conjunction',
    'pron.': 'pronoun',
    'exclam.': 'interjection'
}

SPECIAL_FIXES = {
    'close1': ('close', 'n.', '/kloʊz/', 'sự kết thúc, phần kết', 'The investigation was brought to a close.', 'Cuộc điều tra đã được đưa đến hồi kết.'),
    'pension1': ('pension', 'n.', '/ˈpɛnʃən/', 'tiền lương hưu', 'He receives a monthly pension after retirement.', 'Ông nhận được tiền lương hưu hàng tháng sau khi nghỉ hưu.'),
    'tear1': ('tear', 'v.', '/tɛər/', 'xé rách', 'Be careful not to tear the paper.', 'Hãy cẩn thận kẻo làm rách tờ giấy.'),
    'tear2': ('tear', 'n.', '/tɪər/', 'nước mắt', 'A single tear ran down her cheek.', 'Một giọt nước mắt lăn dài trên má cô ấy.'),
    'wind2': ('wind', 'v.', '/waɪnd/', 'uốn lượn, cuốn lại, lên dây cót', 'The path winds through the dense forest.', 'Con đường mòn uốn lượn qua khu rừng rậm rạp.'),
    'bear (deal with)': ('bear', 'v.', '/bɛər/', 'chịu đựng', 'I cannot bear this painful headache any longer.', 'Tôi không thể chịu đựng cơn đau đầu dữ dội này thêm nữa.')
}

def normalize_pos_list(pos_str):
    pos_str = str(pos_str).strip()
    raw_tokens = [p.strip() for p in re.split(r'[,/]', pos_str) if p.strip()]
    tokens = []
    for t in raw_tokens:
        if t in ['noun', 'n']:
            tokens.append('n.')
        elif t in ['verb', 'v']:
            tokens.append('v.')
        elif t in ['adjective', 'adj']:
            tokens.append('adj.')
        elif t in ['adverb', 'adv']:
            tokens.append('adv.')
        elif t in ['preposition', 'prep']:
            tokens.append('prep.')
        elif t in ['conjunction', 'conj']:
            tokens.append('conj.')
        elif t in ['pronoun', 'pron']:
            tokens.append('pron.')
        elif t in ['exclamation', 'exclam']:
            tokens.append('exclam.')
        elif t in ['determiner', 'det']:
            tokens.append('det.')
        else:
            tokens.append(t if t.endswith('.') or t in ['number'] else t + '.')
    seen = set()
    res = []
    for t in tokens:
        if t not in seen:
            seen.add(t)
            res.append(t)
    return res

def get_vietnamese_trans(text):
    if not text:
        return ''
    url = f'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q={urllib.parse.quote(text)}'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            res = json.loads(resp.read().decode('utf-8'))
            return ''.join([part[0] for part in res[0]])
    except Exception:
        return ''

def fetch_dictionary_info(word, pos):
    full_pos = POS_MAP.get(pos, '')
    clean_w = word.strip().lower()
    url = f'https://api.dictionaryapi.dev/api/v2/entries/en/{urllib.parse.quote(clean_w)}'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    phonetic = ''
    example = ''
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode('utf-8'))
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
                            example = d.get('example')
                            break
                    if example:
                        break
    except Exception:
        pass

    # Fallback for phonetic via eng-to-ipa
    if not phonetic:
        clean_for_ipa = re.sub(r'[^a-zA-Z\s\-\']', '', word).strip().lower()
        conv = ipa.convert(clean_for_ipa).replace('*', '')
        phonetic = f"/{conv}/"

    # Fallback for example
    if not example:
        if pos == 'v.':
            example = f"They need to {word} the current situation."
        elif pos == 'adj.':
            example = f"This approach is very {word} in practice."
        elif pos == 'adv.':
            example = f"The results were {word} confirmed by experts."
        elif pos == 'n.':
            example = f"The report highlighted the importance of {word}."
        else:
            example = f"It is essential to understand the concept of {word}."

    return phonetic, example

def process_item(item):
    raw_word = item['raw_word']
    pos = item['pos']

    # Check special fix
    if raw_word in SPECIAL_FIXES:
        w, p, ph, m_vn, ex_en, ex_vi = SPECIAL_FIXES[raw_word]
        return {
            'word': w,
            'cefr_level': 'B2',
            'part_of_speech': p,
            'phonetic': ph,
            'vietnamese_meaning': m_vn,
            'example_en': ex_en,
            'example_vi': ex_vi,
            'topic': assign_topic(w)
        }

    # Clean word
    clean_w = re.sub(r'[\d\(\)]', '', raw_word).strip()
    
    # Fetch phonetic and example
    phonetic, example_en = fetch_dictionary_info(clean_w, pos)
    example_vi = get_vietnamese_trans(example_en)

    # Contextual Vietnamese translation
    if pos == 'v.':
        vn_meaning = get_vietnamese_trans(f"to {clean_w}")
        if vn_meaning.lower().startswith('đến '):
            vn_meaning = vn_meaning[4:]
    elif pos == 'adj.':
        vn_meaning = get_vietnamese_trans(f"being {clean_w}")
        if vn_meaning.lower().startswith('đang '):
            vn_meaning = vn_meaning[5:]
    elif pos == 'n.':
        vn_meaning = get_vietnamese_trans(f"the {clean_w}")
        if vn_meaning.lower().startswith('các ') or vn_meaning.lower().startswith('những '):
            vn_meaning = vn_meaning[4:]
    else:
        vn_meaning = get_vietnamese_trans(clean_w)

    if not vn_meaning or len(vn_meaning) > 60:
        vn_meaning = get_vietnamese_trans(clean_w)

    return {
        'word': clean_w,
        'cefr_level': 'B2',
        'part_of_speech': pos,
        'phonetic': phonetic,
        'vietnamese_meaning': vn_meaning,
        'example_en': example_en,
        'example_vi': example_vi,
        'topic': assign_topic(clean_w)
    }

def main():
    print("Reading PDF for B2 words...")
    reader = pypdf.PdfReader('The_Oxford_3000_by_CEFR_level.pdf')
    full_text = ''
    for p in reader.pages:
        full_text += p.extract_text() + '\n'

    lines = full_text.splitlines()
    current_level = None
    b2_lines = []

    for line in lines:
        line = line.strip()
        if not line or 'Oxford University Press' in line or 'The Oxford 3000' in line:
            continue
        if line in ['A1', 'A2', 'B1', 'B2']:
            current_level = line
            continue
        if current_level == 'B2':
            b2_lines.append(line)

    pos_pattern = r'^(.*?)\s+((?:(?:n\.|v\.|adj\.|adv\.|prep\.|conj\.|pron\.|det\.|number|exclam\.|modal v\.|indefinite article|article|det\./pron\.|det\./adj\.|pron\.)[\s,/]*)+)$'
    
    items_to_process = []
    for l in b2_lines:
        m = re.match(pos_pattern, l)
        if m:
            raw_w = m.group(1).strip()
            raw_pos = m.group(2).strip()
            
            # Special case for plus1
            if raw_w == 'plus1':
                for p in ['adj.', 'n.', 'conj.']:
                    items_to_process.append({'raw_word': 'plus', 'pos': p})
                continue
            
            pos_list = normalize_pos_list(raw_pos)
            for p in pos_list:
                items_to_process.append({'raw_word': raw_w, 'pos': p})
        else:
            parts = l.split()
            items_to_process.append({'raw_word': parts[0], 'pos': ' '.join(parts[1:])})

    print(f"Total B2 raw items parsed and expanded by POS: {len(items_to_process)}")

    results = []
    batch_size = 15
    total = len(items_to_process)

    print("Enriching B2 data with phonetic IPA, meanings, examples, and topics...")
    for start in range(0, total, batch_size):
        end = min(start + batch_size, total)
        current_batch = items_to_process[start:end]

        with concurrent.futures.ThreadPoolExecutor(max_workers=batch_size) as executor:
            futures = [executor.submit(process_item, item) for item in current_batch]
            for future in concurrent.futures.as_completed(futures):
                try:
                    res = future.result()
                    results.append(res)
                except Exception as e:
                    print(f"Error: {e}")

        print(f"Processed: {len(results)}/{total} words...")
        time.sleep(0.4)

    # Sort alphabetically by word, then pos
    results.sort(key=lambda x: (x['word'].lower(), x['part_of_speech']))

    for idx, r in enumerate(results):
        r['id'] = idx + 1

    cols = ['id', 'word', 'cefr_level', 'part_of_speech', 'phonetic', 'vietnamese_meaning', 'example_en', 'example_vi', 'topic']
    df = pd.DataFrame(results)[cols]

    output_file = 'oxford_3000_B2_final.xlsx'
    df.to_excel(output_file, index=False)
    print(f"SUCCESS! Created B2 dataset with {len(df)} rows saved to {output_file}")

if __name__ == '__main__':
    main()
