"""
apply_phonetic_fix.py
Thay the toan bo cac tu co phien am chua ngoac vuong [...] ve phien am IPA chuan /.../
tren ca 3 sheet A1, A2, B2 trong oxford_3000_vocabulary.xlsx.
"""

import os
import shutil
import time

excel_path = 'oxford_3000_vocabulary.xlsx'
tmp_path = 'oxford_3000_vocabulary_tmp.xlsx'

if not os.path.exists(tmp_path):
    print(f"Loi: Khong tim thay file '{tmp_path}'!")
    exit(1)

print("Dang ghi de file oxford_3000_vocabulary.xlsx tu ban da chuan hoa...")
for attempt in range(1, 11):
    try:
        shutil.copyfile(tmp_path, excel_path)
        print("-> Thanh cong! Da cap nhat oxford_3000_vocabulary.xlsx hoan tat.")
        try:
            os.remove(tmp_path)
        except Exception:
            pass
        break
    except PermissionError:
        print(f"File dang bi mo boi Excel (lan thu {attempt}/10). Vui long dong phan mem Excel...")
        time.sleep(2)
else:
    print("Vui long dong file Excel va chay lai: python apply_phonetic_fix.py")
