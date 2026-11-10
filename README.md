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
cd c:\Users\Admin\Desktop\english_vocabulary_practice
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

## 📜 Giới thiệu các Script xử lý dữ liệu và tác dụng

Dưới đây là danh sách các script Python đã được xây dựng trong dự án và vai trò của từng script trong chuỗi xử lý (Data Pipeline):

### 1. `search_word.py` (Script tra cứu tương tác)
- **Tác dụng:** Công cụ tìm kiếm từ vựng trực tiếp trên Terminal.
- **Hoạt động:** Nạp đồng thời toàn bộ các sheet (`A2`, `B2`) từ file `oxford_3000_vocabulary.xlsx`. Cho phép người dùng nhập từ tiếng Anh và hiển thị toàn bộ 9 trường thông tin (dưới dạng dòng Tab và bảng thông tin chi tiết).

### 2. `clean_a2_words.py` (Làm sạch từ vựng A2)
- **Tác dụng:** Loại bỏ các số chỉ mục và phần chú thích ngữ cảnh trong ngoặc đơn từ file PDF gốc của Oxford.
- **Hoạt động:** 
  - Xử lý các từ đồng âm bị dính số (như `close2` ➔ `close`, `can2` ➔ `can`, `lead1` ➔ `lead`, `ring1`/`ring2` ➔ `ring`, `wind1` ➔ `wind`).
  - Xử lý các từ dính ngoặc đơn (như `bear (animal)` ➔ `bear`, `last1 (final)` ➔ `last`, `rock (stone)` ➔ `rock`).
  - Cập nhật lại đúng phiên âm chuẩn, nghĩa tiếng Việt và câu ví dụ theo đúng loại từ.

### 3. `split_pos_script.py` (Tách từ đa từ loại - Multi-POS Splitting)
- **Tác dụng:** Tách các dòng từ vựng có nhiều hơn một loại từ (ví dụ: `n., v.` hoặc `adj., adv.`) thành các dòng độc lập.
- **Hoạt động:** Với từ như `attack (n., v.)`, script sẽ nhân bản và tạo thành 2 bản ghi riêng biệt: 1 dòng cho danh từ `n.` và 1 dòng cho động từ `v.`, đồng thời gán câu ví dụ và nghĩa ngữ cảnh tương ứng. Giúp thuật toán trắc nghiệm (Distractor Selection) và Spaced Repetition (SM-2) sau này vận hành chính xác 100%.

### 4. `fill_missing_phonetics.py` (Bổ sung phiên âm chuẩn IPA)
- **Tác dụng:** Rà soát và điền bổ sung phiên âm quốc tế IPA cho toàn bộ các từ bị thiếu (`NaN` / rỗng).
- **Hoạt động:** Tích hợp thư viện `eng-to-ipa` (sử dụng từ điển âm vị học CMU) để sinh phiên âm chuẩn quốc tế `/.../` cho các từ và cụm từ mà API trực tuyến không hỗ trợ hoặc bị timeout. Đảm bảo tỷ lệ có phiên âm đạt 100%.

### 5. `export_a2_excel.py` & `export_b2_excel.py` (Bóc tách dữ liệu gốc A2 & B2)
- **Tác dụng:** Bóc tách toàn bộ từ vựng cấp độ A2 và B2 từ file PDF `The_Oxford_3000_by_CEFR_level.pdf`.
- **Hoạt động:** Quét từng trang PDF, dùng Regex lọc theo cấp độ, gọi API lấy phiên âm, nghĩa tiếng Việt, câu ví dụ và băm chủ đề bài học (`topic`), sau đó xuất ra các file Excel ban đầu.

### 6. `fill_b2_vietnamese.py` (Hoàn thiện nghĩa và ví dụ tiếng Việt cho B2)
- **Tác dụng:** Dịch tự động theo ngữ cảnh loại từ và bổ sung bản dịch tiếng Việt cho toàn bộ 836 dòng từ vựng cấp độ B2.
- **Hoạt động:** Sử dụng đa luồng (`ThreadPoolExecutor`) kết hợp client dịch ngữ cảnh theo tiền tố (`to + verb`, `the + noun`, `being + adj`) để tránh bị chặn IP và đem lại bản dịch sát nghĩa nhất.
