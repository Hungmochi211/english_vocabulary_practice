---
description: "Task list for feature 001-vocabulary-data"
---

# Tasks: Chuẩn hóa, Quản lý kho từ vựng Oxford 3000 và Cơ sở dữ liệu Bài học

**Input**: Design documents from `/specs/001-vocabulary-data/` (`spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/openapi.yaml`, `quickstart.md`)

**Prerequisites**: Docker + PostgreSQL 16+ (`pgvector/pgvector:pg16`), Node.js 22 LTS, `tools/oxford_3000_vocabulary.xlsx`

**Test-Driven Development (TDD)**: BẮT BUỘC theo Hiến pháp Điều III. Mọi tác vụ kiểm thử (Unit / Integration Test) MUST được viết trước và chạy ĐỎ (Red) trước khi thực hiện tác vụ viết mã nguồn (Green). Mỗi kịch bản Given/When/Then trong `spec.md` (tổng cộng 14 kịch bản) đều có đúng một test case tự động tương ứng với định danh `USx-ASy`.

**Format**: `[ID] [P?] [Story] Description`
- **[P]**: Chạy song song được (khác file, không phụ thuộc task chưa xong).
- **[Story]**: Story mà task thuộc về (`[US1]`, `[US2]`, `[US3]`, `[US4]`).

---

## Phase 1: Setup & Shared Infrastructure

**Purpose**: Khởi tạo cấu trúc dự án NestJS Backend và cấu hình kết nối cơ sở dữ liệu PostgreSQL 16+ (`pgvector` Docker).

- [ ] T001 Khởi tạo dự án NestJS tại thư mục `back-end/` (nếu chưa có): cài đặt `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`, `reflect-metadata`, `rxjs`, `typescript`
- [ ] T002 [P] Cài đặt dependencies cơ sở dữ liệu & validation: `@nestjs/typeorm`, `typeorm`, `pg`, `class-validator`, `class-transformer`
- [ ] T003 [P] Cài đặt dependencies đọc file Excel: `exceljs`
- [ ] T004 [P] Tạo file `back-end/.env.example` và `back-end/.env`: cấu hình `DB_HOST`, `DB_PORT=5432`, `DB_USERNAME=postgres`, `DB_PASSWORD`, `DB_DATABASE=english_vocab_db`, `PORT=3000`
- [ ] T005 [P] Cấu hình TypeORM DataSource và database configuration trong `back-end/src/config/database.config.ts`: thiết lập `type: 'postgres'`, múi giờ `Asia/Ho_Chi_Minh` (`+07:00`), tự động load entities

---

## Phase 2: Foundational (Database Entities, Migrations & Global Envelope)

**Purpose**: Xây dựng toàn bộ mô hình bảng dữ liệu quan hệ PostgreSQL theo đúng `data-model.md` và chuẩn hóa vỏ bọc API.

- [ ] T006 [P] Tạo Entity `Topic` trong `back-end/src/modules/vocabulary/entities/topic.entity.ts`: các cột `id`, `code` (unique), `name`, `name_vi`, `description`, `createdAt`; quan hệ 1-n tới `Lesson` và `Vocabulary` (data-model 1.1)
- [ ] T007 [P] Tạo Entity `Vocabulary` trong `back-end/src/modules/vocabulary/entities/vocabulary.entity.ts`: các cột `id`, `word`, `cefrLevel` (enum A1-B2), `partOfSpeech` (14 nhãn chuẩn từ Excel), `senseNumber` (smallint, default 1), `phonetic`, `vietnameseMeaning` (varchar 255), `exampleEn`, `exampleVi`, `topicId`, `audioUrl` (varchar 500, nullable), `createdAt`, `updatedAt`; composite unique key `(word, cefrLevel, partOfSpeech, senseNumber)`; index `(LOWER(word) text_pattern_ops)` và index `(cefrLevel, partOfSpeech, topicId)` (data-model 1.2, FR-001, FR-003, FR-013)
- [ ] T008 [P] Tạo Entity `Lesson` trong `back-end/src/modules/vocabulary/entities/lesson.entity.ts`: các cột `id`, `topicId`, `cefrLevel`, `title`, `orderIndex`, `wordCount`, `createdAt`; index `(cefrLevel, topicId)` (data-model 1.3, FR-006, FR-007)
- [ ] T009 [P] Tạo Entity `LessonVocabulary` trong `back-end/src/modules/vocabulary/entities/lesson-vocabulary.entity.ts`: các cột `id`, `lessonId`, `vocabularyId`, `orderInLesson`; unique `(lessonId, vocabularyId)`, unique `(lessonId, orderInLesson)` (data-model 1.4)
- [ ] T010 Viết file TypeORM Migration `back-end/src/database/migrations/1700000000001-CreateVocabularyCoreTables.ts` chứa trọn vẹn 4 bảng theo script DDL trong `data-model.md`
- [ ] T011 Chạy migration và kiểm tra extension `vector` (`pgvector`) cùng 4 bảng được tạo thành công trong PostgreSQL (`UTF-8`) (FR-015)
- [ ] T012 [P] Tạo chuẩn response interceptor & exception filter trong `back-end/src/common/`:
  - `transform-response.interceptor.ts`: bọc kết quả thành công ($2xx$) dạng `{ success: true, data: ..., error: null }` (FR-014)
  - `http-exception.filter.ts`: bọc lỗi thất bại ($4xx, 5xx$) dạng `{ success: false, data: null, error: { code: string, message: string, details: any | null } }` (FR-014, I8). Đảm bảo `details` là `null` đối với lỗi thông thường, và là mảng lỗi chi tiết đối với mã `VALIDATION_ERROR` (400)

---

## Phase 3: User Story 1 - Nạp Dữ liệu từ Excel & Chia Bài học (Priority: P1)

**Purpose**: Cài đặt thuật toán phân bổ nghiệm nguyên và script Seeder nạp dữ liệu Idempotent theo chu trình TDD (Red $\rightarrow$ Green).

- [ ] T013 [US1] [P] **(TDD Red)** Viết Unit Test cho thuật toán phân bổ bài học trong `back-end/tests/unit/chunking.util.test.ts`:
  - `US1-AS3: Test với 34 từ vựng -> tạo 2 bài học (17, 17 từ)`
  - `US1-AS4: Test với 19 từ vựng -> tạo 1 bài học (19 từ)`
  - `Test với 37 từ vựng -> tạo 2 bài học (18, 19 từ, bài 19 từ nằm ở cuối nhóm)`
  - `Test với 48 từ vựng -> tạo 3 bài học (16, 16, 16 từ)`
  - `Test với 92 từ vựng -> tạo 5 bài học (18, 18, 18, 18, 20 từ - bài 20 từ ở cuối nhóm)`
  - `Test với 124 từ vựng -> tạo 7 bài học (17, 17, 18, 18, 18, 18, 18 từ - ưu tiên k nhỏ nhất)`
  - `Test với 14 từ vựng (< 15 từ) -> trả về isValid: false, 0 bài học và cảnh báo SEED_WARNING`
  - `Test với 25 từ vựng (khoảng không hợp lệ 21-29) -> trả về isValid: false, 0 bài học và cảnh báo SEED_WARNING`
  - `Test với 42 từ vựng (khoảng không hợp lệ 41-44) -> trả về isValid: false, 0 bài học và cảnh báo SEED_WARNING`
  - Chạy `npm test back-end/tests/unit/chunking.util.test.ts` xác nhận test ĐỎ (Red) do chưa cài đặt hàm
- [ ] T014 [US1] **(TDD Green)** Cài đặt thuật toán tìm nghiệm nguyên phân hoạch trong `back-end/src/database/seeds/chunking.util.ts`: hàm `calculateLessonPartition(n, cefrLevel, topicCode)` và `chunkVocabulariesIntoLessons(words, cefrLevel, topicCode)` theo đúng mã nguồn TypeScript trong Research R3. Chạy test T013 xác nhận XANH (Green).
- [ ] T015 [US1] [P] **(TDD Red)** Viết Integration Test cho Seeder trong `back-end/tests/integration/seeder.test.ts`:
  - `US1-AS1: Test Seeder nạp database trống -> nạp đủ 16 chủ đề, tổng từ vựng >= 3.500 dòng; kiểm tra 100% các bài trước bài cuối có 15-18 từ, bài cuối cùng mỗi nhóm có 15-20 từ; 0 bài học nào < 15 từ` (I7)
  - `US1-AS2: Test Chạy Seeder lần thứ 2 -> tổng số dòng không thay đổi, không sinh duplicate key, dữ liệu idempotent`
  - `US1-AS5: Test kiểm tra dữ liệu từ vựng nạp vào -> 100% cột word sạch (không chứa số, ngoặc đơn, \xa0), 100% phonetic định dạng ^/.+/$ không chứa *`
  - `Test Transaction Rollback: Giả lập lỗi chèn dữ liệu giữa chừng -> xác nhận toàn bộ transaction bị rollback sạch sẽ, 0 để lại dữ liệu dở dang` (G2)
- [ ] T016 [US1] Viết seeder nạp 16 chủ đề chuẩn hóa trong `back-end/src/database/seeds/topic.seeder.ts`: nạp đủ 16 chủ đề song ngữ theo FR-005 (8 chủ đề A1–B1 và 8 chủ đề B2), cơ chế Idempotent không chèn trùng `code`
- [ ] T017 [US1] **(TDD Green)** Viết seeder nạp từ vựng và bài học trong `back-end/src/database/seeds/vocabulary.seeder.ts`:
  - Đọc 4 sheets `A1`, `A2`, `B1`, `B2` từ `../tools/oxford_3000_vocabulary.xlsx`
  - Sanitize dữ liệu: xóa số chỉ mục, ngoặc đơn ngữ cảnh, chuyển `\xa0` thành `\x20`, validate regex `^/.+/$`, gán `sense_number` tuần tự (`1, 2...`) cho các nghĩa trùng `(word, cefrLevel, partOfSpeech)`
  - Bọc trong Database Transaction: Batch insert vào bảng `vocabularies` (100 dòng/lô) với cơ chế `UPSERT` theo khóa `(word, cefrLevel, partOfSpeech, senseNumber)`
  - Khi chia bài học: xóa sạch `lesson_vocabularies` và `lessons` cũ của `(topicId, cefrLevel)` trước khi tạo mới để đảm bảo Idempotency (Research R5)
  - Áp dụng `chunkVocabulariesIntoLessons`: nếu nhóm không thể phân hoạch thì ghi log `[SEED_WARNING]` và giữ từ trong kho mà không tạo bài
- [ ] T018 [US1] Tạo script chạy CLI trong `back-end/package.json`: `"seed:vocab": "ts-node src/database/seeds/run-seed.ts"`. Chạy test T015 xác nhận XANH (Green).

---

## Phase 4: User Story 2 & 3 - RESTful API Danh mục Bài học & Học nạp Flashcard (Priority: P1)

**Purpose**: Xây dựng các API phục vụ truy vấn Lộ trình học và Thẻ từ vựng Flashcard theo chu trình TDD.

- [ ] T019 [US2] [P] **(TDD Red)** Viết Integration Test cho API danh mục bài học và chủ đề trong `back-end/tests/integration/lessons-list.test.ts`:
  - `Test GET /api/v1/topics: trả về 16 chủ đề chuẩn kèm totalLessons` (G2)
  - `US2-AS1: Gửi GET /api/v1/lessons?level=A1 -> trả về danh sách bài học thuộc A1`
  - `US2-AS2: Gửi GET /api/v1/lessons?level=B1&topicId=2 -> chỉ trả về bài học thuộc B1 và topicId=2`
  - `US2-AS3: Kiểm tra payload bài học có đủ title, wordCount (15-20), cefrLevel, orderIndex`
  - `Test Validation Error: Gửi GET /api/v1/lessons?level=INVALID hoặc topicId=-5 -> trả về mã 400 Bad Request với code: 'VALIDATION_ERROR' và details chứa danh sách lỗi cụ thể` (G2, I8)
  - Chạy test xác nhận ĐỎ (Red)
- [ ] T020 [US2] Tạo DTO xác thực query params `back-end/src/modules/vocabulary/dto/query-lessons.dto.ts`: trường `level` (optional, enum A1-B2), `topicId` (optional, IsInt, Min 1) sử dụng `class-validator` (FR-010, I4)
- [ ] T021 [US2] **(TDD Green)** Cài đặt `topics.controller.ts` và `lessons.controller.ts` (phần danh sách):
  - `GET /api/v1/topics`: trả về 16 chủ đề kèm `totalLessons` (FR-009)
  - `GET /api/v1/lessons`: lọc theo `level` và `topicId` (FR-010). Chạy test T019 xác nhận XANH (Green).
- [ ] T022 [US3] [P] **(TDD Red)** Viết Integration Test cho API chi tiết bài học trong `back-end/tests/integration/lesson-detail.test.ts`:
  - `US3-AS1: Gửi GET /api/v1/lessons/1 -> trả về chi tiết bài học và danh sách từ vựng sắp xếp theo orderInLesson (1..N)`
  - `US3-AS2: Kiểm tra payload từ vựng có đầy đủ 9 trường: word, partOfSpeech, phonetic, vietnameseMeaning, exampleEn, exampleVi, audioUrl...`
  - `US3-AS3: Gửi GET /api/v1/lessons/999999 -> trả về mã 404 Not Found với envelope { success: false, data: null, error: { code: 'LESSON_NOT_FOUND', message: 'Bài học không tồn tại', details: null } }` (I8)
  - Chạy test xác nhận ĐỎ (Red)
- [ ] T023 [US3] **(TDD Green)** Cài đặt endpoint `GET /api/v1/lessons/:id` trong `lessons.controller.ts` và `lesson.service.ts`: truy vấn bài học và danh sách từ vựng theo thứ tự `order_in_lesson`. Ném `NotFoundException` nếu ID không tồn tại. Chạy test T022 xác nhận XANH (Green).

---

## Phase 5: User Story 4 - Tra cứu Từ vựng Phân tách Loại từ (Priority: P2)

**Purpose**: Cung cấp API tra cứu từ điển nhanh và công cụ Tool Use cho Chatbot AI theo chu trình TDD.

- [ ] T024 [US4] [P] **(TDD Red)** Viết Integration Test cho API tra cứu từ vựng trong `back-end/tests/integration/vocab-search.test.ts`:
  - `US4-AS1: Tra cứu GET /api/v1/vocabularies/search?q=close -> trả về 2 bản ghi độc lập: A2 (adj.) và B2 (n.) với nghĩa riêng biệt theo thứ tự tất định (ORDER BY LENGTH(word), word, cefr_level, part_of_speech)` (A2)
  - `US4-AS2: Tra cứu GET /api/v1/vocabularies/search?q=  ABANDON   -> tự động trim và lowercase, tìm đúng từ abandon`
  - `US4-AS3: Tra cứu GET /api/v1/vocabularies/search?q=nonexistentword123 -> trả về mảng rỗng [] với mã 200 OK`
  - `Test Prefix Match & SQL Wildcard: Tra cứu từ khóa chứa '%' hoặc '_' -> xác nhận escape ký tự tìm kiếm chính xác, không quét wildcard toàn bảng` (A2, G2)
  - `Test Limits: Gửi q rỗng hoặc > 100 ký tự, hoặc limit=999 -> trả về mã 400 Bad Request với VALIDATION_ERROR` (A2, G2)
  - `Test GET /api/v1/vocabularies/:id: Lấy chi tiết từ vựng theo ID hợp lệ; lấy ID 999999 trả về mã 404 với code: 'VOCABULARY_NOT_FOUND' và details: null` (I8)
  - Chạy test xác nhận ĐỎ (Red)
- [ ] T025 [US4] Tạo DTO xác thực tìm kiếm `back-end/src/modules/vocabulary/dto/search-vocab.dto.ts`: `q` (bắt buộc, string, $1 \le \text{length} \le 100$), `limit` (optional, integer, $1 \le \text{limit} \le 50$, mặc định 20) (FR-012, A2)
- [ ] T026 [US4] **(TDD Green)** Cài đặt `vocabularies.controller.ts` và `vocabulary.service.ts`:
  - `GET /api/v1/vocabularies/:id`: Lấy chi tiết từ vựng theo ID, ném `NotFoundException` với code `VOCABULARY_NOT_FOUND`
  - `GET /api/v1/vocabularies/search?q=...&limit=...`: Tìm kiếm tiền tố với escape wildcard `%`, `_`, áp dụng thứ tự sắp xếp tất định (FR-012, A2). Chạy test T024 xác nhận XANH (Green).

---

## Phase 6: Nghiệm thu Toàn diện & Quality Gate Check

**Purpose**: Xác nhận 100% test xanh, đo đạc hiệu năng theo quy trình có thể lặp lại và kiểm định chất lượng theo Hiến pháp.

- [ ] T027 Chạy toàn bộ test suite (`npm run test`): xác nhận 100% test cases (đủ 14 kịch bản `US1-AS1..5`, `US2-AS1..3`, `US3-AS1..3`, `US4-AS1..3` cùng các test trường hợp biên rollback, validation, limit) đều ĐẠT (Green)
- [ ] T028 [P] Thực thi kịch bản kiểm tra hiệu năng lặp lại chuẩn trong `back-end/tests/benchmark/performance.bench.ts`:
  - Cấu hình môi trường đo chuẩn (A1): Máy phát triển cục bộ (tối thiểu 4 CPU cores, 8GB RAM, SSD; Node.js 22 LTS, PostgreSQL 16+ Docker, pool size 10)
  - Đo thời gian Seeder (SC-004): chạy seed trên database trống sau migration, đo từ lúc đọc file Excel đến khi commit hoàn tất $\rightarrow$ ghi nhận $< 15$ giây
  - Đo độ trễ API (SC-005): chạy tải 100 kết nối đồng thời với 1.000 requests tới `GET /api/v1/lessons?level=A1` và `GET /api/v1/lessons/1` (DB có index, không dùng cache ứng dụng) $\rightarrow$ ghi nhận độ trễ $p95 < 50ms$
- [ ] T029 Kiểm tra tính nhất quán Spec Kit: chạy phân tích chéo xác nhận 0 lỗi CRITICAL và 0 lỗi HIGH
- [ ] T030 Đối chiếu và hoàn thiện các mục trong `checklists/requirements.md` và `checklists/review.md`
