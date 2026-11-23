# Quickstart: Vocabulary Dataset & Core Schema

Tài liệu hướng dẫn thiết lập môi trường, chạy container Docker PostgreSQL (`pgvector`), chạy migrations, thực thi Seeder nạp dữ liệu từ file Excel vào PostgreSQL và kiểm chứng tính toàn vẹn của dữ liệu theo các tiêu chí nghiệm thu trong [spec.md](./spec.md).

---

## 1. Yêu cầu Tiên quyết (Prerequisites)

- Node.js version $\ge 20$ (khuyên dùng Node.js 22 LTS).
- Docker Desktop đang chạy để khởi động container PostgreSQL 16+ kèm extension `pgvector` (`pgvector/pgvector:pg16`).
- File Excel chuẩn hóa nằm tại: `tools/oxford_3000_vocabulary.xlsx`.
- File cấu hình môi trường `back-end/.env`:
  ```env
  DB_HOST=localhost
  DB_PORT=5432
  DB_USERNAME=postgres
  DB_PASSWORD=your_password
  DB_DATABASE=english_vocab_db
  PORT=3000
  ```

---

## 2. Khởi tạo Cơ sở Dữ liệu Docker & Chạy Migrations

### Bước 2.1: Khởi động PostgreSQL (`pgvector/pgvector:pg16`) trong Docker
```bash
docker run -d --name english_vocab_pg `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=your_password `
  -e POSTGRES_DB=english_vocab_db `
  -e TZ=Asia/Ho_Chi_Minh `
  -p 5432:5432 `
  pgvector/pgvector:pg16
```

### Bước 2.2: Cài đặt dependencies và chạy migration
```bash
cd back-end
npm install
npm run typeorm:migration:run
```
*Kết quả:* Extension `vector` (`pgvector`) và 4 bảng `topics`, `vocabularies`, `lessons`, `lesson_vocabularies` được tạo thành công với đầy đủ khóa ngoại và chỉ mục (Index).

---

## 3. Thực thi Seeder Nạp Dữ liệu từ Excel

Chạy script Seeder tự động:
```bash
cd back-end
npm run seed:vocab
```

Quá trình Seeder sẽ thực thi tuần tự:
1. Nạp 16 Topics chuẩn hóa vào bảng `topics`.
2. Đọc lần lượt 4 sheets (`A1`, `A2`, `B1`, `B2`) từ `tools/oxford_3000_vocabulary.xlsx`.
3. Batch insert ~3.813 từ vựng vào bảng `vocabularies`.
4. Kích hoạt thuật toán `chunkVocabulariesIntoLessons` tự động tạo bảng `lessons` và liên kết `lesson_vocabularies`.

---

## 4. Kiểm chứng Dữ liệu (Verification Scenarios)

### Kịch bản 1: Kiểm tra số lượng và tính toàn vẹn (AC-001.1, SC-001)
Chạy câu lệnh SQL kiểm tra:
```sql
-- 1. Tổng số từ vựng (phải >= 3.500 dòng sau khi tách multi-POS)
SELECT cefr_level, COUNT(*) AS total_words 
FROM vocabularies 
GROUP BY cefr_level;

-- 2. Kiểm tra không có ô nào bị rỗng IPA hoặc nghĩa
SELECT COUNT(*) AS missing_fields 
FROM vocabularies 
WHERE phonetic IS NULL OR phonetic = '' 
   OR vietnamese_meaning IS NULL OR vietnamese_meaning = '';
-- Kỳ vọng: 0 dòng.

-- 3. Kiểm tra độ sạch của từ vựng (không dính số hoặc ngoặc đơn)
SELECT id, word FROM vocabularies 
WHERE word ~ '[0-9()]';
-- Kỳ vọng: 0 dòng.
```

### Kịch bản 2: Kiểm tra định lượng bài học 15 - 18 từ (AC-001.2, SC-002)
```sql
-- Kiểm tra có bài học nào nằm ngoài khoảng chuẩn không
SELECT id, title, word_count 
FROM lessons 
WHERE word_count < 15 OR word_count > 20;
-- Kỳ vọng: 0 dòng (tất cả các bài học đều có từ 15 đến 20 từ).
```

### Kịch bản 3: Kiểm tra tính lặp lại an toàn (Idempotency - AC-001.4, SC-006)
Chạy lại lệnh Seeder lần 2:
```bash
npm run seed:vocab
```
Sau đó kiểm tra lại tổng số bản ghi:
```sql
SELECT COUNT(*) FROM vocabularies;
SELECT COUNT(*) FROM lessons;
```
*Kỳ vọng:* Số lượng bản ghi giữ nguyên 100%, không bị nhân đôi, không xuất hiện lỗi duplicate.

---

## 5. Kiểm chứng API qua cURL

Khởi động server backend:
```bash
npm run start:dev
```

### 5.1. Lấy danh sách 16 chủ đề:
```bash
curl -X GET http://localhost:3000/api/v1/topics
```

### 5.2. Lấy danh sách bài học cấp độ A1:
```bash
curl -X GET "http://localhost:3000/api/v1/lessons?level=A1"
```

### 5.3. Xem chi tiết bài học số 1 (15-18 thẻ từ):
```bash
curl -X GET http://localhost:3000/api/v1/lessons/1
```

### 5.4. Tra cứu từ vựng `abandon`:
```bash
curl -X GET "http://localhost:3000/api/v1/vocabularies/search?q=abandon"
```
