# BÁO CÁO CHI TIẾT CÁC LỖI DỮ LIỆU CẦN KHẮC PHỤC TRONG SHEET A1 VÀ B1
**Tệp dữ liệu:** `oxford_3000_vocabulary.xlsx`  
**Ngày kiểm tra:** 16/11/2026  
**Mục tiêu đối soát:** Đảm bảo độ sạch của từ vựng, tính chính xác của thuật toán Backend (Levenshtein, Soundex/Metaphone, SM-2 và Distractor Selection).

---

## 1. TỔNG QUAN TÌNH TRẠNG

| Tiêu chí kiểm tra | Trạng thái hiện tại | Đánh giá |
| :--- | :--- | :--- |
| **Cấu trúc 9 cột chuẩn** | Đầy đủ (`id`, `word`, `cefr_level`, `part_of_speech`, `phonetic`, `vietnamese_meaning`, `example_en`, `example_vi`, `topic`) | ✅ Đạt |
| **Dữ liệu trống (Null/NaN)** | 0 dòng bị trống ở cả 2 sheet | ✅ Đạt |
| **Chuẩn hóa phiên âm IPA** | 100% nằm trong dấu gạch chéo `/.../`, không dính `*` | ✅ Đạt |
| **Độ sạch của từ (`word`)** | Còn dính nhãn ngữ pháp (`be v.`, `do v.`, `the definite`) | ❌ Cần sửa |
| **Ký tự khoảng trắng (`\xa0`)** | Còn sót mã non-breaking space ở các cụm từ | ❌ Cần sửa |
| **Nghĩa tiếng Việt (`vietnamese_meaning`)** | Bị lỗi thuật toán cắt chuỗi làm cụt chữ cái đầu của nhiều động từ | ❌ Cần sửa |
| **Từ đồng âm (Homonyms) & Trùng lặp** | Bị gán nhầm nghĩa cấp độ khác và nhân đôi bản ghi | ❌ Cần sửa |

---

## 2. CHI TIẾT CÁC LỖI PHÁT HIỆN

### Lỗi 1: Cắt cụt chữ cái đầu nghĩa tiếng Việt của Động từ (`v.`)
* **Nguyên nhân kỹ thuật:** Trong script dịch tự động ngữ cảnh cho động từ (`to [verb]`), Google Translate thường trả về chuỗi bắt đầu bằng `"để [từ]"`. Khi code bóc tách dùng lệnh cắt cứng `[4:]` (vốn giả định tiền tố là `"đến "` gồm 4 ký tự), chuỗi `"để "` (chỉ có 3 ký tự) bị cắt lẹm mất **chữ cái đầu tiên** của động từ.
* **Tác động:** Người học nhìn thấy nghĩa bị sai chính tả ngớ ngẩn (ví dụ: `answer` nghĩa là *"rả lời"* thay vì *"trả lời"*).

#### Danh sách các từ bị lỗi ở Sheet A1:
| ID | Từ vựng (`word`) | Loại từ | Nghĩa hiện tại (Bị lỗi) | Nghĩa chuẩn xác cần sửa |
| :---: | :--- | :---: | :--- | :--- |
| **62** | `answer` | `v.` | `rả lời` | **trả lời** |
| **207** | `compare` | `v.` | `o sánh` | **so sánh** |
| **209** | `complete` | `v.` | `oàn thành` | **hoàn thành** |
| **217** | `correct` | `v.` | `ửa` | **sửa, sửa chữa** |
| **351** | `find` | `v.` | `ìm` | **tìm, tìm thấy** |
| **391** | `get` | `v.` | `ó được` | **có được, nhận được** |
| **394** | `give` | `v.` | `ho` | **cho, tặng** |
| **492** | `keep` | `v.` | `iữ` | **giữ, giữ lại** |
| **515** | `let` | `v.` | `ho` | **cho phép, để cho** |
| **555** | `match` | `v.` | `hù hợp` | **phù hợp, làm cho khớp** |
| **752** | `put` | `v.` | `ặt` | **đặt, để** |
| **772** | `remember` | `v.` | `hớ` | **nhớ, ghi nhớ** |
| **798** | `say` | `v.` | `ói` | **nói** |
| **807** | `see` | `v.` | `em` | **nhìn, xem, thấy** |
| **973** | `try` | `v.` | `hử` | **thử, cố gắng** |
| **1014** | `watch` | `v.` | `em` | **xem, theo dõi** |

#### Danh sách các từ bị lỗi ở Sheet B1:
| ID | Từ vựng (`word`) | Loại từ | Nghĩa hiện tại (Bị lỗi) | Nghĩa chuẩn xác cần sửa |
| :---: | :--- | :---: | :--- | :--- |
| **5** | `access` | `v.` | `ruy cập` | **truy cập** |
| **135** | `clear` | `v.` | `óa` | **xóa, dọn dẹp** |
| **288** | `experience` | `v.` | `rải nghiệm` | **trải nghiệm** |
| **487** | `measure` | `v.` | `o` | **đo, đo lường** |
| **680** | `result` | `v.` | `ó kết quả` | **dẫn đến, có kết quả** |
| **763** | `state` | `v.` | `êu` | **nêu, tuyên bố** |
| **782** | `summarize` | `v.` | `óm tắt` | **tóm tắt** |
| **865** | `view` | `v.` | `em` | **xem, nhìn nhận** |

---

### Lỗi 2: Cột `word` còn dính nhãn ngữ pháp và loại từ (Sheet A1)
* **Nguyên nhân kỹ thuật:** Biểu thức Regex bóc tách chuỗi chưa xử lý được các từ có nhãn đặc thù như `auxiliary v.` hay `definite article`.
* **Tác động:** Khi bài tập yêu cầu gõ từ `be` hay `do`, hệ thống Backend đối soát Levenshtein sẽ so khớp với `"be v."` hoặc `"do v."` và chấm người dùng bị sai.

| ID | Cột `word` hiện tại | Cần sửa thành | `part_of_speech` | `phonetic` | Nghĩa chuẩn |
| :---: | :--- | :--- | :---: | :---: | :--- |
| **95** | `be v.` | **`be`** | `v.` | `/biː/` | thì, là, ở |
| **261** | `do v.` | **`do`** | `v.` | `/duː/` | làm, hành động |
| **926** | `the definite` | **`the`** | `article.` | `/ðə/` | cái, con, người (mạo từ xác định) |

---

### Lỗi 3: Ký tự khoảng trắng không ngắt (`\xa0` Non-breaking space)
* **Nguyên nhân kỹ thuật:** PDF gốc của Oxford dùng mã ký tự `\xa0` thay vì dấu cách ASCII chuẩn `\x20` giữa các cụm từ ghép.
* **Tác động:** Người dùng gõ phím Space chuẩn trên bàn phím (`\x20`) sẽ bị thuật toán so khớp chuỗi đánh giá là sai khác ký tự.

| Sheet | ID | Cột `word` hiện tại | Cần sửa thành (dấu cách chuẩn) |
| :---: | :---: | :--- | :--- |
| **A1** | **616** | `'next\xa0to'` | **`'next to'`** |
| **B1** | **859** | `'used\xa0to'` | **`'used to'`** |
| **A2** | **26, 27, 28** | `'all\xa0right'` | **`'all right'`** |
| **A2** | **46** | `'any\xa0more'` | **`'any more'`** |
| **A2** | **452** | `'instead\xa0of'` | **`'instead of'`** |

---

### Lỗi 4: Xử lý sai từ đồng âm khác nghĩa (Homonyms) và nhân bản dòng

#### Ở Sheet A1:
1. **Từ `lie` (ID 518):**
   - Hiện tại: `lie` (`v.`) được ghi nghĩa là *"nói dối"*.
   - Đúng chuẩn Oxford A1: Đây là `lie1 (v.)` mang nghĩa là **"nằm, nằm nghỉ"** (*ví dụ: lie down*). Nghĩa *"nói dối"* thuộc cấp độ B1 (`lie2`).
2. **Từ `second` (ID 804):**
   - Hiện tại: `second` (`n.`) được ghi nghĩa là *"thứ hai"*.
   - Đúng chuẩn Oxford A1: Danh từ `second1 (n.)` mang nghĩa là **"giây (đơn vị thời gian)"** (*ví dụ: Wait a second*). Nghĩa *"thứ hai"* là từ loại số thứ tự / từ hạn định (`det.` / `number`).

#### Ở Sheet B1:
1. **Từ `lie` (ID 456 & 457):**
   - Hiện tại: Bị trùng lặp 2 dòng `lie` đều là `v.` và đều ghi *"nói dối"*.
   - Đúng chuẩn Oxford B1: Có 2 từ độc lập:
     - Dòng 1: `lie` | `v.` | *nằm, nằm nghỉ* (từ `lie1 v.`)
     - Dòng 2: `lie` | `v.` | *nói dối* (từ `lie2 v.`)
     - Đồng thời thiếu bản ghi danh từ: `lie` | `n.` | *lời nói dối* (từ `lie2 n.`).
2. **Từ `live` (ID 465 & 466):**
   - Hiện tại: Bị lặp 2 dòng đều mang từ loại `adj.` với nghĩa *"trực tiếp, sống động"*.
   - Đúng chuẩn Oxford B1 (`live2 adj., adv.`):
     - Dòng 1: `live` | `adj.` | *trực tiếp, sống động* (*ví dụ: live performance*)
     - Dòng 2: `live` | **`adv.`** | *trực tiếp* (*ví dụ: The football match was broadcast live*).

---

## 3. PHƯƠNG ÁN KHẮC PHỤC
Cần chạy một script Python tự động vá dữ liệu (`patch_data_quality.py`) để:
1. Sửa toàn bộ nghĩa bị cắt cụt cho các động từ ở cả A1 và B1.
2. Chuẩn hóa tên từ vựng cho `be`, `do`, `the`.
3. Thay thế toàn bộ ký tự `\xa0` thành dấu cách thông thường `\x20` trên tất cả các cột và các sheet.
4. Điều chỉnh đúng nghĩa cho các từ đồng âm `lie`, `second`, và cập nhật loại từ `adv.` cho `live` ở B1.
