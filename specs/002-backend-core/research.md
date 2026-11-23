# Technical Research & Decisions: 002-backend-core

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Branch**: `002-backend-core`

Tài liệu này tổng hợp các quyết định kỹ thuật, phân tích phương án thay thế và lý do lựa chọn cho toàn bộ phân hệ lõi Backend (`Auth`, `Learning Flow`, `Algorithms`, `SM-2`, `Streak & Background Jobs`).

---

## R1: Bảo mật Xác thực, Refresh Token Rotation, Thu hồi Access Token & Chống dò mật khẩu

### Quyết định
1. **Access Token (JWT HS256, TTL `15m`) + Refresh Token (Opaque random 32-byte hex, TTL `7d`, lưu bản băm SHA-256)**:
   - Mỗi phiên đăng nhập gắn một `session_family_id` (UUID).
   - Mỗi lần làm mới phiên (`POST /api/v1/auth/refresh`), hệ thống kiểm tra `token_hash` trong PostgreSQL trong transaction:
     - Nếu `is_revoked = true` hoặc `replaced_by_hash IS NOT NULL` (tức mã cũ đã xoay vòng bị dùng lại — **Token Reuse Detection**): hệ thống **thu hồi toàn bộ `refresh_sessions` có cùng `session_family_id`** VÀ đánh dấu `session_family_id` vào Redis blacklist (`revoked_family:<id>`, TTL `900s` bằng tuổi thọ tối đa của Access Token) để vô hiệu hóa ngay lập tức các Access Token thuộc chuỗi phiên đó (`FR-003`, `US1-AS7`).
2. **Đăng xuất (`POST /api/v1/auth/logout`) vs Đổi mật khẩu (`POST /api/v1/auth/change-password`)**:
   - **Đăng xuất**: chỉ đặt `is_revoked = true, revoked_at = NOW()` cho phiên Refresh Token hiện tại; **không** đưa Access Token vào blacklist nên Access Token đã cấp hết hạn tự nhiên tối đa 15 phút (`US1-AS6`).
   - **Đổi mật khẩu**: tăng `users.token_version = token_version + 1`, đồng bộ cache `user_token_version:<userId>` vào Redis (TTL `900s`), và thu hồi tất cả `refresh_sessions` chưa hết hạn của người dùng. JwtStrategy so sánh `payload.tokenVersion === currentTokenVersion` để chặn ngay lập tức mọi Access Token cũ trên mọi thiết bị (`US1-AS8`, `FR-003`).
3. **Google OAuth 2.0**:
   - Xác thực Google ID Token / OAuth2 profile; bắt buộc kiểm tra `email_verified === true`. Nếu `false`, từ chối ngay (`401 EMAIL_NOT_VERIFIED`). Nếu `true`, chuẩn hóa email chữ thường và liên kết vào tài khoản hiện có hoặc tạo mới tài khoản vai trò `learner` (`US1-AS4`).
4. **Chống dò mật khẩu (Brute-Force Protection)**:
   - Sử dụng Redis sliding/fixed window counter theo 2 khóa độc lập: `login_fail:ip:<ip>` và `login_fail:acct:<normalized_email>`, với ngưỡng & thời gian khóa cấu hình qua `.env` (`AUTH_MAX_ATTEMPTS_PER_IP`, `AUTH_MAX_ATTEMPTS_PER_ACCOUNT`, `AUTH_LOCKOUT_SECONDS`). Phản hồi luôn dùng thông báo chung, không tiết lộ tài khoản có tồn tại hay không (`FR-002`, `US1-AS3`).

### Phương án đã cân nhắc & Lý do loại bỏ
- *Lưu toàn bộ JWT Access Token vào PostgreSQL để kiểm tra mỗi request*: Gây áp lực I/O DB trên mọi API request. Chỉ kiểm tra `token_version` / `revoked_family` qua Redis bộ nhớ RAM giữ tốc độ `< 2ms` mà vẫn đáp ứng thu hồi tức thì khi đổi mật khẩu hoặc phát hiện tái sử dụng token.

---

## R2: Chu trình Học 2 bước (Acquisition $\rightarrow$ Application) & Cổng mở khóa $\ge 80\%$

### Quyết định
1. **Theo dõi từng thẻ đã mở trong Bước 1 (`user_lesson_progress`)**:
   - Lưu danh sách `opened_vocabulary_ids` (`INT[]` trên PostgreSQL) trong bảng `user_lesson_progress` theo cặp duy nhất `(user_id, lesson_id)`.
   - Khi người học gọi `POST /api/v1/lessons/:id/cards/:vocabularyId/open`: dùng cập nhật nguyên tử thêm `vocabularyId` (chỉ khi thuộc bài học `:id`) vào `opened_vocabulary_ids` (không trùng lặp). Khi số phần tử bằng `lesson.word_count`, tự động đặt `acquisition_completed = true`.
   - Khởi tạo hoặc nộp bài tập thực hành (`POST /api/v1/lessons/:id/practice/start`) bắt buộc kiểm tra `acquisition_completed === true`; nếu chưa, trả về `403 ACQUISITION_REQUIRED` (`FR-004`, `US2-AS2`).
2. **Mở khóa tuần tự theo `(cefr_level, topic_id)`**:
   - Mọi bài học có `order_index = 1` mặc định được coi là **đã mở khóa** với mọi học viên (`FR-005`, `US2-AS1`).
   - Bài học `order_index = k` ($k \ge 2$) chỉ mở khóa khi bản ghi `user_lesson_progress` của bài `k - 1` (cùng `cefr_level`, `topic_id`) có `is_completed = true`.
   - Cờ môi trường `STRICT_UNLOCK_MODE` (mặc định `true`; đặt `false` trong môi trường dev/test) cho phép bỏ qua kiểm tra mở khóa để test độc lập (`US2-AS6`).
   - Nếu người học làm lại bài đã `is_completed = true` với điểm mới $< 80\%$: cập nhật `attempts_count`, không hạ `is_completed` xuống `false` và giữ nguyên `best_score = GREATEST(best_score, new_score)` (`Edge Case 7`).
3. **Liên kết dữ liệu với `001-vocabulary-data` và `schema_postgresql_v3.sql`**:
   - Bộ spec `002-backend-core` tham chiếu trực tiếp tới bảng `lessons(id)` và `lesson_vocabularies` đã thiết kế ở `001-vocabulary-data/data-model.md` để đồng bộ xuyên suốt giữa hai gói spec. *(Ghi chú tương thích: trong file `schema_postgresql_v3.sql` tổng hợp của nhóm, các bài học lộ trình được gộp chung vào bảng `decks` với `deck_type = 'system_lesson'`; khi hợp nhất code migration toàn hệ thống có thể giữ `lessons` riêng theo Spec 001–002 cho gọn YAGNI hoặc view/alias tương ứng).*

---

## R3: Thuật toán Sinh bài tập & Chấm điểm Thông minh

### Quyết định
1. **Sinh câu hỏi Trắc nghiệm (`Distractor Selection` + `Fisher-Yates Shuffle`)**:
   - Truy vấn ứng viên nhiễu không trùng `word` và không trùng `vietnamese_meaning` với từ gốc theo thứ tự 3 tầng ưu tiên (`FR-006`):
     - Tầng 1: cùng `cefr_level` + cùng `topic_id` + cùng `part_of_speech`.
     - Tầng 2 (nếu tầng 1 $< 3$ từ): cùng `cefr_level` + cùng `part_of_speech` ở chủ đề khác.
     - Tầng 3 (nếu tầng 2 vẫn $< 3$ từ): cùng `part_of_speech` trên toàn kho từ.
   - Lấy tối đa 50 ứng viên, chọn ngẫu nhiên 3 đáp án khác nghĩa tiếng Việt nhau, rồi trộn `[đáp_án_đúng, nhiễu_1, nhiễu_2, nhiễu_3]` bằng thuật toán **Fisher-Yates Shuffle** (độ phức tạp $O(n)$, phân bổ xác suất $25\%$ đồng đều tuyệt đối cho 4 vị trí).
2. **Lấy mẫu phân tầng (`Stratified Sampling`) cho Kiểm tra tổng hợp**:
   - Xác định tập các `topic_id` mà người học đã từng học/hoàn thành ít nhất 1 bài.
   - Chia đều `N` câu hỏi yêu cầu cho $T$ chủ đề ($\lfloor N / T \rfloor$ câu/chủ đề, phần dư $N \bmod T$ phân bổ 1 câu cho $N \bmod T$ chủ đề đầu theo thứ tự ngẫu nhiên), sau đó rút ngẫu nhiên trong từng tầng bằng Fisher-Yates (`US3-AS6`).
3. **Chuẩn hóa chuỗi & Khoảng cách `Damerau-Levenshtein`**:
   - Chuẩn hóa đầu vào: `input.trim().replace(/\s+/g, ' ').toLowerCase()`.
   - Cài đặt thuật toán **Damerau-Levenshtein** (Optimal String Alignment) xử lý 4 phép biến đổi chi phí `1`: chèn, xóa, thay thế, và **hoán vị 2 ký tự liền kề** (ví dụ `peopel` $\leftrightarrow$ `people` có khoảng cách $= 1$).
   - Chỉ áp dụng nhãn `near_match` (`0,5` điểm) khi `targetWord.length >= 3` và `distance === 1` (`FR-007`, `US3-AS5`).
4. **Đối chiếu âm vị học (`Soundex` + `Double Metaphone`)**:
   - Dùng bộ mã hóa **Soundex** kết hợp **Double Metaphone** (hỗ trợ cả tiếng Anh hiện đại như `ph` $\leftrightarrow$ `f`, `gh` câm trong `night` $\leftrightarrow$ `nite`, `wr` $\leftrightarrow$ `r` trong `write` $\leftrightarrow$ `rite` — những trường hợp mà Soundex thuần đôi khi bỏ sót như `fone`/`phone` nếu chỉ xét chữ cái đầu `f` vs `p`!).
   - Chỉ kiểm tra âm vị học ở chế độ `dictation_listening` khi `distance >= 2` (`FR-007`, `US3-AS4`).
5. **Chống gian lận phía client (`questions_snapshot`)**:
   - Khi bắt đầu phiên bài tập, toàn bộ danh sách câu hỏi (`vocabularyId`, `practiceMode`, `prompt`, `options`) được lưu vào `quiz_attempts.questions_snapshot` (`JSONB`) và chỉ trả cho client phần hiển thị (ẩn đáp án). Khi nộp bài, backend chấm điểm hoàn toàn trên server dựa trên snapshot đã lưu.

---

## R4: SuperMemo SM-2, 5 Hộp Leitner & Xử lý Đồng thời (Concurrency)

### Quyết định
1. **Quy đổi tự động điểm nhớ $q \in \{0..5\}$ (`FR-008`)**:
   - Validate `0 <= response_time_ms <= 300000` (nếu client gửi vượt hoặc âm, từ chối `400 VALIDATION_ERROR`).
   - Ánh xạ thuần xác định (`grading_status` + `response_time_ms` $\rightarrow$ $q$):
     - Bỏ trống / hết giờ $\Rightarrow q = 0$
     - `incorrect` $\Rightarrow q = 1$
     - `phonetic_match` $\Rightarrow q = 2$
     - `near_match` HOẶC (`exact` với `response_time_ms > 12000`) $\Rightarrow q = 3$
     - `exact` với `5000 < response_time_ms <= 12000` $\Rightarrow q = 4$
     - `exact` với `response_time_ms <= 5000` $\Rightarrow q = 5$
2. **Tính toán chính xác SM-2 & Làm tròn số thập phân (`FR-009`)**:
   - Tránh sai số dấu phẩy động IEEE 754 bằng nhân nguyên `Math.round(val * 100) / 100` (làm tròn `easiness_factor` chính xác 2 chữ số thập phân, chặn sàn `1.30`; `interval_days` khi $n' \ge 3$ dùng `Math.round(I * EF')` half-up).
   - Ánh xạ 1-1 `repetitions` $\rightarrow$ `leitner_box` (`FR-010`): `0 -> 1`, `1 -> 2`, `2 -> 3`, `3..4 -> 4`, `>= 5 -> 5`.
3. **Tuần tự hóa cập nhật đồng thời (`US4-AS7`, `FR-009`)**:
   - Trong transaction nộp bài hoặc ôn tập, sắp xếp danh sách `(vocabulary_id)` tăng dần (tránh deadlock), rồi thực thi `INSERT ... ON CONFLICT (user_id, vocabulary_id) DO NOTHING` trước (khởi tạo nếu chưa có), sau đó khóa hàng bằng **`SELECT ... FROM user_sm2_reviews WHERE user_id = $1 AND vocabulary_id = $2 FOR UPDATE`** theo đúng thứ tự nhận để áp dụng công thức SM-2 tuần tự từng kết quả một (`US4-AS7`).

---

## R5: Streak (`UTC+7`), Cron 20:00 & BullMQ Chống gửi trùng

### Quyết định
1. **Chuẩn hóa ngày học `Asia/Ho_Chi_Minh` (`UTC+7`)**:
   - Mọi truy vấn tính `today` / `yesterday` cho Streak và `next_review_date` đều chuyển `NOW()` sang múi giờ `Asia/Ho_Chi_Minh` ở tầng application (`Intl.DateTimeFormat` hoặc `date-fns-tz` / SQL `AT TIME ZONE 'Asia/Ho_Chi_Minh'`).
2. **Cập nhật Streak trong cùng Transaction (`FR-012`)**:
   - Điều kiện đạt mục tiêu ngày (`streak_qualified`):
     - Hoàn tất `>= 1` bài tập thực hành bài học (`lesson_practice`), HOẶC
     - Hoàn tất `1` phiên ôn tập SM-2 (`sm2_review`) có số câu đã nộp $\ge \min(10, \text{total\_due\_before\_session})$ (với $\text{total\_due\_before\_session} \ge 1$).
   - Khi lần đầu trong ngày `D` thỏa mãn điều kiện trên:
     - Khóa hàng `user_streaks` bằng `FOR UPDATE`.
     - Nếu `last_study_date === yesterday`: `current_streak += 1`, `longest_streak = Math.max(longest_streak, current_streak)`.
     - Nếu `last_study_date === null` hoặc `last_study_date < yesterday`: `current_streak = 1`, `longest_streak = Math.max(longest_streak, 1)`.
     - Nếu `last_study_date === today`: không cộng trùng.
   - Khi đọc `GET /api/v1/stats/overview`: nếu `last_study_date !== null && last_study_date < yesterday`, tính hiển thị `effective_current_streak = 0` (`Edge Case 2`).
3. **Cron Job 20:00 + BullMQ (`FR-013`)**:
   - Dùng `@nestjs/schedule` (`@Cron('0 20 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })`) quét phân lô (`batch 500`) các user có `email_reminder_enabled = true`, `user_streaks.current_streak >= 1`, `last_study_date = yesterday`.
   - Trước khi đẩy job vào Redis **BullMQ**, thực thi **Compare-and-Set nguyên tử** trên `daily_study_logs`:
     ```sql
     INSERT INTO daily_study_logs (user_id, study_date, reminder_sent, reminder_sent_at)
     VALUES ($1, $2, TRUE, NOW())
     ON CONFLICT (user_id, study_date)
     DO UPDATE SET reminder_sent = TRUE, reminder_sent_at = NOW()
     WHERE daily_study_logs.reminder_sent = FALSE
     RETURNING id;
     ```
   - Chỉ khi câu lệnh trả về 1 dòng mới enqueue BullMQ job với `jobId: streak-warn:${userId}:${studyDate}`, cấu hình `attempts: 3, backoff: { type: 'exponential', delay: 5000 }` (`US5-AS5`, `Edge Case 9`).

---

## R6: Các thư viện bổ sung (Soát theo Hiến pháp Điều V - Đơn giản trước)

| Thư viện | Mục đích | Lý do chọn thay vì tự viết / dùng thư viện nặng |
| :--- | :--- | :--- |
| `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt` | Xác thực JWT & Guard phân quyền | Chuẩn chính thức của NestJS, tích hợp sạch với Guards & Decorators |
| `google-auth-library` (hoặc `passport-google-oauth20`) | Xác thực Google OAuth ID Token / OAuth2 | `google-auth-library` kiểm tra chữ ký & `email_verified` cực gọn, ít phụ thuộc hơn cấu hình Passport session |
| `bcrypt` | Băm mật khẩu (`salt rounds >= 10`) | Bắt buộc theo Hiến pháp Điều IV |
| `@nestjs/bullmq`, `bullmq`, `ioredis` | Hàng đợi email nhắc Streak & Redis rate-limit | Bắt buộc theo Hiến pháp Điều IV (tác vụ nền tách khỏi luồng chính) |
| `@nestjs/schedule` | Cron 20:00 múi giờ `Asia/Ho_Chi_Minh` | Module chính chủ NestJS, hỗ trợ `timeZone` chuẩn IANA |
| `nodemailer` | Gửi email qua Gmail SMTP / Resend SMTP | Nhẹ, dễ đổi nhà cung cấp qua `.env`, dễ mock trong Integration Test |
| Thuật toán Soundex / Double Metaphone / Damerau-Levenshtein | Chấm điểm chính tả & âm vị học | Tự cài đặt thuần TypeScript (~80 dòng tổng cộng, có unit test 100%) — không cần kéo cả gói NLP `natural` nặng hàng MB |
