# Quickstart & Validation Guide: 002-backend-core

**Feature**: [spec.md](./spec.md) | **Data Model**: [data-model.md](./data-model.md) | **API Contract**: [contracts/openapi.yaml](./contracts/openapi.yaml)

Tài liệu hướng dẫn thiết lập hạ tầng (PostgreSQL + Redis), chạy migration nối tiếp từ `001-vocabulary-data` và kiểm chứng đầu-cuối toàn bộ luồng Auth, Học 2 bước, Chấm điểm thông minh, SM-2 / Leitner và Streak.

---

## 1. Điều kiện Tiên quyết

- **Feature `001-vocabulary-data` đã nạp sẵn**: Đã tồn tại các bảng `topics` (16 chủ đề), `vocabularies` ($\ge 3.500$ bản ghi), `lessons`, `lesson_vocabularies`.
- **Docker**: PostgreSQL 16+ (`pgvector/pgvector:pg16`, port `5432`) và **Redis 7+** (port `6379`) đang chạy.
- **Biến môi trường bổ sung trong `back-end/.env`** (chỉ ghi giá trị mẫu vào `back-end/.env.example`):
  ```env
  JWT_ACCESS_SECRET=replace_with_secure_random_secret
  JWT_ACCESS_EXPIRES_IN=900
  JWT_REFRESH_EXPIRES_DAYS=7
  GOOGLE_CLIENT_ID=your_google_oauth_client_id
  REDIS_HOST=localhost
  REDIS_PORT=6379
  AUTH_MAX_ATTEMPTS_PER_IP=20
  AUTH_MAX_ATTEMPTS_PER_ACCOUNT=5
  AUTH_LOCKOUT_SECONDS=900
  STRICT_UNLOCK_MODE=true
  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=587
  SMTP_USER=your_mailer@gmail.com
  SMTP_PASS=your_app_password
  ```

---

## 2. Chạy Migration & Test Thuật toán / Tích hợp

```bash
cd back-end
npm run typeorm:migration:run
npm test
npm run start:dev
```

---

## 3. Kịch bản Kiểm chứng Đầu-Cuối (E2E Smoke Flows)

### 3.1. Xác thực & Refresh Token Rotation (US1)
1. Gọi `POST /api/v1/auth/register` với email mới $\rightarrow$ Nhận `201`, có `accessToken`, `refreshToken`.
2. Gọi `POST /api/v1/auth/refresh` với `refreshToken` vừa nhận (`R1`) $\rightarrow$ Nhận `R2`.
3. Thử gọi lại `POST /api/v1/auth/refresh` với `R1` $\rightarrow$ Kỳ vọng `401 TOKEN_REUSE_DETECTED`, và toàn bộ Access Token cũ thuộc phiên đó bị chặn ngay khi gọi `GET /api/v1/users/me`.
4. Đăng nhập lại $\rightarrow$ Gọi `POST /api/v1/auth/change-password` $\rightarrow$ Kiểm tra tất cả phiên đang mở bị thu hồi tức thì.

### 3.2. Chu trình 2 bước & Cổng mở khóa $\ge 80\%$ (US2 & US3)
1. Gọi `GET /api/v1/learning/lessons?level=A1` $\rightarrow$ Xác nhận các bài `orderIndex = 1` có `isUnlocked: true`, bài `orderIndex >= 2` có `isUnlocked: false`.
2. Thử gọi thẳng `POST /api/v1/learning/lessons/1/practice/start` $\rightarrow$ Kỳ vọng `403 ACQUISITION_REQUIRED`.
3. Gọi lần lượt `POST /api/v1/learning/lessons/1/cards/:vocabId/open` cho toàn bộ từ của Bài 1 $\rightarrow$ Lượt cuối trả về `acquisitionCompleted: true`.
4. Bắt đầu làm bài (`POST /api/v1/learning/lessons/1/practice/start`), sau đó nộp qua `POST /api/v1/learning/quizzes/:attemptId/submit` với đáp án gồm câu Chính xác (`1,0`), Gần đúng sai 1 ký tự như `"peopel"` (`0,5`), và Đúng âm sai chữ ở Dictation như `"fone"` $\rightarrow$ Kiểm tra tổng điểm $\ge 80\%$, Bài 2 chuyển `isUnlocked: true`, và bảng `user_sm2_reviews` khởi tạo lịch ôn cho toàn bộ từ của Bài 1.

### 3.3. Ôn tập SM-2, 5 Hộp Leitner & Streak (US4 & US5)
1. Gọi `GET /api/v1/reviews/due?limit=20` $\rightarrow$ Kiểm tra danh sách thẻ đến hạn sắp xếp theo `leitnerBox ASC, nextReviewDate ASC`.
2. Gọi `GET /api/v1/stats/overview` $\rightarrow$ Kiểm tra `currentStreak`, `longestStreak`, phân bố 5 Hộp Leitner và biểu đồ 7 ngày theo `Asia/Ho_Chi_Minh` (`UTC+7`).
3. Đối chiếu SQL:
   ```sql
   SELECT COUNT(*) FROM user_sm2_reviews WHERE easiness_factor < 1.30; -- Kỳ vọng: 0
   SELECT user_id, study_date, streak_qualified, reminder_sent FROM daily_study_logs;
   ```
