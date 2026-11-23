# Data Model & Database Schema: Vocabulary & Lessons

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Branch**: `001-vocabulary-data`

Tài liệu này định nghĩa chi tiết cấu trúc các bảng cơ sở dữ liệu, kiểu dữ liệu, các ràng buộc toàn vẹn (Constraints), chỉ mục (Indexes) và sơ đồ quan hệ cho phân hệ Từ vựng & Bài học trong **PostgreSQL 16+ (Docker image `pgvector/pgvector:pg16`)**.

**Quy ước thiết kế chung:**
- Mã hóa: `UTF-8` chuẩn PostgreSQL (hỗ trợ đầy đủ tiếng Việt và ký tự phiên âm quốc tế IPA).
- Kiểu khóa chính: `INT GENERATED ALWAYS AS IDENTITY` (hoặc `SERIAL`).
- Quy ước múi giờ: `TIMESTAMPTZ` (hiển thị và tính toán theo `Asia/Ho_Chi_Minh`, `+07:00`).
- Quy ước Audit: Đầy đủ `created_at` và `updated_at` tại các bảng cốt lõi.

---

## 1. Chi tiết Thực thể (Entities)

### 1.1. Topic (Chủ đề bài học)

Lưu trữ danh mục 16 chủ đề chuẩn hóa xuyên suốt 4 cấp độ CEFR (8 chủ đề A1–B1 và 8 chủ đề B2).

| Cột (Column) | Kiểu dữ liệu | Nullable | Ràng buộc / Quy tắc | Chú thích nghiệp vụ |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `INT` | ❌ | `PRIMARY KEY GENERATED ALWAYS AS IDENTITY` | Định danh chủ đề |
| `code` | `VARCHAR(50)` | ❌ | `UNIQUE`, `lowercase_snake_case` | Mã định danh (`daily_life`, `travel_transport`...) (FR-005) |
| `name` | `VARCHAR(100)` | ❌ | Không rỗng, 2–100 ký tự | Tên tiếng Anh: "Daily Life & Routines" |
| `name_vi` | `VARCHAR(100)` | ❌ | Không rỗng, 2–100 ký tự | Tên tiếng Việt: "Đời sống & Thói quen" |
| `description` | `TEXT` | ✔️ | Nullable | Mô tả chi tiết nội dung chủ đề |
| `created_at` | `TIMESTAMPTZ` | ❌ | `DEFAULT NOW()` | Thời điểm tạo |

### 1.2. Vocabulary (Kho từ vựng chuẩn hóa)

Bảng lưu trữ từng đơn vị từ vựng độc lập đã làm phẳng từ loại (Research R1).

| Cột (Column) | Kiểu dữ liệu | Nullable | Ràng buộc / Quy tắc | Chú thích nghiệp vụ |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `INT` | ❌ | `PRIMARY KEY GENERATED ALWAYS AS IDENTITY` | Định danh từ vựng |
| `word` | `VARCHAR(100)` | ❌ | Không rỗng, chữ sạch (FR-002) | Từ tiếng Anh (cấm dính `close2`, ngoặc đơn, `\xa0`) |
| `cefr_level` | `cefr_level_enum` | ❌ | `ENUM('A1','A2','B1','B2')` | Cấp độ theo chuẩn CEFR (FR-001) |
| `part_of_speech` | `VARCHAR(30)` | ❌ | Chỉ 1 trong 14 nhãn chuẩn (FR-003) | `n.`, `v.`, `adj.`, `adv.`, `article.`, `indefinite article.`... |
| `sense_number` | `SMALLINT` | ❌ | `DEFAULT 1`, $\ge 1$ | Phân biệt đồng âm cùng `(word, cefr_level, part_of_speech)` |
| `phonetic` | `VARCHAR(100)` | ❌ | Định dạng `^/.+/$` (FR-004) | Phiên âm quốc tế IPA (ví dụ `/əˈbæn.dən/`) |
| `vietnamese_meaning` | `VARCHAR(255)` | ❌ | Không rỗng, 1–255 ký tự | Nghĩa tiếng Việt chuẩn theo từ loại |
| `example_en` | `TEXT` | ❌ | Không rỗng | Câu ví dụ ngữ cảnh tiếng Anh |
| `example_vi` | `TEXT` | ❌ | Không rỗng | Bản dịch tiếng Việt câu ví dụ |
| `topic_id` | `INT` | ❌ | `FOREIGN KEY → topics(id)` | Khóa ngoại liên kết chủ đề |
| `audio_url` | `VARCHAR(500)` | ✔️ | Format URL hợp lệ (FR-013) | URL file mp3 tĩnh trên CDN/Storage (Research R2) |
| `created_at` | `TIMESTAMPTZ` | ❌ | `DEFAULT NOW()` | Thời điểm tạo |
| `updated_at` | `TIMESTAMPTZ` | ❌ | `DEFAULT NOW()` | Thời điểm cập nhật cuối |

**Chỉ mục (Indexes):**
- `UNIQUE CONSTRAINT unique_word_level_pos_sense (word, cefr_level, part_of_speech, sense_number)`: Đảm bảo không trùng lặp và phục vụ Idempotent Seeding (`ON CONFLICT DO UPDATE`).
- `INDEX idx_vocab_word_lower ON vocabularies (LOWER(word) text_pattern_ops)`: Tối ưu tra cứu tiền tố không phân biệt hoa thường (`search?q=...`) (FR-012, Research R4).
- `INDEX idx_vocab_distractor (cefr_level, part_of_speech, topic_id)`: **Tối ưu hóa tối cao** cho câu lệnh chọn đáp án nhiễu trắc nghiệm (Research R1, Hiến pháp Điều III).

### 1.3. Lesson (Bài học định lượng 15 - 18 từ)

Bảng quản lý các bài học được chia nhỏ từ kho từ vựng.

| Cột (Column) | Kiểu dữ liệu | Nullable | Ràng buộc / Quy tắc | Chú thích nghiệp vụ |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `INT` | ❌ | `PRIMARY KEY GENERATED ALWAYS AS IDENTITY` | Định danh bài học |
| `topic_id` | `INT` | ❌ | `FOREIGN KEY → topics(id)` | Thuộc chủ đề nào |
| `cefr_level` | `cefr_level_enum` | ❌ | `ENUM('A1','A2','B1','B2')` | Thuộc cấp độ nào (FR-007) |
| `title` | `VARCHAR(150)` | ❌ | Không rỗng | Tiêu đề bài học (ví dụ: "Lesson 1: Daily Routines") |
| `order_index` | `INT` | ❌ | $\ge 1$ | Thứ tự hiển thị của bài học trong cấp độ |
| `word_count` | `INT` | ❌ | $15 \le word\_count \le 20$ (FR-006) | Số lượng từ trong bài học (Research R3) |
| `created_at` | `TIMESTAMPTZ` | ❌ | `DEFAULT NOW()` | Thời điểm tạo |

**Chỉ mục (Indexes):**
- `INDEX idx_lesson_level_topic (cefr_level, topic_id)`: Tối ưu hóa truy vấn danh mục bài học theo bộ lọc.

### 1.4. LessonVocabulary (Bảng liên kết Bài học - Từ vựng)

Bảng trung gian thể hiện quan hệ nhiều - nhiều giữa `lessons` và `vocabularies`.

| Cột (Column) | Kiểu dữ liệu | Nullable | Ràng buộc / Quy tắc | Chú thích nghiệp vụ |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `INT` | ❌ | `PRIMARY KEY GENERATED ALWAYS AS IDENTITY` | Định danh bản ghi |
| `lesson_id` | `INT` | ❌ | `FOREIGN KEY → lessons(id) ON DELETE CASCADE` | Khóa ngoại tới bài học |
| `vocabulary_id` | `INT` | ❌ | `FOREIGN KEY → vocabularies(id) ON DELETE CASCADE` | Khóa ngoại tới từ vựng |
| `order_in_lesson` | `INT` | ❌ | $1 \le order \le 20$ | Thứ tự xuất hiện của từ trong bài học (1..N) |

**Ràng buộc duy nhất (Unique Constraints):**
- `UNIQUE CONSTRAINT unique_lesson_vocab (lesson_id, vocabulary_id)`: Một từ chỉ xuất hiện tối đa 1 lần trong 1 bài học.
- `UNIQUE CONSTRAINT unique_lesson_order (lesson_id, order_in_lesson)`: Mỗi thứ tự trong 1 bài học là duy nhất.

---

## 2. Sơ đồ Quan hệ Thực thể (Relationship Map)

```text
topics (1) ───────< (n) lessons (1) ───────< (n) lesson_vocabularies (n) >─────── (1) vocabularies
   │                                                                                         │
   └─────────────────────────────── (1) ───────< (n) ────────────────────────────────────────┘
```

- Một `Topic` chứa nhiều `Lesson` và chứa nhiều `Vocabulary`.
- Một `Lesson` liên kết với từ 15 đến 18 `Vocabulary` (bài cuối nhóm tối đa 20) thông qua bảng trung gian `LessonVocabulary`.
- Khi xóa một `Lesson`, toàn bộ liên kết trong `LessonVocabulary` tự động bị xóa (`CASCADE`), nhưng các từ trong `Vocabulary` vẫn được giữ nguyên an toàn.

---

## 3. Schema DDL Migration Script (PostgreSQL 16+ & pgvector)

```sql
-- Kích hoạt extension pgvector sẵn sàng cho AI RAG (Feature 003)
CREATE EXTENSION IF NOT EXISTS vector;

-- Kiểu ENUM cho cấp độ CEFR
DO $$ BEGIN
    CREATE TYPE cefr_level_enum AS ENUM ('A1', 'A2', 'B1', 'B2');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. Bảng topics
CREATE TABLE topics (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    name_vi VARCHAR(100) NOT NULL,
    description TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Bảng vocabularies
CREATE TABLE vocabularies (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    word VARCHAR(100) NOT NULL,
    cefr_level cefr_level_enum NOT NULL,
    part_of_speech VARCHAR(30) NOT NULL,
    sense_number SMALLINT NOT NULL DEFAULT 1 CHECK (sense_number >= 1),
    phonetic VARCHAR(100) NOT NULL,
    vietnamese_meaning VARCHAR(255) NOT NULL,
    example_en TEXT NOT NULL,
    example_vi TEXT NOT NULL,
    topic_id INT NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
    audio_url VARCHAR(500) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_word_level_pos_sense UNIQUE (word, cefr_level, part_of_speech, sense_number)
);

CREATE INDEX idx_vocab_word_lower ON vocabularies (LOWER(word) text_pattern_ops);
CREATE INDEX idx_vocab_distractor ON vocabularies (cefr_level, part_of_speech, topic_id);

-- 3. Bảng lessons
CREATE TABLE lessons (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    topic_id INT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    cefr_level cefr_level_enum NOT NULL,
    title VARCHAR(150) NOT NULL,
    order_index INT NOT NULL CHECK (order_index >= 1),
    word_count INT NOT NULL DEFAULT 0 CHECK (word_count >= 15 AND word_count <= 20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lesson_level_topic ON lessons (cefr_level, topic_id);

-- 4. Bảng lesson_vocabularies
CREATE TABLE lesson_vocabularies (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lesson_id INT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    vocabulary_id INT NOT NULL REFERENCES vocabularies(id) ON DELETE CASCADE,
    order_in_lesson INT NOT NULL CHECK (order_in_lesson >= 1 AND order_in_lesson <= 20),
    CONSTRAINT unique_lesson_word UNIQUE (lesson_id, vocabulary_id),
    CONSTRAINT unique_lesson_order UNIQUE (lesson_id, order_in_lesson)
);
```
