# Feature Specification: Chuẩn hóa, Quản lý kho từ vựng Oxford 3000 và Cơ sở dữ liệu Bài học

**Feature Branch**: `001-vocabulary-data`

**Created**: 2026-11-17 | **Last Updated**: 2026-11-27

**Status**: Approved

**Input**: Đề cương Thực tập Chuyên ngành FITA - VNUA: "Nội dung 1: Khảo sát, thu thập dữ liệu và phân tích yêu cầu; Thu thập, chuẩn hóa tập dữ liệu từ vựng tiếng Anh bám sát chuẩn CEFR (phiên âm IPA, từ loại, nghĩa tiếng Việt, câu ví dụ, audio)".

---

## Scope & System Boundary *(Ranh giới hệ thống)*

- **Thuộc phạm vi Feature 001**: Toàn bộ Backend Engine, bao gồm thiết kế mô hình cơ sở dữ liệu PostgreSQL, TypeORM Migrations, Seeder nạp và làm sạch dữ liệu từ Excel, thuật toán phân bổ bài học cân bằng (Balanced Partitioning), và các RESTful API công khai phục vụ truy vấn danh mục chủ đề, bài học và tra cứu từ vựng.
- **Ngoài phạm vi Feature 001 (Nằm ở các feature sau)**:
  - Giao diện người dùng Web (ReactJS, TailwindCSS, màn hình `/learn`, tương tác Thẻ Flashcard 3D) thuộc **Feature `004-frontend-webapp`**.
  - Tiến độ học tập cá nhân hóa, trạng thái khóa bài theo tài khoản, thuật toán Spaced Repetition (SM-2, Leitner) và kiểm tra đánh giá ($\ge 80\%$) thuộc **Feature `002-backend-core`**.
  - Trợ lý ảo Chatbot AI hỏi đáp ngữ cảnh (Gemini Function Calling 3 tools) thuộc **Feature `003-ai-chatbot`**.

---

## Clarifications

### Session 2026-11-17

- Q: Nguồn từ vựng lấy từ đâu và gồm những cấp độ nào? → A: Lấy từ tài liệu Oxford 3000 (`The_Oxford_3000_by_CEFR_level.pdf`), chuẩn hóa thành file `tools/oxford_3000_vocabulary.xlsx` gồm 4 cấp độ CEFR: A1, A2, B1, B2.
- Q: Các từ có nhiều loại từ (multi-POS như `attack n., v.`) thì lưu trữ thế nào? → A: Tách phẳng thành các dòng độc lập trong database, mỗi dòng đại diện cho 1 từ loại kèm nghĩa tiếng Việt và câu ví dụ riêng để phục vụ chính xác cho thuật toán chọn đáp án nhiễu (Distractor Selection) và Spaced Repetition (SM-2).
- Q: Các từ bị dính số chỉ mục từ điển (`close2`, `can2`, `ring1`, `ring2`) và chú thích ngoặc đơn (`bear (animal)`, `rock (stone)`) thì xử lý thế nào? → A: Bắt buộc làm sạch 100% cột `word` thành chữ thuần túy (`close`, `can`, `ring`, `bear`, `rock`) để các thuật toán so khớp chuỗi (Levenshtein) và Text-to-Speech (TTS) không bị lỗi.
- Q: Quy tắc chia bài học (Lesson) từ danh sách từ vựng như thế nào? → A: Gom các từ cùng cấp độ (`cefr_level`) và cùng chủ đề (`topic_id`), áp dụng thuật toán tìm nghiệm nguyên phân hoạch (Integer Partition Search) để chia thành các bài học có đúng từ 15 đến 18 từ. Bài học vượt 18 từ (dung sai tối đa $\le 20$ từ) chỉ được phép xuất hiện duy nhất ở vị trí bài học cuối cùng của nhóm. Tuyệt đối không cho phép tạo bài học dưới 15 từ trong bất kỳ trường hợp nào.
- Q: Tiêu chí lựa chọn số bài học khi có nhiều phương án phân hoạch hợp lệ (ví dụ: 124 từ có thể chia thành 7 bài [18,18,18,18,18,17,17] hoặc 8 bài [16,16,16,16,15,15,15,15])? → A: Ưu tiên tối thiểu hóa số lượng bài học (tức tối ưu độ dài bài học về phía 17-18 từ, chọn $k = 7$) để lộ trình học gọn gàng, giảm số lần chuyển bài cho học viên.
- Q: Xử lý thế nào với trường hợp biên dữ liệu không thể chia hợp lệ (như nhóm 1–14 từ hoặc nhóm không có nghiệm nguyên thỏa cận 15-20)? → A: Toàn bộ các nhóm `(cefr_level, topic)` có từ của Oxford 3000 sau chuẩn hóa ngữ nghĩa đều được kiểm soát định lượng rơi vào miền phân hoạch hợp lệ ($15\text{–}20$, $30\text{–}38$, $45\text{–}56$, $60\text{–}74$, hoặc $\ge 75$ từ) nên 100% đều chia được thành các bài 15-18 từ (bài cuối $\le 20$ từ). Đối với dữ liệu mở rộng trong tương lai: Nếu một nhóm không thể phân hoạch hợp lệ, hệ thống Seeder vẫn nạp từ vựng vào bảng `vocabularies` (kho dữ liệu) nhưng bỏ qua việc tạo `lessons` cho nhóm đó, ghi log cảnh báo `[SEED_WARNING: Topic X Level Y có N từ, không thể phân hoạch hợp lệ vào khoảng 15-20 từ. Từ vựng được lưu trữ trong kho nhưng chưa phân bổ vào bài học.]`.
- Q: File âm thanh phát âm (.mp3) được lưu trữ thế nào? → A: Tuyệt đối không lưu dữ liệu nhị phân (Blob/Base64) vào PostgreSQL; chỉ lưu URL tĩnh dạng `VARCHAR(500)` trỏ đến Cloud Storage (Cloudflare R2 / AWS S3) hoặc CDN.
- Q: Ký tự khoảng trắng không ngắt (`\xa0`) trong PDF xử lý thế nào? → A: Đã được chuẩn hóa chuyển thành dấu cách ASCII thông thường (`\x20`, mã 32) để tránh lỗi so khớp chuỗi khi người dùng gõ từ bàn phím.

### Session 2026-11-23

- Q: Khi một từ có nhiều nghĩa cùng cấp độ và cùng từ loại nhưng nguồn không ghi số nghĩa, hệ thống nên phân biệt các bản ghi đó thế nào? → A: Đánh `sense_number` từ 1 theo thứ tự xuất hiện trong file nguồn, riêng cho từng bộ `(word, cefr_level, part_of_speech)`; cùng một file nguồn phải cho cùng số nghĩa khi nạp lại.
- Q: Nếu thứ tự hoặc nội dung file nguồn thay đổi, hệ thống nên giữ `sense_number` của các nghĩa đã có như thế nào? → A: Mỗi lần nạp, đánh số lại từ 1 theo thứ tự trong file nguồn hiện tại.

### Session 2026-11-27

- Q: Phân loại từ vựng vào 16 chủ đề theo ranh giới cứng CEFR (A1–B1 vs B2) hay theo ngữ nghĩa xuyên cấp độ? → A: Phân loại xuyên cấp độ theo đúng ngữ nghĩa thực tế ("Quy tắc vàng": từ cá nhân/hữu hình/thường nhật vào Nhóm Đời sống & Giao tiếp; từ vĩ mô/trừu tượng/chuyên ngành vào Nhóm Học thuật & Chuyên sâu), đồng thời kiểm soát kích thước mọi cụm `(cefr_level, topic)` có từ luôn thỏa miền nghiệm phân hoạch hợp lệ ($\ge 15$ từ, không rơi vào khoảng lẻ $21\text{–}29, 39\text{–}44, 57\text{–}59$) để 100% của 3.813 từ đều lên bài học (0 `SEED_WARNING`).
- Q: Thứ tự ID của 16 chủ đề trong bảng `topics` (Database) có đổi theo số thứ tự tham chiếu quy chuẩn không? → A: Giữ nguyên thứ tự ID trong `topic.seeder.ts` (Nhóm Đời sống `id = 1..8`, Nhóm Học thuật `id = 9..16`) để tương thích ngược 100% với hợp đồng và bộ kiểm thử `US2-AS2`.
- Q: Nhóm hư từ ngữ pháp & từ cơ bản (mạo từ, giới từ, liên từ, đại từ, số đếm, thời gian) được phân vào chủ đề nào? → A: Phân bổ tự nhiên theo chức năng ngữ cảnh: thời gian/số đếm/màu sắc/trợ động từ chung $\rightarrow$ `Daily Life & Routines`; đại từ chỉ người $\rightarrow$ `People & Relationships`; từ nối hội thoại/thán từ/nghi vấn $\rightarrow$ `Communication & Feelings` (từ nối nghị luận học thuật B2 $\rightarrow$ `Academic & Education`); giới từ hướng di chuyển $\rightarrow$ `Travel & Transportation`; giới từ vị trí không gian sống $\rightarrow$ `Home & Environment`.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Quản trị viên nạp kho từ vựng từ Excel và tự động phân bổ bài học (Priority: P1)

Quản trị viên hoặc script hệ thống chạy lệnh nạp dữ liệu (Seeder) từ file `tools/oxford_3000_vocabulary.xlsx` vào PostgreSQL. Hệ thống nạp 16 chủ đề chuẩn (8 chủ đề Đời sống & Giao tiếp và 8 chủ đề Học thuật & Chuyên sâu), nạp toàn bộ danh sách từ vựng của 4 cấp độ (A1, A2, B1, B2) đã phân loại theo đúng ranh giới ngữ nghĩa, tự động loại trừ trùng lặp (Idempotent), và chạy thuật toán phân bổ chia các từ vựng vào các bài học (`Lesson`) với định lượng chuẩn từ 15 đến 18 từ/bài.

**Why this priority**: Kho từ vựng và bài học là nền tảng cốt lõi của toàn bộ ứng dụng. Không có dữ liệu chuẩn thì các phân hệ Học tập, Bài tập, SM-2 và Chatbot đều không thể hoạt động.

**Independent Test**: Chạy lệnh seed trên database trống; kiểm tra số lượng bản ghi `vocabularies` ($\ge 3.500$ dòng sau khi tách multi-POS), số lượng `topics` (16 chủ đề), số lượng `lessons` và kiểm tra 100% các lesson đều có số từ từ 15 đến 18 từ (ngoại trừ bài cuối nhóm tối đa 20 từ). Chạy lại lệnh seed lần 2, kiểm tra số lượng bản ghi không bị nhân đôi.

**Acceptance Scenarios**:

1. **Given** database PostgreSQL trống, **When** chạy lệnh seeder với file `tools/oxford_3000_vocabulary.xlsx`, **Then** hệ thống nạp đủ 16 chủ đề, toàn bộ từ vựng A1-B2 được lưu vào bảng `vocabularies` ($\ge 3.500$ bản ghi), và bảng `lessons` được tạo với định lượng chuẩn 15–18 từ/bài; riêng bài cuối cùng của mỗi nhóm cho phép mở rộng dung sai 19–20 từ (100% các bài trước bài cuối đều có $15 \le size \le 18$, tuyệt đối 0 bài học nào $< 15$ từ). (Mã: `US1-AS1`)
2. **Given** hệ thống đã được nạp dữ liệu đầy đủ, **When** chạy lại lệnh seeder lần thứ hai, **Then** hệ thống nhận diện dữ liệu đã tồn tại, không sinh ra bản ghi trùng lặp và tổng số dòng trong các bảng không thay đổi. (Mã: `US1-AS2`)
3. **Given** một nhóm từ có 34 từ vựng cùng level A1 và cùng topic, **When** thuật toán chia lesson xử lý, **Then** hệ thống tạo ra 2 bài học (mỗi bài 17 từ), không có bài nào bị lẻ dưới 15 từ. (Mã: `US1-AS3`)
4. **Given** một nhóm từ có 19 từ vựng cùng level và topic, **When** thuật toán chia lesson xử lý, **Then** hệ thống tạo ra đúng 1 bài học chứa 19 từ (chấp nhận ngưỡng dung sai $\le 20$ để tránh tạo bài lẻ). (Mã: `US1-AS4`)
5. **Given** bản ghi từ vựng trong file Excel, **When** nạp vào database, **Then** cột `word` không chứa số chỉ mục, không chứa ngoặc đơn, không chứa ký tự `\xa0`, và `phonetic` bắt buộc định dạng `^/.+/$` không chứa ký tự `*`. (Mã: `US1-AS5`)
6. **Given** một nhóm từ có 124 từ vựng cùng level và topic (tồn tại cả phương án 7 bài và 8 bài hợp lệ), **When** thuật toán chia lesson xử lý, **Then** hệ thống áp dụng quy tắc ưu tiên số bài ít nhất ($k = 7$) tạo 7 bài học với kích thước `[17, 17, 18, 18, 18, 18, 18]`. (Mã: `US1-AS6`)

---

### User Story 2 - Người học xem danh mục lộ trình học theo Cấp độ và Chủ đề (Priority: P1)

Người học (hoặc ứng dụng phía client) gọi API lấy danh mục lộ trình học tập. Người học lọc theo cấp độ mong muốn (`level`: A1, A2, B1, hoặc B2) và chủ đề (`topicId`), hệ thống hiển thị danh sách các chủ đề (Topics) kèm theo các bài học con (Lessons) thuộc chủ đề đó, hiển thị rõ số lượng từ vựng trong bài (chuẩn 15–18 từ/bài, bài cuối nhóm tối đa 20 từ theo FR-006).

**Why this priority**: Giúp người học định hình lộ trình học tập có cấu trúc, không bị ngợp, đáp ứng đúng mục tiêu chuẩn đầu ra B1 của đề cương chuyên ngành.

**Independent Test**: Gửi request `GET /api/v1/lessons?level=A1` và kiểm tra danh sách bài học trả về có đầy đủ thông tin: ID, tiêu đề, chủ đề, số từ (15–20 từ theo FR-006), cấp độ A1.

**Acceptance Scenarios**:

1. **Given** người học chọn xem cấp độ A1, **When** gọi API lấy danh sách bài học `GET /api/v1/lessons?level=A1`, **Then** hệ thống trả về danh sách các bài học thuộc A1, kèm thông tin chủ đề tương ứng. (Mã: `US2-AS1`)
2. **Given** người học lọc theo cả cấp độ B1 và chủ đề cụ thể, **When** gọi API `GET /api/v1/lessons?level=B1&topicId=2`, **Then** hệ thống chỉ trả về các bài học thuộc đúng cấp độ B1 và topicId=2. (Mã: `US2-AS2`)
3. **Given** một bài học trong danh sách, **When** API trả về thông tin bài, **Then** dữ liệu chứa đầy đủ tiêu đề bài học (ví dụ: "Lesson 1: Daily Routines"), tổng số từ (`wordCount` từ 15-20 theo FR-006), cấp độ (`cefrLevel`) và thứ tự bài (`orderIndex`). (Mã: `US2-AS3`)

---

### User Story 3 - Người học xem chi tiết bài học và thẻ từ vựng đầy đủ ngữ cảnh (Priority: P1)

Ứng dụng client gọi API chi tiết bài học để bắt đầu chu trình **Học nạp (Acquisition)**. Hệ thống tải về danh sách từ vựng của bài học đó (chuẩn 15–18 từ, bài cuối nhóm tối đa 20 từ theo FR-006). Mỗi từ vựng có đầy đủ: chữ tiếng Anh, loại từ, phiên âm quốc tế IPA, đường dẫn nghe phát âm âm thanh mẫu (`audio_url`), nghĩa tiếng Việt chuẩn theo loại từ đó, và câu ví dụ song ngữ Anh - Việt.

**Why this priority**: Đây là bước "Học nạp" bắt buộc trong chu trình sư phạm: tiếp thu kiến thức nền tảng trước khi chuyển sang bước "Học áp dụng" (luyện tập phản xạ).

**Independent Test**: Gửi request `GET /api/v1/lessons/:id`, kiểm tra danh sách từ trả về có đúng thứ tự `order_in_lesson` từ $1 \rightarrow N$ (với $15 \le N \le 20$ theo FR-006), mỗi từ có đầy đủ các trường thông tin bắt buộc không bị null (gồm `id`, `word`, `cefrLevel`, `partOfSpeech`, `senseNumber`, `phonetic`, `vietnameseMeaning`, `exampleEn`, `exampleVi`, `topicId`; riêng `audioUrl` cho phép `null` theo Edge Case 8).

**Acceptance Scenarios**:

1. **Given** bài học có ID = 1, **When** client truy cập `GET /api/v1/lessons/1`, **Then** hệ thống trả về thông tin bài học và danh sách từ vựng (15–20 từ theo FR-006) được sắp xếp tăng dần theo `orderInLesson` ($1 \rightarrow N$). (Mã: `US3-AS1`)
2. **Given** một từ vựng trong bài học (ví dụ: `abandon`), **When** client đọc chi tiết từ, **Then** payload trả về đầy đủ: `word: "abandon"`, `partOfSpeech: "v."`, `phonetic: "/əˈbæn.dən/"`, `vietnameseMeaning: "từ bỏ"`, `exampleEn: "Many baby girls have been abandoned..."`, `exampleVi: "Nhiều bé gái bị bỏ rơi..."`. (Mã: `US3-AS2`)
3. **Given** bài học không tồn tại trong hệ thống (ID = 999999), **When** client truy cập, **Then** hệ thống trả về mã lỗi `404 Not Found` với cấu trúc lỗi `{ "success": false, "data": null, "error": { "code": "LESSON_NOT_FOUND", "message": "Bài học không tồn tại", "details": null } }`. (Mã: `US3-AS3`)

---

### User Story 4 - Tra cứu từ vựng nhanh có phân biệt loại từ và cấp độ (Priority: P2)

Người học hoặc các phân hệ khác (như Chatbot AI Tool Use) cần tra cứu thông tin của một từ vựng bất kỳ bằng từ khóa tiếng Anh. Hệ thống tìm kiếm và trả về danh sách các bản ghi khớp, phân tách rõ ràng nếu từ đó có nhiều loại từ ở các cấp độ khác nhau (ví dụ: `close` tính từ ở A2 nghĩa là "gần gũi", `close` danh từ ở B2 nghĩa là "hồi kết").

**Why this priority**: Phục vụ nhu cầu tra cứu từ điển nhanh trong app và là công cụ (Tool 1: `lookup_vocabulary`) để Chatbot AI truy vấn dữ liệu chuẩn.

**Independent Test**: Gọi API `GET /api/v1/vocabularies/search?q=close`, kiểm tra kết quả trả về gồm 2 bản ghi riêng biệt: A2 (adj.) và B2 (n.), không bị gộp chung.

**Acceptance Scenarios**:

1. **Given** từ vựng `close` có ở cả A2 (adj.) và B2 (n.), **When** tra cứu `GET /api/v1/vocabularies/search?q=close`, **Then** hệ thống trả về cả 2 bản ghi độc lập với nghĩa và câu ví dụ riêng biệt. (Mã: `US4-AS1`)
2. **Given** từ khóa tìm kiếm viết hoa `ABANDON` hoặc có khoảng trắng thừa `"  abandon  "`, **When** tra cứu, **Then** hệ thống tự động làm sạch và tìm ra đúng từ `abandon`. (Mã: `US4-AS2`)
3. **Given** từ khóa không có trong từ điển Oxford 3000, **When** tra cứu, **Then** hệ thống trả về danh sách rỗng `[]` với mã `200 OK` (không báo lỗi 500). (Mã: `US4-AS3`)

---

## Edge Cases

1. **Từ đồng âm khác nghĩa (Homonyms) có số chỉ mục:** Các từ như `close1`, `close2`, `can1`, `can2`, `ring1`, `ring2` trong PDF gốc bắt buộc phải lưu ở cột `word` là chữ sạch (`close`, `can`, `ring`). Sự khác biệt được phân tách qua `part_of_speech`, `phonetic`, `cefr_level` và `vietnamese_meaning`.
2. **Từ dính chú thích ngữ cảnh trong ngoặc đơn:** Các từ như `bear (animal)`, `rock (stone)`, `last1 (final)` bắt buộc phải làm sạch thành `bear`, `rock`, `last`.
3. **Ký tự khoảng trắng không ngắt (`\xa0`):** Các cụm từ như `next to`, `used to`, `all right`, `instead of` trong PDF có mã `\xa0` phải chuyển thành dấu cách thường `\x20` để so khớp chuỗi không bị lệch ký tự.
4. **Phân bổ bài học và nhóm dữ liệu ngoại lệ:** Sử dụng thuật toán tìm nghiệm nguyên phân hoạch (Integer Partition Search) chia đều số lượng từ của nhóm vào $k$ bài học sao cho mọi bài học đầu đều có $15 \le size \le 18$ và chỉ bài cuối cùng mới có thể đạt tối đa 20 từ. Tuyệt đối KHÔNG tạo bài học dưới 15 từ trong bất kỳ trường hợp nào. Nếu gặp nhóm dữ liệu không thể phân hoạch hợp lệ (ví dụ $N < 15$ hoặc $21 \le N \le 29$), hệ thống Seeder vẫn nạp từ vựng vào bảng `vocabularies` nhưng bỏ qua tạo `lessons`, ghi log cảnh báo `[SEED_WARNING]` để chờ dữ liệu được bổ sung.
5. **Cụm từ ghép (Phrasal verbs / Idioms):** Các từ chứa dấu cách hợp lệ như `ice cream`, `because of`, `have to`, `no one` phải được giữ nguyên dấu cách chuẩn giữa các từ.
6. **Phiên âm IPA chứa ký tự đặc biệt:** Các ký tự phiên âm quốc tế như `/əˈbæn.dən/`, `/θ/`, `/ð/`, `/ʃ/`, `/tʃ/`, `/dʒ/` phải được lưu trữ trong PostgreSQL bằng bảng mã `UTF-8` để không bị lỗi font hoặc biến thành dấu `?`.
7. **Nghĩa tiếng Việt có dấu tiếng Việt đầy đủ:** Toàn bộ cột `vietnamese_meaning` và `example_vi` phải bảo toàn dấu tiếng Việt (Unicode NFC chuẩn).
8. **Dữ liệu âm thanh chưa có sẵn lúc khởi tạo:** Trường `audio_url` là nullable (`NULL` hoặc chuỗi rỗng), hệ thống không được crash nếu một từ vựng chưa kịp cập nhật đường dẫn audio.
9. **Chạy lại lệnh Seeder nhiều lần (Idempotency):** Seeder áp dụng Transaction: khi chạy lại, hệ thống sử dụng cơ chế `UPSERT` cho từ vựng và xóa/tạo lại quan hệ bài học theo từng Topic/Level để đảm bảo số lượng dòng không bị nhân đôi và dữ liệu hoàn toàn sạch.
10. **Tìm kiếm từ khóa có chứa ký tự đặc biệt:** Xử lý sanitize input khi tìm kiếm từ vựng (chống SQL Injection và Regex ReDoS), độ dài từ khóa $1 \le \text{length}(q) \le 100$, giới hạn kết quả trả về `limit` mặc định 20, tối đa 50.
11. **Từ có nhiều nghĩa tiếng Việt:** Nghĩa tiếng Việt được lưu trong cột `VARCHAR(255)`, độ dài nghiệp vụ tối đa 255 ký tự, các nghĩa phụ cách nhau bằng dấu chấm phẩy `;` (semicolon).
12. **Thứ tự từ trong bài học (`order_in_lesson`):** Phải là số nguyên liên tục từ $1 \rightarrow N$ trong mỗi lesson, không bị nhảy cóc hoặc trùng lặp số thứ tự.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống MUST lưu trữ toàn bộ kho từ vựng tiếng Anh Oxford 3000 gồm 4 cấp độ CEFR (`A1`, `A2`, `B1`, `B2`) với đầy đủ 9 trường thông tin chuẩn hóa: `id`, `word`, `cefr_level`, `part_of_speech`, `phonetic`, `vietnamese_meaning`, `example_en`, `example_vi`, `topic_id`.
- **FR-002**: Cột `word` MUST là chuỗi chữ sạch, KHÔNG chứa số chỉ mục homonym (như `close2`, `can2`), KHÔNG chứa ngoặc đơn chú thích (như `bear (animal)`), và KHÔNG chứa ký tự `\xa0`.
- **FR-003**: Các từ có nhiều loại từ (multi-POS) MUST được tách thành các bản ghi độc lập trong bảng `vocabularies`, mỗi bản ghi tương ứng với một loại từ duy nhất trong 14 nhãn `part_of_speech` chuẩn từ Excel (`n.`, `v.`, `adj.`, `adv.`, `prep.`, `conj.`, `pron.`, `det.`, `modal v.`, `number`, `exclam.`, `article.`, `indefinite article.`, `infinitive marker`). Khi một bộ `(word, cefr_level, part_of_speech)` có nhiều nghĩa, `sense_number` là số nguyên liên tục bắt đầu từ 1 theo thứ tự xuất hiện trong file nguồn hiện tại của riêng bộ đó; thứ tự này phải được giữ ổn định khi nạp lại cùng một file. Khi thứ tự hoặc nội dung file nguồn thay đổi, seeder MUST đánh số lại từ 1 theo file mới và cập nhật đồng bộ các bản ghi.
- **FR-004**: Cột `phonetic` MUST có giá trị 100% đầy đủ (không được để NULL hoặc rỗng), được định dạng chuẩn quốc tế đặt trong cặp dấu gạch chéo `^/.+/$` và KHÔNG chứa ký tự lỗi `*`.
- **FR-005**: Hệ thống MUST định nghĩa đủ 16 chủ đề bài học chuẩn hóa (`topics`) chia thành 2 tầng ngữ nghĩa xuyên cấp độ (giữ thứ tự định danh `id = 1..8` cho Nhóm Đời sống & Giao tiếp và `id = 9..16` cho Nhóm Học thuật & Chuyên sâu trong bảng `topics`):
  - *Tầng Đời sống & Giao tiếp — Vi mô / Hữu hình / Thường nhật (8 chủ đề)*: `daily_life` (Daily Life & Routines), `travel_transport` (Travel & Transportation), `people_relationships` (People & Relationships), `education_work` (Education & Work), `food_health` (Food & Health), `home_environment` (Home & Environment), `entertainment_media` (Entertainment & Media), `communication_feelings` (Communication & Feelings).
  - *Tầng Học thuật & Chuyên sâu — Vĩ mô / Trừu tượng / Chuyên ngành (8 chủ đề)*: `academic_education` (Academic & Education), `business_workplace` (Business & Workplace), `health_environment` (Health & Environment), `media_culture` (Media & Culture), `personal_social_psychology` (Personal & Social Psychology), `science_technology` (Science & Technology), `society_law` (Society & Law), `travel_global_issues` (Travel & Global Issues).
  - *Quy chuẩn gán nhãn ngữ nghĩa*: Phân loại dựa trên bộ `(word, part_of_speech, vietnamese_meaning, example_en)` theo Quy tắc vàng (vi mô/cá nhân $\rightarrow$ Tầng Đời sống; vĩ mô/chuyên ngành $\rightarrow$ Tầng Học thuật), Cây quyết định 3 nhánh (`Environment`, `Media`, `Education/Work`), và kiểm soát định lượng mọi cụm `(cefr_level, topic)` có từ đều thỏa miền phân hoạch hợp lệ ($\ge 15$ từ, không rơi vào khoảng lẻ $21\text{–}29, 39\text{–}44, 57\text{–}59$) để 100% từ vựng đều lên bài học.
- **FR-006**: Toàn bộ từ vựng thuộc các nhóm hợp lệ MUST được phân bổ vào các bài học (`lessons`) với định lượng mỗi bài học chứa từ **15 đến 18 từ vựng** (bài vượt 18 từ, tối đa $\le 20$ từ, chỉ được phép nằm ở bài cuối nhóm). Hệ thống MUST NOT tạo bài học dưới 15 từ trong bất kỳ trường hợp nào. Nhóm từ vựng không thể chia hợp lệ sẽ được nạp vào kho nhưng không tạo bài học và ghi cảnh báo `[SEED_WARNING]`.
- **FR-007**: Mọi từ vựng trong cùng một bài học MUST thuộc cùng một Cấp độ (`cefr_level`) và cùng một Chủ đề (`topic_id`), không trộn lẫn cấp độ hoặc chủ đề khác nhau vào chung một bài học.
- **FR-008**: Hệ thống MUST cung cấp script tự động nạp dữ liệu (Seeder) nạp trực tiếp từ file `tools/oxford_3000_vocabulary.xlsx` vào PostgreSQL, hỗ trợ chạy an toàn nhiều lần (Idempotent) qua Database Transaction. Nếu thiếu file nguồn, thiếu cột chuẩn hoặc có bản ghi vi phạm ràng buộc (thiếu `word`/`phonetic`/`vietnamese_meaning`, sai `cefr_level`), Seeder MUST ghi báo cáo lỗi chi tiết (số dòng, trường lỗi) và rollback toàn bộ transaction, không để lại dữ liệu dở dang.
- **FR-009**: Hệ thống MUST cung cấp API `GET /api/v1/topics` trả về danh sách 16 chủ đề kèm số lượng bài học tương ứng của từng chủ đề.
- **FR-010**: Hệ thống MUST cung cấp API `GET /api/v1/lessons` hỗ trợ tham số truy vấn công khai `level` (`A1`, `A2`, `B1`, `B2`) và `topicId` (số nguyên dương), ánh xạ tương ứng vào các cột database `cefr_level` và `topic_id` (hỗ trợ không truyền bộ lọc để lấy tất cả, kết hợp cả hai bộ lọc, trả `[]` với `200 OK` nếu không có bài phù hợp, và trả `400 VALIDATION_ERROR` nếu giá trị `level` hoặc `topicId` không hợp lệ).
- **FR-011**: Hệ thống MUST cung cấp API `GET /api/v1/lessons/:id` trả về thông tin chi tiết bài học và danh sách từ vựng theo thứ tự `order_in_lesson` phục vụ chu trình Học nạp.
- **FR-012**: Hệ thống MUST cung cấp API `GET /api/v1/vocabularies/:id` trả về chi tiết một từ vựng và API `GET /api/v1/vocabularies/search?q=...&limit=...` hỗ trợ tìm kiếm từ vựng theo quy tắc chuẩn hóa:
  - Khớp tiền tố (Prefix Match): Tìm kiếm theo tiền tố `LOWER(word) LIKE CONCAT(:sanitizedQ, '%')` sử dụng index `idx_vocab_word_lower`.
  - Escape ký tự đặc biệt: Ký tự wildcard `%` và `_` trong từ khóa $q$ bắt buộc phải được escape (`\%`, `\_`) để tránh wildcard injection.
  - Tham số đầu vào: $1 \le \text{length}(q) \le 100$, phân trang `limit` từ $1 \rightarrow 50$ (mặc định 20).
  - Thứ tự kết quả tất định (Deterministic Ordering): Luôn sắp xếp theo `ORDER BY LENGTH(word) ASC, word ASC, cefr_level ASC, part_of_speech ASC, sense_number ASC`.
- **FR-013**: Cột `audio_url` MUST chỉ lưu chuỗi đường dẫn URL tĩnh (Cloud Storage / CDN). Cơ sở dữ liệu MUST NOT lưu dữ liệu nhị phân (Blob/Base64) của file âm thanh trực tiếp vào PostgreSQL.
- **FR-014**: Mọi phản hồi API MUST tuân thủ định dạng JSON envelope thống nhất:
  - Thành công ($2xx$): `{ "success": true, "data": ..., "error": null }`
  - Thất bại ($4xx, 5xx$): `{ "success": false, "data": null, "error": { "code": string, "message": string, "details": any | null } }`. Trường `details` bắt buộc là `null` đối với lỗi thông thường, và bắt buộc chứa mảng/đối tượng thông báo lỗi xác thực chi tiết đối với mã `VALIDATION_ERROR` ($400$).
- **FR-015**: Cơ sở dữ liệu MUST sử dụng bảng mã `UTF-8` chuẩn của PostgreSQL để hỗ trợ hiển thị hoàn hảo tiếng Việt và ký tự phiên âm IPA quốc tế.

---

## Key Entities

- **Topic (Chủ đề)**: Đại diện cho 1 trong 16 chủ đề từ vựng chuẩn hóa (`id`, `code`, `name`, `name_vi`, `description`, `created_at`).
- **Vocabulary (Từ vựng chuẩn hóa)**: Bản ghi từ vựng độc lập (`id`, `word`, `cefr_level`, `part_of_speech`, `sense_number`, `phonetic`, `vietnamese_meaning`, `example_en`, `example_vi`, `topic_id`, `audio_url`, `created_at`, `updated_at`). Bộ bốn `(word, cefr_level, part_of_speech, sense_number)` là duy nhất để phân tách cả các nghĩa khác nhau của cùng từ loại (như `rest`, `rock`).
- **Lesson (Bài học định lượng)**: Đơn vị bài học $15 - 18$ từ (`id`, `topic_id`, `cefr_level`, `title`, `order_index`, `word_count`, `created_at`).
- **LessonVocabulary (Liên kết Bài học - Từ vựng)**: Bảng quan hệ n-n (`id`, `lesson_id`, `vocabulary_id`, `order_in_lesson`).

---

## Success Criteria *(measurable outcomes)*

- **SC-001**: Toàn bộ $\ge 3.500$ bản ghi từ vựng (A1, A2, B1, B2) được nạp thành công vào PostgreSQL từ file Excel với **100% bản ghi có đầy đủ phiên âm IPA chuẩn `^/.+/$` và nghĩa tiếng Việt**, 0 bản ghi bị lỗi font chữ.
- **SC-002**: 100% các bài học được tạo ra có số lượng từ vựng nằm trong khoảng **15 đến 18 từ** (cho phép tối đa 20 từ duy nhất ở bài cuối cụm), không có bài học nào $< 15$ từ.
- **SC-003**: 0% bản ghi trong cột `word` chứa số chỉ mục (`1, 2`), dấu ngoặc đơn hoặc ký tự khoảng trắng không ngắt `\xa0`.
- **SC-004**: Thời gian thực thi script Seeder nạp toàn bộ $\ge 3.500$ từ vựng và sinh toàn bộ bài học hoàn tất trong **dưới 15 giây**. Quy trình đo lặp lại chuẩn: chạy trên máy phát triển cục bộ (tối thiểu 4 CPU cores, 8GB RAM, SSD; Node.js 22 LTS, PostgreSQL 16+ trong Docker), đo từ thời điểm bắt đầu đọc Excel đến lúc commit transaction toàn bộ bảng vào database trống sau migration.
- **SC-005**: 95% các API truy vấn danh sách bài học và chi tiết bài học (`GET /api/v1/lessons?level=A1` và `GET /api/v1/lessons/1`) có thời gian phản hồi (response time) **$< 50ms$**. Quy trình đo lặp lại chuẩn: đo bằng kịch bản benchmark (100 kết nối đồng thời, cỡ mẫu 1.000 requests, connection pool size: 10, đo trực tiếp trên DB có index, không dùng cache ứng dụng).
- **SC-006**: Chạy lại script Seeder lần 2 không làm tăng số dòng trong database và không gây ra lỗi trùng khóa chính (Duplicate Key).

---

## Assumptions

- Kho từ vựng Oxford 3000 được cố định trong giai đoạn v1 gồm 4 cấp độ (A1, A2, B1, B2); việc mở rộng lên C1, C2 sẽ được thực hiện ở các feature sau.
- Đường dẫn file âm thanh `audio_url` ở giai đoạn v1 trỏ tới kho lưu trữ tĩnh hoặc sử dụng Web Speech API / Google Cloud TTS tĩnh đã được batch sẵn.
- Người dùng không cần đăng nhập vẫn có thể xem danh mục bài học công khai (Public Read-only APIs), nhưng tiến độ học tập và ôn tập SM-2 sẽ gắn với tài khoản cá nhân ở gói tính năng tiếp theo (`002-backend-core`).
- Việc phân bổ bài học (15-18 từ) được thực hiện một lần lúc seed dữ liệu để đảm bảo tính nhất quán giữa tất cả người học.
