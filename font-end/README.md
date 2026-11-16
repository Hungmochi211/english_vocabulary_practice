# 🎨 English Vocabulary Practice - Front-end Web Application

Giao diện người dùng (Front-end) của nền tảng học từ vựng tiếng Anh thông minh. Ứng dụng tập trung vào trải nghiệm học tập tương tác cao (Interactive UI), phản hồi lỗi gõ tức thì, trực quan hóa lộ trình học tập, thống kê chuỗi ngày học (Streak) và tích hợp trợ lý AI giải đáp ngữ cảnh.

---

## 1. 🎯 Mục tiêu & Trải nghiệm Người dùng (UX/UI)

- **Thiết kế hiện đại, tinh gọn:** Tối ưu hóa cho việc tập trung học tập, hỗ trợ cả giao diện Sáng/Tối (Light/Dark mode) và tương thích hoàn hảo trên cả máy tính lẫn điện thoại (Responsive Design).
- **Luồng học tiêu chuẩn (Learning Flow):**
  - **Học trước (Study Mode):** Mặc định làm quen với từ vựng, phiên âm IPA, nghe phát âm mẫu, ngữ cảnh câu ví dụ và nhìn từ viết lại.
  - **Luyện tập sau (Practice Mode):** Tùy chọn các hình thức kiểm tra đa dạng (Trắc nghiệm, Gõ từ, Nghe chép chính tả).
  - **Điều kiện mở khóa bài tiếp theo:** Đạt tỷ lệ chính xác từ **80% trở lên** (hỗ trợ tùy chọn bật/tắt).
  - **Quy chuẩn bài học:** Mỗi Lesson phân bổ vừa vặn từ **15 đến 18 từ**, tránh gây quá tải nhận thức.

---

## 2. 🖥️ Các Màn hình & Chế độ Học tập Chính

### 2.1. Chế độ Học Trước & Thẻ Từ Vựng (Flashcard & Study Mode)
- Thẻ từ vựng 2 mặt có hiệu ứng lật mượt mà (3D Flip Card).
- Hiển thị đầy đủ:
  - Từ tiếng Anh (`word`) & Loại từ (`part_of_speech`).
  - Phiên âm quốc tế IPA (`phonetic`) có đánh dấu trọng âm.
  - Nút bấm phát âm chuẩn (tích hợp audio player phát nhanh, có nút nghe chậm $0.75x$).
  - Nghĩa tiếng Việt (`vietnamese_meaning`).
  - Câu ví dụ song ngữ Anh - Việt (`example_en`, `example_vi`) với từ vựng được bôi đậm (highlight).

### 2.2. Chế độ Gõ từ (Typing Mode - Nhìn nghĩa đoán từ)
- Hiển thị nghĩa tiếng Việt và câu ví dụ khuyết từ.
- Ô nhập liệu tiếng Anh hỗ trợ **phản hồi thông minh thời gian thực (Real-time Feedback)** dựa trên thuật toán Levenshtein:
  - Đúng hoàn toàn: Hiệu ứng xanh lá ✅.
  - Gõ nhầm 1 ký tự: Thông báo *"Gần đúng rồi! Bạn đang sai 1 ký tự"* (Vàng ⚠️).
  - Hoán vị 2 chữ cái liền kề (lỗi đánh máy nhanh): Thông báo *"Bạn bị đảo lộn vị trí chữ cái"* (Cam 🔄).
  - Sai hoàn toàn: Hiển thị đáp án đúng để người dùng gõ lại ghi nhớ.

### 2.3. Chế độ Nghe & Chép chính tả (Dictation Mode)
- Phát âm thanh của từ vựng (cho phép nghe lại không giới hạn).
- Người học nghe và gõ lại từ vào ô nhập liệu.
- Tích hợp phản hồi phát âm qua thuật toán **Soundex / Double Metaphone**:
  - Khi người học gõ sai chính tả nhưng phát âm giống từ chuẩn (ví dụ: gõ `fone` thay vì `phone`): Giao diện hiện thông báo khuyến khích: *"Tai bạn nghe rất chuẩn! Nhưng chính tả của từ này viết là: phone"*.

### 2.4. Chế độ Trắc nghiệm 4 Đáp án (Multiple Choice Quiz)
- Câu hỏi ngẫu nhiên được xáo trộn bằng thuật toán **Fisher-Yates Shuffle**.
- 3 đáp án sai (distractors) được thuật toán Backend chọn lọc có cùng loại từ và cùng chủ đề, tạo độ thử thách cao.
- Có đồng hồ đếm ngược thời gian và thanh tiến trình làm bài trực quan.

### 2.5. Chế độ Ôn tập Thông minh (Spaced Repetition & Leitner Review)
- Màn hình ôn tập hàng ngày theo thuật toán **SM-2**:
  - Hiển thị các từ đến hạn ôn tập trong ngày (`Due for Review`).
  - Sau khi lật thẻ xem đáp án, người học tự đánh giá mức độ ghi nhớ qua 4 nút bấm chuẩn:
    - 🔴 **Again** (Quên hoàn toàn - ôn lại ngay sau 10 phút)
    - 🟠 **Hard** (Khó nhớ - ôn lại ngày mai)
    - 🟢 **Good** (Nhớ tốt - đẩy lịch ôn xa hơn)
    - 🔵 **Easy** (Quá dễ - đẩy lịch ôn rất xa)
- Trực quan hóa mô hình **Hộp thẻ Leitner (Box 1 $\rightarrow$ Box 5)** để người học thấy số lượng từ mình đã làm chủ hoàn toàn.

### 2.6. Quản lý Bộ thẻ Ôn tập Cá nhân (Custom Deck Management)
- Cho phép người dùng tự tạo kho từ vựng riêng:
  - **Nhập thủ công:** Thêm từng từ hoặc dán nhanh danh sách từ vựng trên giao diện.
  - **Import File:**
    - Tự động đọc và parse trực tiếp từ file **Excel (`.xlsx`, `.xls`)**.
    - Tích hợp AI Parser để trích xuất từ vựng từ các file tài liệu văn bản phức tạp: **Word (`.docx`), PDF, Text (`.txt`)**.

---

## 3. 📊 Dashboard & Thống kê Cá nhân

1. **Hệ thống Chuỗi Ngày học (Streak Tracker):**
   - Biểu tượng ngọn lửa 🔥 hiển thị số ngày học liên tục.
   - Lịch điểm danh (Calendar heat-map) tương tự GitHub để theo dõi mật độ học tập theo ngày.
   - Cảnh báo trực quan khi sắp đến hạn mất chuỗi trong ngày.
2. **Biểu đồ Thống kê Hiệu suất:**
   - So sánh trực quan dữ liệu học tập giữa **tuần hiện tại** và **tuần trước** (Số từ đã học, thời gian học, tỷ lệ đúng %).
   - Biểu đồ radar / cột hiển thị năng lực từ vựng theo từng Cấp độ (A1, A2, B1, B2) và Chủ đề.
3. **Lịch sử Bài học Gần nhất:**
   - Bảng tổng hợp các bài đã hoàn thành, điểm số, tỷ lệ phần trăm và nút bấm "Ôn lại nhanh" (Quick Retry).

---

## 4. 💬 Trực tuyến & Hỗ trợ Trí tuệ Nhân tạo (AI Chat)

- **Chatbot AI Popup:**
  - Cửa sổ chat nổi ở góc màn hình cho phép người dùng hỏi nhanh:
    - *"Từ này khác gì với từ đồng nghĩa X?"*
    - *"Cho tôi thêm 3 ví dụ thực tế sử dụng từ này trong giao tiếp công sở."*
    - *"Cách dùng giới từ đi kèm với từ này như thế nào?"*
- **Hỗ trợ Quản trị viên & Liên kết Mạng xã hội:**
  - Nút bấm hỗ trợ trực tiếp khi QTV đang online hoặc chuyển hướng nhanh đến các nền tảng cộng đồng (Facebook Group, Discord, Telegram).

---

## 5. 📂 Cấu trúc Thư mục Đề xuất cho Front-end

Cấu trúc dự án sử dụng **React / Next.js (App Router)** kết hợp **Tailwind CSS** và **Shadcn UI**:

```
font-end/
├── README.md                 # Tài liệu kỹ thuật Front-end (file này)
├── package.json              # Khai báo dependencies (React, Lucide icons, Framer Motion...)
├── tailwind.config.js        # Cấu hình giao diện và màu sắc
├── public/                   # Tài nguyên tĩnh (Logo, âm thanh, icon)
└── src/
    ├── app/                  # Next.js App Router (hoặc pages/ nếu dùng CRA/Vite)
    │   ├── (auth)/           # Trang Login, Register, Forgot Password
    │   ├── dashboard/        # Trang thống kê, Streak, biểu đồ hiệu suất
    │   ├── learn/            # Danh sách cấp độ (A1-B2), Topic, Lesson
    │   │   └── [lessonId]/   # Màn hình học (Study & Practice)
    │   ├── review/           # Màn hình ôn tập SM-2 & Leitner Box
    │   ├── custom-deck/      # Màn hình tạo bộ từ riêng & Import file (Excel, Word)
    │   └── profile/          # Thông tin cá nhân, cài đặt tài khoản
    ├── components/           # Các UI component tái sử dụng
    │   ├── flashcard/        # Thẻ lật từ vựng 3D
    │   ├── exercises/        # Giao diện gõ từ, nghe chép, trắc nghiệm
    │   ├── charts/           # Biểu đồ thống kê tuần, Streak heatmap
    │   ├── ai-chat/          # Hộp thoại Chatbot giải đáp từ vựng
    │   └── ui/               # Button, Modal, Progress bar, Input (Shadcn UI)
    ├── hooks/                # Custom React hooks (useAudio, useStreak, useSpacedReview)
    ├── services/             # Gọi API Backend (Axios / Fetch)
    └── utils/                # Hàm phụ trợ format ngày, tính điểm, âm thanh
```
