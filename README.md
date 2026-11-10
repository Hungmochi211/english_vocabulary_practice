# English Vocabulary Practice - Backend Data Pipeline

Dự án Web App học từ vựng tiếng Anh thông minh với thuật toán Spaced Repetition (SM-2, Leitner System), xử lý so khớp gõ từ (Levenshtein Distance), phát âm (Soundex/Metaphone), và bộ dữ liệu chuẩn hóa từ Oxford 3000 (CEFR Levels).

---

## 📁 Cấu trúc dữ liệu hiện tại

Dữ liệu từ vựng đã được trích xuất, làm sạch và lưu tại file Excel:
- **`oxford_3000_vocabulary.xlsx`**: File Excel tổng hợp gồm các sheet:
  - **Sheet `A2`**: 995 từ vựng cấp độ A2 (đã tách riêng từng loại từ).
  - **Sheet `B2`**: 836 từ vựng cấp độ B2 (đã tách riêng từng loại từ).

Mỗi bản ghi gồm 9 trường thông tin chuẩn hóa:
1. `id`: Mã định danh số tăng dần.
2. `word`: Từ vựng tiếng Anh chuẩn (dạng chữ sạch, không chứa số hay ký tự thừa).
3. `cefr_level`: Cấp độ CEFR (`A2`, `B2`).
4. `part_of_speech`: Loại từ (`n.`, `v.`, `adj.`, `adv.`, `prep.`, `conj.`...).
5. `phonetic`: Phiên âm quốc tế chuẩn IPA (`/.../`).
6. `vietnamese_meaning`: Nghĩa tiếng Việt chuẩn theo ngữ cảnh loại từ.
7. `example_en`: Câu ví dụ ngữ cảnh tiếng Anh.
8. `example_vi`: Dịch nghĩa câu ví dụ tiếng Việt.
9. `topic`: Chủ đề bài học để gom nhóm phân bổ (15 - 18 từ/lesson).

---

## 🛠 Hướng dẫn thiết lập môi trường & Cài đặt thư viện

Dự án sử dụng **môi trường ảo Python (`venv`)** độc lập để tránh ảnh hưởng đến hệ thống máy tính toàn cục.

### Bước 1: Mở Terminal / PowerShell
Mở PowerShell hoặc Command Prompt tại thư mục dự án:
```powershell
git clone trên repo về máy
```

### Bước 2: Tạo môi trường ảo (`venv`)
*(Nếu chưa có thư mục `.venv` trong dự án)*
```powershell
python -m venv .venv
```

### Bước 3: Kích hoạt môi trường ảo
- **Trên Windows (PowerShell):**
  ```powershell
  .\.venv\Scripts\Activate.ps1
  ```
  *(Nếu gặp lỗi PowerShell chặn script, chạy lệnh: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`)*

- **Trên Windows (Command Prompt - CMD):**
  ```cmd
  .\.venv\Scripts\activate.bat
  ```

> Khi kích hoạt thành công, bạn sẽ thấy tiền tố `(.venv)` xuất hiện ở đầu dòng lệnh của terminal.

### Bước 4: Cài đặt các thư viện cần thiết từ `requirements.txt`
Chạy lệnh:
```powershell
pip install -r requirements.txt
```

Các thư viện chính được sử dụng:
- `pandas` & `openpyxl`: Đọc, xử lý và xuất file Excel nhiều sheet.
- `pypdf`: Bóc tách văn bản từ tài liệu PDF Oxford 3000.
- `eng-to-ipa`: Chuyển đổi từ vựng sang bảng ký hiệu phiên âm quốc tế chuẩn IPA (dựa trên bộ dữ liệu CMU).
- `deep-translator` & `requests`: Hỗ trợ dịch nghĩa tiếng Việt ngữ cảnh và gọi API từ điển.

---

## 🚀 Cách chạy chương trình tra cứu từ vựng

Sau khi đã cài đặt môi trường, bạn có thể chạy script tra cứu nhanh trên Terminal:

### Cách 1: Khi đã kích hoạt `.venv`
```powershell
python search_word.py
```

### Cách 2: Chạy trực tiếp bằng Python của `.venv` (Không cần kích hoạt)
```powershell
.\.venv\Scripts\python search_word.py
```

### Ví dụ tương tác trong chương trình:
```text
Nhập từ: unfortunately
-> Tìm thấy 1 kết quả:
945    unfortunately    A2    adv.    /ənˈfɔrʧənətli/    Không may    You need to unfortunately carefully.    Bạn cần phải cẩn thận.    Daily Life & Routines
-------------------------------------------------------
ID:           945 [A2]
Từ vựng:      unfortunately
Loại từ:      adv.
Phiên âm:     /ənˈfɔrʧənətli/
Nghĩa:        Không may
Ví dụ (EN):   You need to unfortunately carefully.
Ví dụ (VI):   Bạn cần phải cẩn thận.
Chủ đề:       Daily Life & Routines
-------------------------------------------------------
```

---

## 📌 Các bước phát triển tiếp theo (Roadmap)
1. Thiết kế cơ sở dữ liệu MySQL Schema (`vocabularies`, `topics`, `lessons`, `users`, `user_progress_sm2`).
2. Viết script nạp tự động (seed) dữ liệu từ `oxford_3000_vocabulary.xlsx` vào MySQL Database.
3. Xây dựng RESTful API Backend:
   - Thuật toán chấm điểm gõ từ (`Levenshtein Distance`).
   - Thuật toán sinh câu hỏi trắc nghiệm tự động (`Distractor Selection via Clustering`).
   - Thuật toán Spaced Repetition (`SM-2` & `Leitner System`).
