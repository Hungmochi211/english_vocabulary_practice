# Implementation Plan: Chuẩn hóa, Quản lý kho từ vựng Oxford 3000 và Cơ sở dữ liệu Bài học

**Branch**: `001-vocabulary-data` | **Date**: 2026-11-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-vocabulary-data/spec.md`

---

## Summary

Gói tính năng này thiết lập nền móng dữ liệu cốt lõi cho ứng dụng học từ vựng:
1. Xây dựng mô hình cơ sở dữ liệu PostgreSQL (bảng `topics`, `vocabularies`, `lessons`, `lesson_vocabularies`) với các chỉ mục chuyên dụng phục vụ thuật toán trắc nghiệm Distractor Selection và tra cứu tiền tố.
2. Viết script Seeder tự động nạp toàn bộ $\ge 3.500$ từ vựng từ `tools/oxford_3000_vocabulary.xlsx` (4 cấp độ A1, A2, B1, B2) vào PostgreSQL với cơ chế Idempotent (`UPSERT` theo bộ bốn `(word, cefr_level, part_of_speech, sense_number)` — đánh `sense_number` từ 1 theo thứ tự xuất hiện trong file nguồn cho từng `(word, cefr_level, part_of_speech)`, ví dụ `rock` A2 `n.` có `sense_number = 1, 2`; đánh lại từ 1 khi file nguồn thay đổi).
3. Triển khai thuật toán phân bổ cân bằng (Balanced Partitioning) tự động chia kho từ thành các bài học chuẩn $15 - 18$ từ, cấm tuyệt đối bài học dưới 15 từ.
4. Cung cấp bộ RESTful API chuẩn hóa để truy vấn danh mục bài học và chi tiết từ vựng phục vụ màn hình Học nạp (Acquisition Flashcard).

Chi tiết lý do của từng lựa chọn kỹ thuật: xem [research.md](./research.md).  
Chi tiết bảng dữ liệu và schema: xem [data-model.md](./data-model.md).  
Đặc tả hợp đồng API: xem [contracts/openapi.yaml](./contracts/openapi.yaml).

---

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode) trên Node.js 22 LTS (Backend NestJS).

**Primary Dependencies**:
- Backend: `@nestjs/core`, `@nestjs/common`, `@nestjs/typeorm`, `typeorm`, `pg`, `class-validator`, `class-transformer`
- File Processing & Excel: `exceljs`
- Testing: `jest`, `supertest`

**Storage**:
- Cơ sở dữ liệu: PostgreSQL 16+ (Docker image `pgvector/pgvector:pg16`, mã hóa `UTF-8` theo Research R4).
- Kho lưu trữ âm thanh: Cloud Storage (Cloudflare R2 / AWS S3) lưu file tĩnh `.mp3`; Database chỉ lưu URL tĩnh dạng `VARCHAR(500)` (Research R2).

**Testing**:
- Unit Test với Jest cho Service nạp dữ liệu và thuật toán chia Lesson (Research R3).
- Integration Test cho các API endpoints truy vấn Topics, Lessons, Vocabularies.

**Target Platform**: Linux Container (Docker) / Cloud Server (Render / VPS), database PostgreSQL 16+ (`pgvector/pgvector:pg16`).

**Performance Goals**:
- Seeder nạp toàn bộ $\ge 3.500$ từ vựng và sinh toàn bộ lessons trong **dưới 15 giây** (SC-004, Research R5).
- Tốc độ phản hồi API truy vấn bài học: $p95 < 50ms$ (SC-005).

**Constraints**:
- Tuân thủ nghiêm ngặt 6 Điều khoản trong Hiến pháp dự án (`.specify/memory/constitution.md`).
- Tuyệt đối cấm lưu Blob/Base64 audio vào PostgreSQL (Constitution Điều I).
- Định lượng bài học bắt buộc trong khoảng $15 \le word\_count \le 20$ (Constitution Điều II.2).
- Cột `word` phải là chữ sạch 100%, không dính số chỉ mục homonym hay dấu ngoặc đơn (Constitution Điều I.2).

**Scale/Scope**:
- 4 cấp độ CEFR (A1, A2, B1, B2).
- 16 chủ đề chuẩn hóa (8 chủ đề A1–B1 và 8 chủ đề B2).
- Khoảng ~3.813 từ vựng sau khi làm phẳng đa từ loại.
- Khoảng ~200 - 230 bài học (lessons).

---

## Constitution Check

*GATE: Must pass before Phase 1 design. Re-check after Phase 2 implementation.*

| Điều khoản Hiến pháp | Đánh giá & Bằng chứng Tuân thủ | Kết quả |
| :--- | :--- | :---: |
| **I. Quy tắc & Dữ liệu từ Spec** | Dữ liệu nguồn lấy 100% từ `tools/oxford_3000_vocabulary.xlsx`. Giữ nguyên 9 cột chuẩn. Cột `word` đã được làm sạch không còn `close2`, `bear (animal)`, `\xa0`. Phân biệt đa nghĩa cùng `(word, cefr_level, part_of_speech)` bằng `sense_number` đánh từ 1 theo thứ tự file nguồn (vd: `rock` A2 `n.` sense 1 & 2). Trường `audio_url` là VARCHAR(500), không dùng Blob. Phân định rõ kho từ vựng và bài học. | ✅ **PASS** |
| **II. Chuẩn mực Sư phạm & Thuật toán** | Áp dụng thuật toán tìm kiếm nghiệm nguyên phân hoạch (Integer Partition Search) tại Research R3. Đảm bảo mọi bài học trước bài cuối có kích thước $15 \le size \le 18$; bài cuối tối đa $\le 20$. Tuyệt đối cấm tạo bài $< 15$ từ. Nhóm không hợp lệ bị từ chối tạo bài và ghi `[SEED_WARNING]`. | ✅ **PASS** |
| **III. Test trước (Given/When/Then - TDD)** | Chu trình TDD được thiết lập nghiêm ngặt trong `tasks.md`: 100% các task viết test (T013, T015, T019, T022, T024) đều đứng trước task viết code và bắt buộc chạy ĐỎ (Red) trước khi làm XANH (Green). Toàn bộ 15 kịch bản `US1-AS1..6`, `US2-AS1..3`, `US3-AS1..3`, `US4-AS1..3` đều có test tự động tương ứng. | ✅ **PASS** |
| **IV. Hợp đồng API & Kiến trúc** | Có file hợp đồng `contracts/openapi.yaml`. Sử dụng đúng NestJS, TypeORM, PostgreSQL 16+ (Docker `pgvector`, mã hóa `UTF-8`). Chuẩn hóa cả Success Envelope `{ success: true, data, error: null }` và Error Envelope `{ success: false, data: null, error: { code, message, details } }` qua `transform-response.interceptor.ts` và `http-exception.filter.ts`. | ✅ **PASS** |
| **V. Bảo mật & Đơn giản trước** | Dùng `.env` và `class-validator` cho DTOs (query `level`, search `q` độ dài $1-100$, phân trang `limit` $1-50$). Cấu trúc module NestJS tiêu chuẩn, không thêm trừu tượng rườm rà (YAGNI). | ✅ **PASS** |
| **VI. Cộng tác & Quản lý Task** | Toàn bộ 30 công việc được phân rã thành mã task `T001 - T030` rõ ràng trong `tasks.md`, phân định rõ ràng giữa `back-end/` và `tools/`. Xác định rõ ranh giới Feature 001 là Backend API; Chatbot AI thuộc Feature 003 và giao diện Frontend thuộc Feature 004. | ✅ **PASS** |

**Gate Result**: Toàn bộ các phát hiện kiểm định (C1–C3, I1–I8, G1–G2, A1–A2, U1) đã được giải quyết triệt để và đồng bộ trên toàn bộ các artifact:
- **A1**: Quy trình benchmark chuẩn (phần cứng tối thiểu, kết nối 100 vu, 1.000 requests, đo không cache) được xác định cụ thể trong SC-004, SC-005 và T028.
- **I7**: US1-AS1 và T015 đã đồng bộ thể hiện ngoại lệ bài cuối ($15 \le size \le 20$) và vị trí cuối nhóm.
- **A2**: Tra cứu từ vựng chuẩn hóa tìm kiếm tiền tố (Prefix Match), escape wildcard `%` và `_`, sắp xếp tất định `ORDER BY LENGTH(word) ASC, word ASC, cefr_level ASC, part_of_speech ASC, sense_number ASC`.
- **I8**: Mã lỗi `LESSON_NOT_FOUND`, `VOCABULARY_NOT_FOUND`, `VALIDATION_ERROR` và trường `details` đồng bộ giữa `spec.md`, `contracts/openapi.yaml` và `tasks.md`.
- **G2**: Bổ sung đầy đủ các kịch bản kiểm thử biên cho Transaction Rollback, `/topics`, giới hạn tham số và xử lý lỗi vào T015, T019, T024.

Bộ tài liệu hoàn toàn sẵn sàng cho giai đoạn Implementation.

---

## Project Structure

### Documentation (this feature)

```text
specs/001-vocabulary-data/
├── spec.md              # Đặc tả yêu cầu nghiệp vụ, User Stories & 14 Acceptance Scenarios
├── plan.md              # Bản thiết kế kỹ thuật, context và constitution check (File này)
├── research.md          # Phân tích các quyết định kỹ thuật R1 - R5 (kèm thuật toán Integer Partition)
├── data-model.md        # Chi tiết Entities, Schema DDL PostgreSQL và quan hệ
├── quickstart.md        # Hướng dẫn chạy Seeder và kiểm chứng dữ liệu
├── contracts/
│   └── openapi.yaml     # Đặc tả chuẩn OpenAPI 3.0 cho các RESTful API (kèm error envelope)
└── checklists/
    ├── requirements.md  # Bảng kiểm tra nghiệm thu chất lượng
    └── review.md        # Checklist tổng thể 32 mục trước triển khai
```

### Source Code Mapping (`back-end/`)

```text
back-end/
├── src/
│   ├── common/
│   │   ├── interceptors/
│   │   │   └── transform-response.interceptor.ts # Success envelope
│   │   └── filters/
│   │       └── http-exception.filter.ts         # Error envelope
│   ├── modules/
│   │   └── vocabulary/
│   │       ├── entities/
│   │       │   ├── topic.entity.ts              # Entity bảng topics
│   │       │   ├── vocabulary.entity.ts         # Entity bảng vocabularies (kèm Composite Index)
│   │       │   ├── lesson.entity.ts             # Entity bảng lessons
│   │       │   └── lesson-vocabulary.entity.ts  # Entity bảng trung gian lesson_vocabularies
│   │       ├── dto/
│   │       │   ├── query-lessons.dto.ts         # Validation query params lọc level, topicId
│   │       │   └── search-vocab.dto.ts          # Validation query search q (1-100), limit (1-50)
│   │       ├── controllers/
│   │       │   ├── topics.controller.ts         # API GET /api/v1/topics
│   │       │   ├── lessons.controller.ts        # API GET /api/v1/lessons, /api/v1/lessons/:id
│   │       │   └── vocabularies.controller.ts   # API GET /api/v1/vocabularies/search, /:id
│   │       ├── services/
│   │       │   ├── vocabulary.service.ts        # Nghiệp vụ truy vấn từ vựng
│   │       │   └── lesson.service.ts            # Nghiệp vụ phân cụm bài học
│   │       └── vocabulary.module.ts
│   └── database/
│       ├── migrations/
│       │   └── 1700000000001-CreateVocabularyCoreTables.ts
│       └── seeds/
│           ├── topic.seeder.ts                  # Script nạp 16 chủ đề chuẩn
│           ├── vocabulary.seeder.ts             # Script đọc Excel và nạp dữ liệu Idempotent
│           └── chunking.util.ts                 # Thuật toán Integer Partition Search
└── tests/
    ├── unit/
    │   └── chunking.util.test.ts                # Unit test thuật toán phân bổ (US1-AS3, AS4, edge cases)
    ├── integration/
    │   ├── seeder.test.ts                       # Integration test seeder (US1-AS1, AS2, AS5)
    │   ├── lessons-list.test.ts                 # Integration test danh sách bài học (US2-AS1, AS2, AS3)
    │   ├── lesson-detail.test.ts                # Integration test chi tiết bài học (US3-AS1, AS2, AS3)
    │   └── vocab-search.test.ts                 # Integration test tra cứu từ vựng (US4-AS1, AS2, AS3)
    └── benchmark/
        └── performance.bench.ts                 # Kiểm tra SC-004 (< 15s) và SC-005 (p95 < 50ms)
```
