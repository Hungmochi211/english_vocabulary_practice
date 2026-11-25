# Implementation Plan: Xác thực Người dùng, Động cơ Học tập Tương tác, Ôn tập Ngắt quãng SM-2 và Chuỗi Ngày học (Streak)

**Branch**: `002-backend-core` | **Date**: 2026-11-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-backend-core/spec.md`

---

## Summary

Gói tính năng này xây dựng toàn bộ **động cơ nghiệp vụ và thuật toán lõi** trong `back-end/` kế thừa trực tiếp từ nền móng dữ liệu `001-vocabulary-data`:
1. **Xác thực & Bảo mật Phiên (`Auth` & `Users`)**: Đăng ký/Đăng nhập Email (`bcrypt` salt $\ge 10$), Google OAuth 2.0 (từ chối email chưa xác thực), Access Token JWT (`15m`), Refresh Token Rotation (`7d`) kèm Reuse Detection theo `session_family_id`, đổi mật khẩu thu hồi mọi phiên trên mọi thiết bị (`token_version`), và giới hạn dò mật khẩu theo IP + tài khoản trên Redis.
2. **Chu trình Sư phạm 2 bước & Cổng Mở khóa (`Learning`)**: Mở sẵn Bài 1 (`order_index = 1`) từng chủ đề/cấp độ; theo dõi từng thẻ từ đã mở trong Bước 1 (Học nạp); chỉ cho phép làm Bước 2 (Học áp dụng) sau khi mở hết 100% thẻ; đạt $\ge 80,00\%$ mở khóa bài kế tiếp (hỗ trợ cờ `STRICT_UNLOCK_MODE=false` cho dev/test).
3. **Động cơ Sinh đề & Chấm điểm (`Algorithm`)**: Chọn 3 đáp án nhiễu theo 3 tầng ưu tiên + xáo trộn **Fisher-Yates**, lấy mẫu phân tầng **Stratified Sampling** cho bài kiểm tra tổng hợp, chấm điểm **Damerau-Levenshtein** (`0,5` điểm *"Gần đúng"* cho từ dài $\ge 3$ ký tự) và đối chiếu **Soundex / Double Metaphone** cho bài Nghe chép chính tả.
4. **Ôn tập Ngắt quãng & Hộp Leitner (`Review`)**: Tự động quy đổi độ chính xác + thời gian phản hồi (`response_time_ms`) sang $q \in \{0..5\}$, tính chuẩn **SuperMemo SM-2** ($EF_{min} = 1,30$), đồng bộ 5 Hộp Leitner và khóa hàng tuần tự (`SELECT ... FOR UPDATE`) chống race condition.
5. **Gamification, Streak & Tác vụ nền (`Gamification` & `Audit`)**: Ghi nhận `daily_study_logs` (`Asia/Ho_Chi_Minh`, `UTC+7`), cập nhật `user_streaks`, Cron **20:00** kết hợp **Redis + BullMQ** (so sánh-và-đặt nguyên tử `reminder_sent` chống gửi trùng) và ghi nhật ký kiểm toán `audit_logs`.

Chi tiết kỹ thuật: [research.md](./research.md) · Thiết kế bảng & DDL: [data-model.md](./data-model.md) · API Contract: [contracts/openapi.yaml](./contracts/openapi.yaml) · Hướng dẫn chạy & test: [quickstart.md](./quickstart.md).

---

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode) trên Node.js 22 LTS (NestJS Backend).

**Primary Dependencies**:
- Framework & DB: `@nestjs/core`, `@nestjs/common`, `@nestjs/typeorm`, `typeorm`, `pg`, `class-validator`, `class-transformer`
- Auth & Security: `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `google-auth-library`, `bcrypt`
- Queue, Cache & Cron: `@nestjs/bullmq`, `bullmq`, `ioredis`, `@nestjs/schedule`, `nodemailer`
- Testing: `jest`, `ts-jest`, `supertest`

**Storage**:
- Cơ sở dữ liệu chính: PostgreSQL 16+ (Docker image `pgvector/pgvector:pg16`, UTF-8, múi giờ `Asia/Ho_Chi_Minh` / `UTC+7`).
- Cache, Rate Limit & Queue Broker: Redis 7+ (Docker).

**Testing**:
- Unit Test (Jest) theo TDD Red $\rightarrow$ Green cho toàn bộ thuật toán thuần: Damerau-Levenshtein, Soundex/Double Metaphone, Distractor Selection, Fisher-Yates (kiểm định phân bố 1.000 lần), Stratified Sampling, quy đổi $q$ và công thức SM-2 + Leitner.
- Integration Test (Supertest + Test DB/Redis) bao phủ đủ toàn bộ kịch bản Given/When/Then từ `US1` đến `US5` (bao gồm concurrency SM-2 và idempotency nhắc Streak).

**Target Platform**: Linux Docker Container / Node.js 22 LTS Server + PostgreSQL 16+ + Redis 7+.

**Project Type**: Backend RESTful Web Service (nằm hoàn toàn trong `back-end/`, kế thừa `001-vocabulary-data`).

**Performance Goals**:
- 95% thao tác mở thẻ Học nạp, sinh đề bài tập 15–20 từ, chấm điểm nộp bài và lấy danh sách ôn tập SM-2 đạt **$p95 < 200ms$** trên cấu hình chuẩn (máy tối thiểu 4 CPU cores, 8GB RAM, SSD; PostgreSQL 16+ & Redis 7+ trong Docker; DB đã nạp $\ge 3.500$ từ từ `001`; tải 100 kết nối đồng thời, cỡ mẫu 1.000 requests) (`SC-006`).
- Cron quét 10.000 hồ sơ lúc 20:00 hoàn tất xếp hàng BullMQ trong **$< 30$ giây** (`SC-007`).

**Constraints**:
- Tuân thủ 6 Điều khoản trong Hiến pháp [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) (`v2.0.0`).
- Chỉ dùng `bcrypt` (salt rounds $\ge 10$); cấm tuyệt đối lưu mật khẩu hoặc token rõ vào log/DB.
- Không chặn luồng chính API bằng tác vụ gửi email; bắt buộc chạy bất đồng bộ qua Redis BullMQ.
- Mọi API dùng envelope `{ success: true, data, error: null }` và `{ success: false, data: null, error: { code, message, details } }`.

**Scale/Scope**:
- Phục vụ $\sim 10.000$ người học, $\sim 3.813$ từ vựng (từ `001`), trung bình $200+$ bài học lộ trình; thêm 9 bảng PostgreSQL mới kết nối với 4 bảng của `001`.

---

## Constitution Check

*GATE: Đánh giá cả trước Phase 0 và xác nhận lại sau Phase 1 design (`research.md`, `data-model.md`, `contracts/openapi.yaml`).*

| Điều khoản Hiến pháp | Đánh giá & Bằng chứng Tuân thủ (Pre & Post Design) | Kết quả |
| :--- | :--- | :---: |
| **I. Quy tắc & Dữ liệu từ Spec** | Toàn bộ ngưỡng (`80%`, `0.5` điểm, `5.000ms` / `12.000ms`, $EF_{min}=1.30$, `15m`/`7d`, `20:00 UTC+7`, $\ge 10$ từ SM-2) bám sát 100% `spec.md` đã giải quyết hết `[NEEDS CLARIFICATION]`. Không sửa đổi kho từ gốc `001`. | ✅ **PASS** |
| **II. Chuẩn mực Sư phạm & Thuật toán** | `data-model.md` và `research.md` cài đặt đúng chu trình 2 bước (`opened_vocabulary_ids` $\rightarrow$ `acquisition_completed`), khóa bài $\ge 80\%$, công thức SM-2 chuẩn ($EF_{min}=1.30$, làm tròn 2 chữ số thập phân), đồng bộ 1-1 5 Hộp Leitner (`CHECK` DB), Damerau-Levenshtein $\le 1$ trên từ $\ge 3$ ký tự, Soundex/Double Metaphone, Distractor Clustering & Fisher-Yates. | ✅ **PASS** |
| **III. Test trước (Given/When/Then - TDD)** | `research.md` R6 tách các thuật toán thành module thuần không phụ thuộc framework để viết Unit Test TDD trước; mọi kịch bản `US1`–`US5` (kể cả concurrency `US4-AS7` và chống gửi trùng `US5-AS5`) đều có kế hoạch Integration Test tương ứng trong pha `tasks`. | ✅ **PASS** |
| **IV. Hợp đồng API & Kiến trúc** | Có đầy đủ `contracts/openapi.yaml` trước khi code; dùng đúng NestJS + TypeORM + PostgreSQL 16+ (`UTF-8`, `UTC+7`) + Redis + BullMQ; JWT + Google OAuth 2.0 + `bcrypt` ($\ge 10$ rounds). Tác vụ email 20:00 chạy nền qua BullMQ + `@Cron('0 20 * * *')`. Không đụng phạm vi Chatbot AI (`003`). | ✅ **PASS** |
| **V. Bảo mật & Đơn giản trước** | Secret/JWT/Google/SMTP chỉ đọc từ `.env` (`.gitignore` đã chặn commit); DTO validate toàn bộ đầu vào (như `0 <= responseTimeMs <= 300000`, `1 <= limit <= 50`). Thuật toán xâu ký tự/âm vị tự viết gọn (~80 dòng TypeScript) thay vì kéo thư viện NLP nặng. Ghi `audit_logs` không chứa bí mật rõ. | ✅ **PASS** |
| **VI. Cộng tác & Quản lý Task** | Toàn bộ mã nguồn quy hoạch sạch trong `back-end/src/modules/{auth,users,learning,algorithm,review,gamification,audit}/`, tách biệt hoàn toàn với `font-end/` và `tools/`. | ✅ **PASS** |

**Post-Design Gate Result**: ✅ **PASS** — Thiết kế `research.md`, `data-model.md` và `contracts/openapi.yaml` tuân thủ 100% Hiến pháp `v2.0.0`, sẵn sàng chuyển sang **`/speckit-tasks`**.

---

## Project Structure

### Documentation (this feature)

```text
specs/002-backend-core/
├── spec.md              # Đặc tả 5 User Stories, 29+ kịch bản Given/When/Then, FR-001..014
├── plan.md              # Bản kế hoạch kỹ thuật & Constitution Check (File này)
├── research.md          # Quyết định kỹ thuật R1–R6 (Token rotation, Damerau, SM-2 lock, BullMQ)
├── data-model.md        # Thiết kế 9 bảng PostgreSQL mới & DDL Migration Script
├── quickstart.md        # Hướng dẫn cấu hình Redis/Postgres và kịch bản kiểm chứng E2E
├── contracts/
│   └── openapi.yaml     # Đặc tả OpenAPI 3.0.3 cho toàn bộ API Auth, Learning, Review, Stats
└── checklists/
    └── requirements.md  # Checklist kiểm định chất lượng spec (16/16 ĐẠT)
```

### Source Code (repository root)

```text
back-end/
├── src/
│   ├── common/
│   │   ├── decorators/          # @CurrentUser(), @Roles()
│   │   ├── guards/              # JwtAuthGuard, RolesGuard
│   │   └── utils/               # timezone.util.ts (Asia/Ho_Chi_Minh UTC+7)
│   ├── config/
│   │   ├── redis.config.ts      # Cấu hình ioredis & BullMQ
│   │   └── auth.config.ts       # JWT, Google OAuth, Brute-force thresholds
│   ├── database/
│   │   └── migrations/
│   │       ├── 1700000000002-CreateCoreLearningTables.ts
│   │       └── 1700000000003-CreateUserSyncAndSupportTables.ts
│   └── modules/
│       ├── auth/                # AuthController, AuthService, JwtStrategy, RateLimiterService (+ OTP Password Reset)
│       ├── users/               # UsersController, UsersService, User & RefreshSession entities
│       ├── algorithm/           # Pure TS services: distractor, fisher-yates, stratified-sampling,
│       │                        # damerau-levenshtein, phonetic (Soundex + Double Metaphone), sm2-leitner
│       ├── learning/            # LearningController (+ GET /learning/history), LearningService, QuizGradingService,
│       │                        # UserLessonProgress, QuizAttempt, QuizAttemptAnswer entities
│       ├── vocabulary/          # + SavedWordsController & SavedWordsService (/vocabularies/saved)
│       ├── notifications/       # NotificationsController, NotificationsService, UserNotification entity
│       ├── support/             # SupportController, AdminSupportController, SupportService, SupportMessage & SupportTicket entities
│       ├── review/              # ReviewController, ReviewService, UserSm2Review entity
│       ├── gamification/        # StatsController, StreakService, StreakReminderCron, EmailQueueProcessor,
│       │                        # UserStreak, DailyStudyLog entities
│       └── audit/               # AuditService, AuditLog entity
└── tests/
    ├── unit/                    # Unit tests thuần cho toàn bộ thư mục algorithm/ & streak logic
    └── integration/             # Supertest E2E tests cho Auth, Learning 2-step, SM-2 concurrency, Streak Cron
```

**Structure Decision**: Dùng cấu trúc **Web Application Backend (`back-end/`)** theo đúng Hiến pháp Điều VI, tổ chức module hóa theo từng miền nghiệp vụ NestJS và tách riêng module thuần `algorithm/` để viết Unit Test độc lập theo chuẩn TDD trước khi ghép vào API.

---

## Complexity Tracking

*Không có vi phạm Hiến pháp cần giải trình. Redis + BullMQ là thành phần bắt buộc trực tiếp của Hiến pháp Điều IV cho tác vụ nền nhắc Streak 20:00 và được tái sử dụng luôn cho `token_version` / rate-limit login.*
