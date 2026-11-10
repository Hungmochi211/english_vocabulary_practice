import pandas as pd
import re
import urllib.request
import urllib.parse
import json
import concurrent.futures
import time

def normalize_pos_list(pos_str):
    pos_str = str(pos_str).strip()
    # Normalize common patterns
    # e.g. "det./pron." -> keep or split? If det. and pron. are closely related, split to "det.", "pron."
    # e.g. "adj./adv." -> "adj.", "adv."
    # e.g. "n., v." -> "n.", "v."
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
    
    # Deduplicate while preserving order
    seen = set()
    result = []
    for t in tokens:
        if t not in seen:
            seen.add(t)
            result.append(t)
    return result

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

def fetch_pos_specific_info(word, pos):
    full_pos = POS_MAP.get(pos, '')
    clean_w = word.strip().lower()
    url = f'https://api.dictionaryapi.dev/api/v2/entries/en/{urllib.parse.quote(clean_w)}'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    example = ''
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode('utf-8'))
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
    
    # If no example found, create template
    if not example:
        if pos == 'v.':
            example = f"You need to {word} carefully."
        elif pos == 'adj.':
            example = f"This is very {word}."
        elif pos == 'adv.':
            example = f"She did it {word}."
        elif pos == 'n.':
            example = f"He saw a {word} yesterday."
        else:
            example = f"I know the meaning of {word}."
            
    return example

def main():
    print("Reading oxford_3000_A2_vocabularies_v2.xlsx...")
    df = pd.read_excel('oxford_3000_A2_vocabularies_v2.xlsx')
    
    new_rows = []
    split_tasks = []
    
    for idx, row in df.iterrows():
        pos_list = normalize_pos_list(row['part_of_speech'])
        if len(pos_list) <= 1:
            # Single POS, keep as is
            new_rows.append({
                'word': row['word'],
                'cefr_level': row['cefr_level'],
                'part_of_speech': pos_list[0] if pos_list else row['part_of_speech'],
                'phonetic': row['phonetic'],
                'vietnamese_meaning': row['vietnamese_meaning'],
                'example_en': row['example_en'],
                'example_vi': row['example_vi'],
                'topic': row['topic']
            })
        else:
            # Multiple POS, prepare to expand
            for pos in pos_list:
                split_tasks.append({
                    'word': row['word'],
                    'cefr_level': row['cefr_level'],
                    'part_of_speech': pos,
                    'phonetic': row['phonetic'],
                    'base_meaning': row['vietnamese_meaning'],
                    'topic': row['topic']
                })
    
    print(f"Base single rows: {len(new_rows)}, Multi-POS items to expand: {len(split_tasks)}")
    
    def process_split_item(task):
        word = task['word']
        pos = task['part_of_speech']
        ex_en = fetch_pos_specific_info(word, pos)
        ex_vi = get_vietnamese_trans(ex_en)
        
        # Translate with POS context hint for better meaning
        if pos == 'v.':
            vn_meaning = get_vietnamese_trans(f"to {word}")
            # Remove "đến" if Google translates "to word" literally
            if vn_meaning.lower().startswith('đến '):
                vn_meaning = vn_meaning[4:]
        elif pos == 'adj.':
            vn_meaning = get_vietnamese_trans(f"being {word}")
            if vn_meaning.lower().startswith('đang '):
                vn_meaning = vn_meaning[5:]
        elif pos == 'n.':
            vn_meaning = get_vietnamese_trans(f"a {word}")
            if vn_meaning.lower().startswith('một '):
                vn_meaning = vn_meaning[4:]
        else:
            vn_meaning = task['base_meaning']
            
        if not vn_meaning or len(vn_meaning) > 50:
            vn_meaning = task['base_meaning']

        return {
            'word': word,
            'cefr_level': task['cefr_level'],
            'part_of_speech': pos,
            'phonetic': task['phonetic'],
            'vietnamese_meaning': vn_meaning,
            'example_en': ex_en,
            'example_vi': ex_vi,
            'topic': task['topic']
        }

    # Parallel processing of split tasks
    print("Processing split POS items...")
    expanded_rows = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(process_split_item, t) for t in split_tasks]
        for f in concurrent.futures.as_completed(futures):
            expanded_rows.append(f.result())

    # Combine all
    all_rows = new_rows + expanded_rows
    # Sort alphabetically by word, then part_of_speech
    all_rows.sort(key=lambda x: (x['word'].lower(), x['part_of_speech']))
    
    # Assign sequential IDs
    for idx, r in enumerate(all_rows):
        r['id'] = idx + 1
        
    cols = ['id', 'word', 'cefr_level', 'part_of_speech', 'phonetic', 'vietnamese_meaning', 'example_en', 'example_vi', 'topic']
    final_df = pd.DataFrame(all_rows)[cols]
    
    output_filename = 'oxford_3000_A2_split_pos.xlsx'
    final_df.to_excel(output_filename, index=False)
    print(f"DONE! Total records after splitting: {len(final_df)}. Saved to {output_filename}")

if __name__ == '__main__':
    main()
