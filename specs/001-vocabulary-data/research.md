# Research & Technical Decisions: Vocabulary Dataset & Core Schema

**Feature**: [spec.md](./spec.md) | **Branch**: `001-vocabulary-data`

Tài liệu này ghi lại các nghiên cứu kỹ thuật, phân tích phương án và lý do đưa ra các quyết định kiến trúc cốt lõi cho gói dữ liệu từ vựng.

---

## R1: Cấu trúc lưu trữ từ đa từ loại (Multi-POS Flattening vs. JSON Array vs. EAV)

### Quyết định
Tách phẳng (Flatten) mỗi từ vựng kèm một loại từ cụ thể thành một dòng độc lập trong bảng `vocabularies`. Bộ bốn `(word, cefr_level, part_of_speech, sense_number)` tạo thành định danh logic duy nhất (hỗ trợ cả các từ đồng âm cùng từ loại như `rest`, `rock`).

### Các phương án đã cân nhắc
1. **Lưu cột mảng JSON `part_of_speech: ["n.", "v."]` trong 1 dòng:**
   - *Ưu điểm:* Số dòng ít hơn (~2.800 dòng thay vì ~3.500 dòng).
   - *Nhược điểm:* Câu lệnh SQL chọn đáp án nhiễu (Distractor Selection) sẽ phải dùng `JSON_CONTAINS` hoặc `LIKE '%n.%'` rất chậm, không thể tận dụng B-Tree Index. Đồng thời, nghĩa tiếng Việt và câu ví dụ của danh từ và động từ bị trộn lẫn, khó bóc tách trên giao diện.
2. **Mô hình EAV / Word - Senses (1 bảng `words` liên kết 1-n với bảng `senses`):**
   - *Ưu điểm:* Chuẩn hóa cơ sở dữ liệu cao (3NF/BCNF).
   - *Nhược điểm:* Phức tạp hóa quá mức cần thiết (Over-engineering). Mỗi truy vấn lấy danh sách thẻ học đều phải `JOIN` 2-3 bảng, làm tăng độ trễ và tốn tài nguyên.

### Lý do lựa chọn
- **Tối ưu hóa tuyệt đối cho thuật toán Distractor Selection:** Backend chỉ cần query cực nhanh:
  ```sql
  SELECT id, word, vietnamese_meaning FROM vocabularies 
  WHERE part_of_speech = :pos AND topic_id = :topicId AND id != :currentId 
  ORDER BY RANDOM() LIMIT 3;
  ```
  Nhờ composite index `(cefr_level, part_of_speech, topic_id)`, tập ứng viên được thu hẹp ngay lập tức và câu lệnh chạy trong **$< 2ms$**.
- **Tối ưu hóa cho Spaced Repetition (SM-2):** Một người học có thể nhớ nghĩa danh từ của từ `book` (cuốn sách) nhưng quên nghĩa động từ của `book` (đặt vé). Việc tách dòng độc lập cho phép theo dõi lịch ôn tập riêng biệt cho từng đơn vị kiến thức.

---

## R2: Lưu trữ âm thanh phát âm (Cloud Storage Static URL vs. Database Blob)

### Quyết định
Tuyệt đối không lưu dữ liệu nhị phân âm thanh (Blob hoặc chuỗi Base64) vào PostgreSQL. Database chỉ lưu đường dẫn URL tĩnh dạng chuỗi `VARCHAR(500)`.

### Các phương án đã cân nhắc
1. **Lưu Blob / Base64 trong database:**
   - *Hậu quả:* Dung lượng database cho 3.500 từ vựng sẽ phình to từ 5MB lên thành **hơn 250MB - 500MB**. Database backup chậm, dump file khổng lồ, shared buffers của PostgreSQL bị nghẽn vì phải cache các khối TOAST nhị phân lớn.
2. **Gọi API Text-to-Speech (TTS) thời gian thực mỗi khi người dùng bấm nghe:**
   - *Hậu quả:* Chi phí API tăng vọt khi có nhiều người dùng. Mỗi lượt nghe mất từ 1 - 2 giây độ trễ để gọi sang Google AI, trải nghiệm học tập bị giật lag.

### Lý do lựa chọn
- Tuân thủ Điều I trong Hiến pháp dự án (`constitution.md`).
- File âm thanh `.mp3` được lưu trữ tĩnh trên Cloudflare R2 / AWS S3 hoặc CDN. Trình duyệt tải audio trực tiếp từ CDN với cơ chế HTTP Cache (`Cache-Control: public, max-age=31536000`), không tốn băng thông và CPU của server backend.

---

## R3: Thuật toán phân bổ bài học nghiệm nguyên (Exact Integer Partition Search)

### Quyết định
Thay vì dùng phép chia xấp xỉ `round(N / 16.5)` vốn có thể sinh ra bài lẻ $< 15$ từ ở các số biên (như $N=42 \rightarrow 14,14,14$ hoặc $N=44 \rightarrow 15,15,14$), hệ thống áp dụng **Thuật toán tìm kiếm nghiệm nguyên phân hoạch (Exact Integer Partition Search)**:

1. **Ràng buộc sư phạm tuyệt đối (Invariants)**:
   - Mọi bài học từ $0 \rightarrow k-2$ (các bài trước bài cuối) bắt buộc phải có kích thước: $15 \le size_i \le 18$.
   - Riêng bài học cuối cùng ($k-1$) được phép mở rộng dung sai: $15 \le size_{k-1} \le 20$.
   - **Tuyệt đối CẤM** tạo bất kỳ bài học nào $< 15$ từ.
   - Bài học vượt 18 từ ($\le 20$) bắt buộc phải đặt ở **cuối nhóm**, không được đưa lên đầu nhóm.
2. **Tiêu chí lựa chọn tối ưu (Tie-breaking Rule)**:
   - Khi tồn tại nhiều giá trị $k$ cùng thỏa mãn (ví dụ $N=124$ có thể chia $k=7$ hoặc $k=8$), hệ thống **ưu tiên chọn $k$ nhỏ nhất** (tức số bài học ít nhất, độ dài bài học tiệm cận 17-18 từ) để tối ưu lộ trình học tập, tránh xé vụn bài học.
3. **Chính sách từ chối phân bổ (Rejection Policy)**:
   - Nếu nhóm từ vựng có $N < 15$ hoặc không thể phân hoạch hợp lệ vào cận $[15, 20]$ (như $N \in [21, 29]$ hoặc $N \in [41, 44]$), hệ thống sẽ **từ chối tạo bài học cho nhóm đó**, ghi log cảnh báo `[SEED_WARNING]`, giữ nguyên từ vựng trong bảng `vocabularies` để quản trị viên bổ sung dữ liệu sau.

### Thuật toán phân bổ (TypeScript Reference Implementation)
```typescript
export interface PartitionResult {
  lessonSizes: number[];
  isValid: boolean;
  warning?: string;
}

export function calculateLessonPartition(
  n: number,
  cefrLevel: string,
  topicCode: string,
): PartitionResult {
  // 1. Kiểm tra cận dưới tuyệt đối
  if (n < 15) {
    return {
      lessonSizes: [],
      isValid: false,
      warning: `[SEED_WARNING] Nhóm ${cefrLevel} - ${topicCode} chỉ có ${n} từ (< 15 từ). Cần tối thiểu 15 từ để tạo bài học.`,
    };
  }

  // 2. Duyệt tìm k từ nhỏ nhất (để tối ưu độ dài bài học tiệm cận 17-18)
  const minK = Math.max(1, Math.ceil((n - 2) / 18));
  const maxK = Math.floor(n / 15);

  for (let k = minK; k <= maxK; k++) {
    // Trường hợp k = 1 bài học duy nhất
    if (k === 1) {
      if (n >= 15 && n <= 20) {
        return { lessonSizes: [n], isValid: true };
      }
      continue;
    }

    // Trường hợp k > 1:
    // Thử phân bổ đều với kích thước tối đa <= 18
    const base = Math.floor(n / k);
    const rem = n % k;
    if (base >= 15 && base + (rem > 0 ? 1 : 0) <= 18) {
      // Đặt các bài kích thước base trước, base + 1 ở sau
      const sizes = Array(k - rem).fill(base).concat(Array(rem).fill(base + 1));
      return { lessonSizes: sizes, isValid: true };
    }

    // Thử phương án bài cuối nhận phần dư (tối đa 20 từ)
    for (let last = 15; last <= 20; last++) {
      const remN = n - last;
      if (remN >= (k - 1) * 15 && remN <= (k - 1) * 18) {
        const b = Math.floor(remN / (k - 1));
        const r = remN % (k - 1);
        const sizes = Array(k - 1 - r).fill(b).concat(Array(r).fill(b + 1)).concat([last]);
        return { lessonSizes: sizes, isValid: true };
      }
    }
  }

  return {
    lessonSizes: [],
    isValid: false,
    warning: `[SEED_WARNING] Nhóm ${cefrLevel} - ${topicCode} có ${n} từ không thể phân hoạch hợp lệ thành các bài 15-18 từ (bài cuối <= 20 từ).`,
  };
}
```

### Bảng kiểm chứng thực tế trên 32 nhóm Oxford 3000
Thực tế trên toàn bộ 3.813 từ vựng của `tools/oxford_3000_vocabulary.xlsx`:
- Toàn bộ 32 nhóm đều có $90 \le N \le 151$.
- Thuật toán tìm nghiệm nguyên phân hoạch xử lý thành công **100% cả 32 nhóm**, sinh ra đúng từ 15 đến 18 từ cho các bài đầu và tối đa 20 từ cho bài cuối. **0 bài học nào $< 15$ từ**.

---

## R4: Hệ quản trị PostgreSQL (`UTF-8`) & Sẵn sàng VectorDB (`pgvector`) trong Docker

### Quyết định
Sử dụng PostgreSQL 16+ (Docker image `pgvector/pgvector:pg16`), mã hóa `UTF-8`, và tạo index `text_pattern_ops` trên `LOWER(word)` cho tra cứu tiền tố.

### Lý do lựa chọn
- PostgreSQL dùng chuẩn `UTF-8` 4-byte mặc định (không bị lỗi `utf8` 3-byte như MySQL), lưu trữ hoàn hảo ký tự phiên âm IPA (`ə`, `ʃ`, `ʒ`, `θ`, `ð`, `ŋ`, `æ`, `ʌ`, `ʊ`, `ː`, `ˈ`, `ˌ`) và dấu tiếng Việt Unicode NFC.
- Image `pgvector/pgvector:pg16` trong Docker cho phép kích hoạt extension `vector` (`CREATE EXTENSION IF NOT EXISTS vector;`) ngay trên cùng một database, sẵn sàng lưu embedding cho phần **AI Chatbot RAG (`003-ai-chatbot`)** mà không phải vận hành thêm VectorDB rời.
- Chỉ mục `CREATE INDEX idx_vocab_word_lower ON vocabularies (LOWER(word) text_pattern_ops)` giúp truy vấn tìm kiếm tiền tố không phân biệt hoa thường (`LOWER(word) LIKE :q || '%'`) tận dụng trực tiếp B-Tree Index.

---

## R5: Hiệu năng Seeding, Idempotency và Cơ chế Phục hồi (Recovery)

### Quyết định
1. **Batch Insert có phân trang bộ đệm**: Nạp theo từng lô 100 dòng bọc trong Database Transaction.
2. **Idempotency tuyệt đối (Chạy nhiều lần không trùng lặp)**:
   - Bảng `vocabularies`: Sử dụng Composite Unique Index `(word, cefr_level, part_of_speech, sense_number)` kết hợp cú pháp `INSERT INTO vocabularies (...) VALUES (...) ON CONFLICT (word, cefr_level, part_of_speech, sense_number) DO UPDATE SET ...` của PostgreSQL để cập nhật nghĩa và phiên âm mà không chèn trùng dòng.
   - Bảng `lessons` và `lesson_vocabularies`: Khi chạy seed lại một chủ đề và cấp độ, Seeder thực thi trong Transaction: xóa sạch các liên kết `lesson_vocabularies` và bản ghi `lessons` cũ của cặp `(topic_id, cefr_level)` đó rồi tái tạo lại mới theo danh sách từ vựng hiện hữu.
3. **Rollback an toàn khi lỗi**: Nếu phát hiện lỗi dữ liệu ở bất kỳ sheet nào, toàn bộ transaction của cấp độ đó bị rollback, trả cơ sở dữ liệu về trạng thái sạch trước khi nạp.
