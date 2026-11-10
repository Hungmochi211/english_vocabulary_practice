import pandas as pd
import os

EXCEL_FILE = 'oxford_3000_vocabulary.xlsx'

def load_data(sheet=None):
    """
    Nạp dữ liệu từ file Excel oxford_3000_vocabulary.xlsx.
    Nếu sheet=None: Đọc và gộp tất cả các sheet (A2, B2,...).
    Nếu sheet='A2' hoặc 'B2': Chỉ đọc riêng sheet đó.
    """
    if not os.path.exists(EXCEL_FILE):
        print(f"Lỗi: Không tìm thấy file '{EXCEL_FILE}'!")
        return None
        
    if sheet:
        return pd.read_excel(EXCEL_FILE, sheet_name=sheet)
    else:
        # Đọc tất cả các sheet cùng lúc
        all_sheets = pd.read_excel(EXCEL_FILE, sheet_name=None)
        combined_df = pd.concat(all_sheets.values(), ignore_index=True)
        return combined_df

def search_word(word_query, df):
    clean_query = word_query.strip().lower()
    
    # 1. Tìm chính xác (exact match)
    results = df[df['word'].astype(str).str.strip().str.lower() == clean_query]
    
    # 2. Nếu không có exact match, tìm gần đúng (contains)
    if results.empty:
        results = df[df['word'].astype(str).str.strip().str.lower().str.contains(clean_query, na=False)]
        
    return results

def format_row(row):
    cols = ['id', 'word', 'cefr_level', 'part_of_speech', 'phonetic', 'vietnamese_meaning', 'example_en', 'example_vi', 'topic']
    values = [str(row[c]) if pd.notna(row[c]) else '' for c in cols]
    return '\t'.join(values)

def main():
    print("=" * 65)
    print("CHƯƠNG TRÌNH TRA CỨU TỪ VỰNG OXFORD 3000 (A2 & B2)")
    print("=" * 65)
    
    df = load_data()
    if df is None:
        return
        
    levels = df['cefr_level'].value_counts().to_dict()
    level_str = " | ".join([f"{lvl}: {cnt} từ" for lvl, cnt in levels.items()])
    print(f"-> Đã nạp từ '{EXCEL_FILE}' ({len(df)} từ vựng: {level_str})")
    print("Nhập từ cần tra (hoặc gõ 'exit' / 'q' để thoát):\n")
    
    while True:
        try:
            user_input = input("Nhập từ: ").strip()
            if not user_input:
                continue
            if user_input.lower() in ['exit', 'quit', 'q']:
                print("Tạm biệt!")
                break
                
            matches = search_word(user_input, df)
            
            if matches.empty:
                print(f"-> Không tìm thấy từ '{user_input}'.\n")
            else:
                print(f"\n-> Tìm thấy {len(matches)} kết quả:")
                for _, row in matches.iterrows():
                    # 1. In dạng dòng tab
                    print(format_row(row))
                    
                    # 2. In dạng chi tiết trực quan
                    print("   " + "-" * 55)
                    print(f"   ID:           {row['id']} [{row['cefr_level']}]")
                    print(f"   Từ vựng:      {row['word']}")
                    print(f"   Loại từ:      {row['part_of_speech']}")
                    print(f"   Phiên âm:     {row['phonetic']}")
                    print(f"   Nghĩa:        {row['vietnamese_meaning']}")
                    print(f"   Ví dụ (EN):   {row['example_en']}")
                    print(f"   Ví dụ (VI):   {row['example_vi']}")
                    print(f"   Chủ đề:       {row['topic']}")
                    print("   " + "-" * 55)
                print()
        except KeyboardInterrupt:
            print("\nĐã dừng chương trình.")
            break

if __name__ == '__main__':
    main()
