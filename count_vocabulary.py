import pandas as pd
import os

EXCEL_PATH = 'oxford_3000_vocabulary.xlsx'

def count_words():
    if not os.path.exists(EXCEL_PATH):
        print(f"Lỗi: Không tìm thấy file '{EXCEL_PATH}'!")
        return

    # Mở file Excel
    xf = pd.ExcelFile(EXCEL_PATH)
    
    total_entries = 0
    all_unique_words = set()

    print("=" * 62)
    print(f"{'SHEET':<8} | {'SỐ MỤC TỪ VỰNG':<18} | {'SỐ TỪ DUY NHẤT':<18}")
    print("-" * 62)

    for sheet_name in xf.sheet_names:
        df = pd.read_excel(EXCEL_PATH, sheet_name=sheet_name)
        
        # Số dòng (mục từ vựng bao gồm các từ loại đã tách)
        entries_count = len(df)
        total_entries += entries_count
        
        # Số từ vựng duy nhất (không trùng mặt chữ) trong sheet
        sheet_words = set(df['word'].dropna().astype(str).str.strip().str.lower())
        all_unique_words.update(sheet_words)
        
        print(f"{sheet_name:<8} | {entries_count:<18} | {len(sheet_words):<18}")

    print("=" * 62)
    print(f"{'TỔNG CỘNG':<8} | {total_entries:<18} | {len(all_unique_words):<18}")
    print("=" * 62)
    print(f"\n💡 Chú thích:")
    print(f" - 'SỐ MỤC TỪ VỰNG': Tổng số bản ghi (tính riêng từng loại từ: n., v., adj...).")
    print(f" - 'SỐ TỪ DUY NHẤT': Số từ vựng phân biệt theo mặt chữ (không trùng lặp).")

if __name__ == '__main__':
    count_words()
