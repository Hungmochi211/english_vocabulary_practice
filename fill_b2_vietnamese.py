import pandas as pd
import urllib.request
import urllib.parse
import json
import time
import concurrent.futures

print("Loading oxford_3000_B2_final.xlsx...")
df = pd.read_excel('oxford_3000_B2_final.xlsx')

def translate_text(text):
    if not text or pd.isna(text) or str(text).strip() == '':
        return ''
    clean_t = str(text).strip()
    url = f'https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=vi&q={urllib.parse.quote(clean_t)}'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                if isinstance(data, list) and len(data) > 0:
                    return str(data[0]).strip()
                return str(data).strip()
        except Exception:
            time.sleep(0.5)
    return ''

missing_indices = df[df['vietnamese_meaning'].isna() | (df['vietnamese_meaning'].astype(str).str.strip().isin(['', 'nan']))].index.tolist()
print(f"Total rows needing translation: {len(missing_indices)}")

def process_row(idx):
    row = df.loc[idx]
    w = str(row['word']).strip()
    pos = str(row['part_of_speech']).strip()
    ex_en = str(row['example_en']).strip() if pd.notna(row['example_en']) else ''
    
    # 1. Translate word with POS nuance
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
        if m_vn.lower().startswith('các ') or m_vn.lower().startswith('những '):
            m_vn = m_vn[4:]
    else:
        m_vn = translate_text(w)

    if not m_vn or len(m_vn) > 60:
        m_vn = translate_text(w)

    # 2. Translate example sentence
    ex_vi = translate_text(ex_en) if ex_en else ''
    
    return idx, m_vn, ex_vi

batch_size = 15
for i in range(0, len(missing_indices), batch_size):
    batch = missing_indices[i:i + batch_size]
    with concurrent.futures.ThreadPoolExecutor(max_workers=batch_size) as executor:
        futures = [executor.submit(process_row, idx) for idx in batch]
        for f in concurrent.futures.as_completed(futures):
            idx, m_vn, ex_vi = f.result()
            df.at[idx, 'vietnamese_meaning'] = m_vn
            df.at[idx, 'example_vi'] = ex_vi
    
    print(f"Translated: {min(i + batch_size, len(missing_indices))}/{len(missing_indices)} rows...")
    time.sleep(0.2)

output_file = 'oxford_3000_B2_final.xlsx'
df.to_excel(output_file, index=False)
print(f"DONE! 100% complete B2 dataset saved to {output_file}")
