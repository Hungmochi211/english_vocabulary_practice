# 📘 English Vocabulary Practice - Back-end Service

Hệ thống Backend chuyên biệt cho nền tảng học từ vựng tiếng Anh thông minh, tập trung xử lý logic thuật toán học tập khoa học (Spaced Repetition, Levenshtein, Soundex/Metaphone, Distractor Selection), quản lý tiến độ học tập, cơ sở dữ liệu từ vựng chuẩn hóa, background jobs và tích hợp AI.

---

## 1. 🎯 Mục tiêu & Vai trò của Backend

Backend đóng vai trò là "bộ não" của toàn bộ hệ sinh thái:
- **Xử lý thuật toán so khớp gõ từ:** Chấm điểm và đưa ra phản hồi thông minh khi người dùng gõ sai chính tả hoặc hoán vị ký tự.
- **Xử lý thuật toán ghi nhớ dài hạn (Spaced Repetition):** Tính toán chính xác thời điểm ôn tập tối ưu cho từng từ vựng của từng người dùng.
- **Sinh đề thi & bài tập trắc nghiệm thông minh:** Tự động tạo câu hỏi và đáp án nhiễu có độ tương đồng cao (cùng loại từ, cùng chủ đề).
- **Quản lý dữ liệu người dùng & tiến độ:** Quản lý tài khoản, chuỗi ngày học (streak), lịch sử làm bài, tỷ lệ chính xác.
- **Tác vụ nền (Background Jobs & Automation):** Cron job kiểm tra streak, hàng đợi gửi email nhắc nhở học tập.
- **Tích hợp Trí tuệ Nhân tạo (AI Support):** RAG Chatbot giải đáp ngữ cảnh từ vựng và tối ưu lưu trữ âm thanh TTS (Text-to-Speech).

---

## 2. 🧠 Các Thuật toán Cốt lõi & Kiến trúc Xử lý

### 2.1. Nhóm Thuật toán So khớp & Chấm điểm (Spelling & Typing)
1. **Levenshtein Distance:**
   - *Mục đích:* Đo khoảng cách chỉnh sửa (số thao tác thêm, xóa, thay thế) giữa từ người dùng gõ và từ mục tiêu.
   - *Ứng dụng:* Báo phản hồi *"Gần đúng (sai 1 ký tự)"* thay vì trừ điểm hoàn toàn khi người học vô tình gõ nhầm 1 phím.
2. **Damerau-Levenshtein Distance:**
   - *Mục đích:* Nhận diện thêm thao tác hoán vị hai ký tự liền kề (transposition) với chi phí chỉ là 1 bước.
   - *Ứng dụng:* Xử lý các lỗi đánh máy nhanh phổ biến (ví dụ: gõ `teh` thay vì `the`, `peopel` thay vì `people`).

### 2.2. Nhóm Thuật toán Nghe - Chép chính tả (Phonetic Matching)
1. **Soundex & Double Metaphone:**
   - *Mục đích:* Mã hóa từ ngữ theo cách phát âm thay vì mặt chữ.
   - *Ứng dụng:* Trong bài tập *"Nghe âm thanh - gõ lại từ"*, nếu người học viết sai chính tả nhưng phát âm từ gõ ra tương tự từ gốc (ví dụ: gõ `fone` thay vì `phone`), hệ thống sẽ đưa ra thông báo gợi ý: *"Bạn phát âm đúng nhưng viết sai chính tả!"*.

### 2.3. Nhóm Thuật toán Sinh Trắc nghiệm (Quiz & Distractors)
1. **Distractor Selection via Clustering/Tagging:**
   - *Mục đích:* Tuyển chọn các đáp án sai (nhiễu) có cùng đặc điểm ngữ pháp (`part_of_speech`), cùng cấp độ (`cefr_level`) và chủ đề (`topic`).
   - *Ứng dụng:* Tránh tình trạng câu hỏi trắc nghiệm quá dễ đoán (ví dụ: hỏi động từ nhưng 3 đáp án sai lại là danh từ đồ vật).
2. **Fisher-Yates Shuffle:**
   - *Mục đích:* Xáo trộn ngẫu nhiên vị trí các đáp án A, B, C, D với độ phân bổ xác suất đồng đều tuyệt đối $O(n)$, không bị thiên lệch vị trí đáp án đúng.
3. **Stratified Sampling (Lấy mẫu phân tầng):**
   - *Mục đích:* Rút trích câu hỏi kiểm tra đại diện theo tỷ lệ đồng đều giữa các chủ đề và độ khó, đảm bảo bài thi tổng hợp đánh giá khách quan năng lực người học.

### 2.4. Nhóm Thuật toán Ôn tập & Spaced Repetition
1. **Leitner System:**
   - *Mục đích:* Mô hình hộp thẻ ghi nhớ phân tầng (Hộp 1 $\rightarrow$ Hộp 5). Trả lời đúng từ sẽ thăng cấp sang hộp cao hơn (thời gian ôn xa hơn), trả lời sai sẽ bị rớt về Hộp 1.
2. **SuperMemo-2 (SM-2) Algorithm:**
   - *Mục đích:* Thuật toán lặp lại ngắt quãng khoa học hàng đầu thế giới (chuẩn Anki).
   - *Tham số tính toán:*
     - $q$: Đánh giá chất lượng nhớ của người dùng ($0 - 5$).
     - $EF$ (Easiness Factor): Hệ số độ dễ của từ vựng (mặc định 2.5, tối thiểu 1.3).
     - $I$ (Interval): Khoảng cách số ngày cho lần ôn tập tiếp theo.
     - $n$: Số lần ôn liên tiếp thành công.
   - *Công thức:*
     $$EF' = EF + (0.1 - (5 - q) \times (0.08 + (5 - q) \times 0.02))$$
     $$I(1) = 1, \quad I(2) = 6, \quad I(n) = I(n-1) \times EF' \quad (n \ge 3)$$

---

## 3. 🗄️ Thiết kế Cơ sở Dữ liệu (MySQL Schema Đề xuất)

Hệ thống sử dụng **MySQL (5.7+ / 8.0+)** với kiến trúc quan hệ ACID mạnh mẽ:

```
[users] ──┬──< [user_progress] ──> [vocabularies] <── [lessons] <── [topics]
          ├──< [user_sm2_reviews]
          └──< [study_logs]
```

### Các Bảng Chính:
- **`vocabularies`**: Lưu kho từ vựng chuẩn hóa (Word, POS, Level, Phonetic IPA, Nghĩa, Ví dụ EN/VI, Audio SRC URL, Topic).
- **`topics`**: Danh mục chủ đề (Daily Life, Travel, Business, Technology...).
- **`lessons`**: Bài học chia nhỏ theo từng cấp độ và chủ đề (15 - 18 từ/lesson).
- **`users`**: Tài khoản người dùng (Email, Password hash / Google OAuth ID, Tên, Ngày sinh, SĐT, Avatar).
- **`user_progress`**: Tiến độ theo từng lesson (Tỷ lệ đúng, trạng thái hoàn thành $\ge 80\%$, số lần làm).
- **`user_sm2_reviews`**: Quản lý thẻ nhớ SM-2 theo từng cặp `(user_id, vocabulary_id)` gồm: `repetitions`, `easiness_factor`, `interval_days`, `next_review_date`, `leitner_box`.
- **`study_logs`**: Lịch sử học tập theo ngày (phục vụ tính Streak, biểu đồ học tập tuần hiện tại vs tuần trước).

---

## 4. 🤖 AI & Background Jobs

1. **Text-to-Speech (Google AI / Cloud TTS):**
   - Không sinh âm thanh thời gian thực (tránh lag và tốn phí).
   - Batch tạo file audio tĩnh (`.mp3`), lưu trữ trên Cloud Storage (Cloudflare R2 / AWS S3) và lưu đường dẫn `audio_url` trong DB.
2. **RAG (Retrieval-Augmented Generation) & Chatbot:**
   - Hỗ trợ giải đáp các câu hỏi sâu về từ vựng, ngữ pháp và phân biệt các từ đồng nghĩa ngay trong ngữ cảnh bài học.
3. **Cron Jobs & Queue System:**
   - Quét định kỳ mỗi đêm: Kiểm tra streak người dùng, phát hiện người dùng sắp mất chuỗi hoặc lâu không đăng nhập.
   - Đẩy tác vụ vào hàng đợi (Queue) để gửi email thông báo nhắc nhở tự động qua Gmail SMTP / Resend API.

---

## 5. 📂 Cấu trúc Thư mục Đề xuất cho Backend

```
back-end/
├── README.md                 # Tài liệu kỹ thuật Backend (file này)
├── package.json / pyproject  # Khai báo dependencies
├── .env.example              # Biến môi trường mẫu (DB, JWT, Google OAuth, Mail)
├── src/                      # (hoặc app/ nếu dùng Python)
│   ├── config/               # Cấu hình Database, Mail, OAuth, Storage
│   ├── modules/              # Chia theo module tính năng
│   │   ├── auth/             # Login, Register, Google OAuth, Forgot Password
│   │   ├── user/             # Thông tin cá nhân, Profile, Thống kê
│   │   ├── vocabulary/       # Quản lý kho từ vựng A1-C2, Topic, Lesson
│   │   ├── practice/         # Bài tập nhìn từ, nghe chép, trắc nghiệm
│   │   ├── spaced_review/    # Thuật toán SM-2, Leitner Box
│   │   ├── ai_chat/          # RAG Chatbot giải đáp thắc mắc
│   │   └── notification/     # Cron job, Queue gửi email nhắc nhở
│   ├── algorithms/           # Các hàm thuật toán thuần túy
│   │   ├── levenshtein.js/py # Khoảng cách Levenshtein / Damerau
│   │   ├── metaphone.js/py   # Soundex & Double Metaphone
│   │   ├── sm2.js/py         # Tính toán hệ số SM-2 Spaced Repetition
│   │   └── shuffle.js/py     # Fisher-Yates & Stratified Sampling
│   └── database/
│       ├── migrations/       # Quản lý cấu trúc bảng MySQL
│       └── seeders/          # Nạp dữ liệu từ oxford_3000_vocabulary.xlsx
```
