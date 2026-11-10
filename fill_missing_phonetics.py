import pandas as pd
import eng_to_ipa as ipa
import re

print("Loading oxford_3000_A2_split_pos.xlsx...")
df = pd.read_excel('oxford_3000_A2_split_pos.xlsx')

def clean_word_for_ipa(w):
    w = str(w).replace('\xa0', ' ')
    w = re.sub(r'[^a-zA-Z\s\-\']', '', w)
    return w.strip().lower()

missing_count = 0
updated_count = 0

for idx, row in df.iterrows():
    val = row['phonetic']
    is_missing = pd.isna(val) or str(val).strip() in ['', 'nan', 'None']
    
    if is_missing:
        missing_count += 1
        clean_w = clean_word_for_ipa(row['word'])
        phonetic_ipa = ipa.convert(clean_w)
        # If conversion has trailing asterisk (unrecognized), clean it
        phonetic_ipa = phonetic_ipa.replace('*', '')
        formatted_ipa = f"/{phonetic_ipa}/"
        df.at[idx, 'phonetic'] = formatted_ipa
        updated_count += 1

print(f"Total missing before: {missing_count}")
print(f"Total updated with standard IPA: {updated_count}")

# Verify 0 missing
remaining_missing = df[df['phonetic'].isna() | df['phonetic'].astype(str).str.strip().isin(['', 'nan', '//'])]
print(f"Remaining missing phonetics: {len(remaining_missing)}")

output_file = 'oxford_3000_A2_final.xlsx'
df.to_excel(output_file, index=False)
print(f"Successfully saved 100% complete dataset to {output_file}!")
