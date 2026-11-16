import pypdf
import re
import urllib.request
import urllib.parse
import json
import time
import concurrent.futures
import pandas as pd
import os

def parse_a2_words():
    reader = pypdf.PdfReader('The_Oxford_3000_by_CEFR_level.pdf')
    full_text = ''
    for p in reader.pages:
        full_text += p.extract_text() + '\n'

    lines = full_text.splitlines()
    current_level = None
    a2_lines = []

    for line in lines:
        line = line.strip()
        if not line:
            continue
        if 'Oxford University Press' in line or 'The Oxford 3000' in line:
            continue
        if line in ['A1', 'A2', 'B1', 'B2']:
            current_level = line
            continue
        if current_level == 'A2':
            a2_lines.append(line)

    parsed = []
    for item in a2_lines:
        m = re.match(r'^(.*?)\s+((?:(?:n\.|v\.|adj\.|adv\.|prep\.|conj\.|pron\.|det\.|number|exclam\.|modal v\.|indefinite article|article|det\./pron\.|det\./adj\.|pron\.)[\s,/]*)+)$', item)
        if m:
            parsed.append({
                'word': m.group(1).strip(),
                'part_of_speech': m.group(2).strip()
            })
        else:
            # fallback
            parts = item.split()
            parsed.append({
                'word': parts[0],
                'part_of_speech': ' '.join(parts[1:])
            })
    return parsed

TOPICS = [
    'Daily Life & Routines',
    'People & Relationships',
    'Education & Work',
    'Travel & Transportation',
    'Food & Health',
    'Home & Environment',
    'Entertainment & Media',
    'Communication & Feelings'
]

def assign_topic(word, pos):
    # Deterministic assignment based on simple hash or keyword
    h = sum(ord(c) for c in word) % len(TOPICS)
    return TOPICS[h]

def fetch_dictionary_data(word):
    clean_w = word.strip().lower()
    url = f'https://api.dictionaryapi.dev/api/v2/entries/en/{urllib.parse.quote(clean_w)}'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    phonetic = ''
    example = ''
    try:
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            phonetic = data[0].get('phonetic', '')
            if not phonetic:
                for ph in data[0].get('phonetics', []):
                    if ph.get('text'):
                        phonetic = ph['text']
                        break
            for m in data[0].get('meanings', []):
                for d in m.get('definitions', []):
                    if d.get('example'):
                        example = d['example']
                        break
                if example:
                    break
    except Exception:
        pass
    return phonetic, example

def fetch_vietnamese_trans(text):
    if not text:
        return ''
    url = f'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q={urllib.parse.quote(text)}'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, timeout=6) as resp:
            res = json.loads(resp.read().decode('utf-8'))
            return ''.join([part[0] for part in res[0]])
    except Exception:
        return ''

def process_item(item, idx):
    word = item['word']
    pos = item['part_of_speech']
    
    # 1. Fetch phonetic & example
    phonetic, example_en = fetch_dictionary_data(word)
    
    # If no example found, create a simple default sentence for A2
    if not example_en:
        if 'v.' in pos:
            example_en = f"You need to {word} carefully."
        elif 'adj.' in pos:
            example_en = f"This is very {word}."
        elif 'adv.' in pos:
            example_en = f"She did it {word}."
        else:
            example_en = f"I know the meaning of {word}."

    # 2. Translate word & example to Vietnamese
    vietnamese_meaning = fetch_vietnamese_trans(word)
    example_vi = fetch_vietnamese_trans(example_en)
    
    # 3. Topic
    topic = assign_topic(word, pos)

    return {
        'id': idx + 1,
        'word': word,
        'cefr_level': 'A2',
        'part_of_speech': pos,
        'phonetic': phonetic,
        'vietnamese_meaning': vietnamese_meaning,
        'example_en': example_en,
        'example_vi': example_vi,
        'topic': topic
    }

def main():
    print("Parsing A2 items from PDF...")
    items = parse_a2_words()
    print(f"Total A2 items found: {len(items)}")

    # Check existing progress if any
    output_excel = "oxford_3000_A2_vocabularies.xlsx"
    results = []
    
    # Process in parallel batches of 15
    batch_size = 15
    total = len(items)
    
    print("Starting data enrichment (IPA, translations, examples)...")
    for start in range(0, total, batch_size):
        end = min(start + batch_size, total)
        current_batch = items[start:end]
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=batch_size) as executor:
            futures = [executor.submit(process_item, item, start + i) for i, item in enumerate(current_batch)]
            for future in concurrent.futures.as_completed(futures):
                try:
                    res = future.result()
                    results.append(res)
                except Exception as e:
                    print(f"Error processing item: {e}")
        
        print(f"Processed: {len(results)}/{total} words...")
        time.sleep(0.5) # Gentle pause to avoid rate limit

    # Sort results by ID
    results.sort(key=lambda x: x['id'])

    df = pd.DataFrame(results)
    df.to_excel(output_excel, index=False)
    print(f"SUCCESS! Saved {len(df)} rows to {output_excel}")

if __name__ == '__main__':
    main()
