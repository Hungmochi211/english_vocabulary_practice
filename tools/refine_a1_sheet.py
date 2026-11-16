import os
import re
import json
import time
import urllib.request
import urllib.parse
import concurrent.futures
import pandas as pd
from openpyxl import load_workbook

os.chdir(r'c:\TTCN\english_vocabulary_practice')
excel_path = 'oxford_3000_vocabulary.xlsx'

print("Loading A1 sheet from oxford_3000_vocabulary.xlsx...")
df = pd.read_excel(excel_path, sheet_name='A1')

# 1. Fill missing phonetics with eng_to_ipa
try:
    import eng_to_ipa as ipa
    print("Checking missing phonetics...")
    missing_ph = 0
    for idx, row in df.iterrows():
        val = row['phonetic']
        is_missing = pd.isna(val) or str(val).strip() in ['', 'nan', 'None', '//']
        if is_missing:
            w = str(row['word']).strip().lower()
            clean_w = re.sub(r'[^a-zA-Z\s\-\']', '', w).strip()
            conv = ipa.convert(clean_w).replace('*', '')
            df.at[idx, 'phonetic'] = f"/{conv}/"
            missing_ph += 1
    print(f"Updated {missing_ph} missing phonetics with eng_to_ipa.")
except ImportError:
    print("eng_to_ipa not available yet, skipping phonetic filling.")

# 2. Fill missing vietnamese_meaning and example_vi
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

missing_meaning_idx = df[df['vietnamese_meaning'].isna() | (df['vietnamese_meaning'].astype(str).str.strip().isin(['', 'nan', 'None']))].index.tolist()
missing_exvi_idx = df[df['example_vi'].isna() | (df['example_vi'].astype(str).str.strip().isin(['', 'nan', 'None']))].index.tolist()
all_need_trans = sorted(list(set(missing_meaning_idx + missing_exvi_idx)))

print(f"Rows needing translation: {len(all_need_trans)}")

def process_translation_row(idx):
    row = df.loc[idx]
    w = str(row['word']).strip()
    pos = str(row['part_of_speech']).strip()
    ex_en = str(row['example_en']).strip() if pd.notna(row['example_en']) else ''
    
    m_vn = row['vietnamese_meaning']
    if pd.isna(m_vn) or str(m_vn).strip() in ['', 'nan', 'None']:
        if pos == 'v.':
            m_vn = translate_text(f"to {w}")
            if m_vn.lower().startswith('đến '):
                m_vn = m_vn[4:]
        elif pos == 'adj.':
            m_vn = translate_text(f"being {w}")
            if m_vn.lower().startswith('đang '):
                m_vn = m_vn[5:]
        elif pos == 'n.':
            m_vn = translate_text(f"the {w}")
            for pre in ('cái ', 'con ', 'sự ', 'các ', 'những '):
                if m_vn.lower().startswith(pre):
                    m_vn = m_vn[len(pre):]
                    break
        else:
            m_vn = translate_text(w)

        if not m_vn or len(m_vn) > 60:
            m_vn = translate_text(w)

    ex_vi = row['example_vi']
    if pd.isna(ex_vi) or str(ex_vi).strip() in ['', 'nan', 'None']:
        ex_vi = translate_text(ex_en) if ex_en else ''
        
    return idx, m_vn, ex_vi

batch_size = 20
total = len(all_need_trans)
for i in range(0, total, batch_size):
    batch = all_need_trans[i:i + batch_size]
    with concurrent.futures.ThreadPoolExecutor(max_workers=batch_size) as executor:
        futures = [executor.submit(process_translation_row, idx) for idx in batch]
        for f in concurrent.futures.as_completed(futures):
            idx, m_vn, ex_vi = f.result()
            df.at[idx, 'vietnamese_meaning'] = m_vn
            df.at[idx, 'example_vi'] = ex_vi
    print(f"Translated: {min(i + batch_size, total)}/{total} rows...", flush=True)
    time.sleep(0.2)

# Verify counts
print("Verification after refinement:")
print("Missing phonetics:", (df['phonetic'].isna() | df['phonetic'].astype(str).str.strip().isin(['', 'nan', 'None', '//'])).sum())
print("Missing vietnamese_meaning:", (df['vietnamese_meaning'].isna() | df['vietnamese_meaning'].astype(str).str.strip().isin(['', 'nan', 'None'])).sum())
print("Missing example_vi:", (df['example_vi'].isna() | df['example_vi'].astype(str).str.strip().isin(['', 'nan', 'None'])).sum())

# Save back into workbook
print("Saving updated A1 sheet to oxford_3000_vocabulary.xlsx...")
book = load_workbook(excel_path)
if 'A1' in book.sheetnames:
    del book['A1']

ws = book.create_sheet('A1')
ws.append(list(df.columns))
for row in df.itertuples(index=False):
    ws.append(list(row))

# Keep A1 as first sheet
book.move_sheet('A1', offset=-len(book.sheetnames) + 1)
book.save(excel_path)
book.close()
print("SUCCESS! Sheet A1 completely refined and saved.")
