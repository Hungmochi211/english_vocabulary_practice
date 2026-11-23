<!--
Sync Impact Report
- Version change: 1.1.0 → 2.0.0 (MAJOR: Chuyển đổi hệ quản trị CSDL chuẩn từ MySQL 8.0 sang PostgreSQL 16+ kèm extension pgvector trong Docker để phục vụ VectorDB cho phần AI RAG)
- Modified principles:
  - I. Quy tắc nghiệp vụ và kho từ vựng từ spec: Cập nhật ranh giới cấm lưu Blob/Base64 audio vào PostgreSQL
  - IV. Hợp đồng API & Ranh giới Kiến trúc: Chuyển stack CSDL từ MySQL 8.0 (`utf8mb4_unicode_ci`) sang PostgreSQL 16+ (Docker `pgvector/pgvector:pg16`, mã hóa `UTF-8`, múi giờ `Asia/Ho_Chi_Minh` / `+07:00`); cho phép tích hợp truy xuất ngữ nghĩa RAG qua `pgvector` trong phạm vi ranh giới AI Level 2
  - V. Bảo mật cơ bản & Đơn giản trước: Cập nhật tham chiếu chuỗi kết nối PostgreSQL
- Added principles: Không có
- Modified sections:
  - Governance: Đồng bộ tham chiếu `AGENTS.md` / `AGENT.md`
- Removed sections: Không có
- Templates: Không sửa
- Follow-up TODOs:
  - AGENTS.md & AGENT.md: Đồng bộ PostgreSQL + pgvector
  - back-end/README.md: Đồng bộ schema PostgreSQL + pgvector
  - specs/001-vocabulary-data/: Đồng bộ spec.md, plan.md, research.md, data-model.md, quickstart.md, tasks.md sang PostgreSQL 16+
-->

# english-vocabulary-practice Constitution

Dự án Đề cương Thực tập Chuyên ngành của sinh viên (Khoa CNTT - Học viện Nông nghiệp Việt Nam): xây dựng **"Website Hỗ trợ Học Từ Vựng Tiếng Anh Thông Minh"**. Ưu tiên **chuẩn xác thuật toán, giá trị sư phạm vững chắc, mã nguồn đơn giản, dễ hiểu, dễ kiểm chứng và tự tin bảo vệ trước hội đồng**. Dự án có **nhiều thành viên cùng làm, gồm cả người (sinh viên) và AI agent**. Mọi spec, plan, tasks và code trong repo bắt buộc phải tuân theo các nguyên tắc dưới đây.

## Core Principles

### I. Quy tắc nghiệp vụ và kho từ vựng từ spec

- File chuẩn hóa `tools/oxford_3000_vocabulary.xlsx` là nguồn sự thật duy nhất (Single Source of Truth) cho toàn bộ kho từ vựng 4 cấp độ CEFR (A1, A2, B1, B2).
- Mọi quy tắc nghiệp vụ (định lượng bài học 15–18 từ, ngưỡng qua bài $\ge 80\%$, ngưỡng sai lệch gõ từ $\le 1$, số phương án trắc nghiệm = 4) MUST được ghi rõ trong `spec.md` của từng feature trước khi xuất hiện trong plan hoặc code.
- Agent và lập trình viên MUST NOT tự ý đoán hoặc thay đổi giá trị nghiệp vụ, không tự ý sửa cấu trúc 9 cột chuẩn của dữ liệu từ vựng.
- Cột `word` MUST là chuỗi chữ sạch 100%, tuyệt đối cấm dính số homonym (`close2`), cấm dính ngoặc đơn ngữ cảnh (`bear (animal)`), cấm dính ký tự khoảng trắng không ngắt `\xa0`.
- Từ vựng đa từ loại (Multi-POS) MUST được tách phẳng thành các bản ghi độc lập trong database để phục vụ chính xác thuật toán chọn đáp án nhiễu và thuật toán Spaced Repetition (SM-2).
- Âm thanh phát âm (.mp3) MUST NOT lưu dưới dạng nhị phân (Blob/Base64) vào PostgreSQL; database chỉ lưu URL tĩnh dạng `VARCHAR(500)`.
- Chỗ nào spec chưa rõ MUST đánh dấu `[NEEDS CLARIFICATION: …]` và giải quyết qua `speckit-clarify` trước khi sang `speckit-plan`.

Lý do: Kho dữ liệu từ vựng và quy tắc bài học là nền tảng cốt lõi của toàn bộ ứng dụng; dữ liệu hoặc thông số sai sẽ khiến mọi thuật toán học tập phía sau chạy sai hoàn toàn.

### II. Chuẩn mực sư phạm & Thuật toán chính xác (KHÔNG THƯƠNG LƯỢNG)

- Mọi luồng bài học MUST tuân thủ nghiêm ngặt chu trình sư phạm 2 bước: **Học nạp kiến thức (Acquisition)** qua Thẻ Flashcard trước $\rightarrow$ **Học áp dụng (Application)** qua bài tập phản xạ (Gõ từ, Nghe chép chính tả, Trắc nghiệm) sau.
- Thuật toán chia bài học (`Lesson`) MUST gom từ cùng Level và cùng Topic, chia đều thành các nhóm từ **15 đến 18 từ/bài** (chấp nhận tối đa $\le 20$ từ cho nhóm vét đuôi) để tối ưu dung lượng trí nhớ làm việc (Cognitive Load).
- Thuật toán Lặp lại Ngắt quãng (SuperMemo SM-2) MUST tính toán chính xác hệ số độ dễ $EF$ theo công thức chuẩn:
  $$EF' = EF + (0.1 - (5 - q) \times (0.08 + (5 - q) \times 0.02)) \quad (EF_{min} = 1.3)$$
  Nếu chất lượng phản hồi $q < 3$: MUST reset số lần lặp về 0 và chu kỳ về 1 ngày; đồng thời đồng bộ trạng thái trực quan với mô hình 5 Hộp Leitner.
- Thuật toán chấm điểm gõ từ MUST áp dụng khoảng cách Levenshtein / Damerau-Levenshtein: sai lệch $\le 1$ ký tự hoặc hoán vị 2 ký tự liền kề MUST trả về phản hồi *"Gần đúng"* thay vì đánh rớt.
- Thuật toán kiểm tra phát âm trong bài tập nghe chép chính tả (Dictation) MUST dùng Soundex / Double Metaphone để nhận diện từ đồng âm hoặc lỗi chính tả phát âm.
- Thuật toán sinh đáp án nhiễu trắc nghiệm (Distractor Selection) MUST chọn 3 phương án sai cùng loại từ (`part_of_speech`) và cùng chủ đề (`topic_id`), xáo trộn ngẫu nhiên bằng thuật toán **Fisher-Yates Shuffle**.

Lý do: Đây là linh hồn học thuật và giá trị khoa học của đề tài tốt nghiệp FITA - VNUA; thuật toán đúng chuẩn là điều kiện tiên quyết để nghiệm thu đề tài.

### III. Test trước và Kịch bản nghiệm thu (Given/When/Then)

- Mỗi kịch bản nghiệm thu Given/When/Then trong `spec.md` MUST có ít nhất một test tự động tương ứng (Unit Test hoặc Integration Test).
- Mọi logic thuật toán (SM-2, Levenshtein, Soundex, Fisher-Yates, Lesson Chunking) MUST được viết test bao phủ toàn bộ các trường hợp thông thường lẫn trường hợp biên (Edge Cases: chuỗi rỗng, từ 1 ký tự, điểm số biên $q=0, 3, 5$).
- Test MUST được viết trước và chạy đỏ trước khi viết code cho nó (Red $\rightarrow$ Green $\rightarrow$ Refactor).
- MUST NOT sửa hoặc xoá test chỉ để cho pass; nếu kịch bản test sai lệch với thực tế thì bắt buộc phải sửa `spec.md` trước, rồi mới sửa test.

Lý do: Test là đặc tả kỹ thuật chạy được; với các thuật toán tính khoảng cách và chu kỳ lặp lại ngắt quãng, test tự động là bằng chứng duy nhất chứng minh tính đúng đắn khi bảo vệ luận văn.

### IV. Hợp đồng API & Ranh giới Kiến trúc

- Mọi API giữa Backend (`back-end/`) và Frontend (`font-end/`) MUST có hợp đồng đặc tả trong `specs/<NNN-feature>/contracts/` (chuẩn OpenAPI 3.0.3) trước khi tiến hành viết code tích hợp.
- Toàn bộ các API phản hồi MUST bọc trong cấu trúc dữ liệu thống nhất:
  ```json
  {
    "success": true,
    "data": {},
    "error": null
  }
  ```
- Bộ công nghệ chuẩn hóa:
  - **Backend**: NestJS, TypeORM, PostgreSQL 16+ (chạy trong Docker với image `pgvector/pgvector:pg16`, mã hóa `UTF-8`, múi giờ `Asia/Ho_Chi_Minh` / `+07:00`).
  - **Frontend**: ReactJS (Vite), TailwindCSS, TypeScript.
  - **Xác thực**: JWT (Access Token + Refresh Token), Google OAuth 2.0. Mật khẩu băm bằng `bcrypt` (salt rounds $\ge 10$).
- Ranh giới Chatbot AI & VectorDB: Chatbot tích hợp Google Gemini API chỉ hoạt động ở cấp độ **Level 2 (Function Calling / Tool Use)** với đúng 3 công cụ được định nghĩa rõ ràng (`lookup_vocabulary`, `get_user_study_status`, `generate_quick_quiz`), có thể kết hợp truy xuất ngữ nghĩa RAG (read-only) trên extension **`pgvector`** của PostgreSQL cho kho từ vựng/ngữ pháp. Tuyệt đối **CẤM** triển khai vòng lặp Autonomous Multi-agent tự do.
- Tác vụ nền & Tự động hóa: Quét chuỗi ngày học (Streak) và gửi email nhắc nhở lúc 20:00 hàng ngày MUST được thực thi qua Cron Job kết hợp Queue (Redis), tuyệt đối không chạy blocking trên luồng chính của máy chủ Web.

Lý do: Hợp đồng API rõ ràng giúp nhóm phát triển Backend và Frontend làm việc song song mà không bị sai lệch; ranh giới AI rõ ràng giúp kiểm soát chi phí token và tránh trễ mạng.

### V. Bảo mật cơ bản & Đơn giản trước

- MUST NOT đặt mật khẩu, chuỗi kết nối PostgreSQL, khóa bí mật JWT, Google OAuth secret hay Gemini API key trong mã nguồn hoặc commit lên kho lưu trữ; bắt buộc dùng biến môi trường `.env` đi kèm file mẫu `.env.example`.
- Mọi dữ liệu đầu vào từ người dùng hoặc API bên ngoài MUST được kiểm tra (kiểu dữ liệu, độ dài, định dạng) bằng Data Transfer Object (DTO) và `class-validator` trước khi lưu vào database; dữ liệu không hợp lệ MUST bị từ chối với thông báo lỗi cụ thể.
- Ưu tiên công nghệ phổ biến, dễ cài đặt, tài liệu chuẩn quốc tế; không dùng các kiến trúc quá phức tạp vượt ngoài phạm vi đề tài sinh viên (YAGNI).
- Mã nguồn SHOULD viết tường minh, hàm ngắn gọn, đặt tên theo chuẩn tiếng Anh chuyên ngành, chú thích rõ ràng tại các đoạn tính toán thuật toán.

Lý do: Bảo mật cơ bản phòng tránh các lỗi bảo mật sơ đẳng; kiến trúc đơn giản, sáng sủa giúp sinh viên hoàn toàn làm chủ sản phẩm khi thuyết trình và trả lời chất vấn của thầy cô.

### VI. Cộng tác nhiều thành viên và Quản lý Tác vụ

**Nguồn sự thật:**
- Nội dung task (mô tả, phân loại, thứ tự, phụ thuộc) nằm ở `specs/<NNN-feature>/tasks.md`.
- Mỗi task trong `tasks.md` MUST có mã định danh duy nhất theo cú pháp: `[Txxx] [P?] [Story] Description` (ví dụ: `T007 [P] [US1] Tạo Entity Vocabulary...`).

**Phân định ranh giới thư mục:**
- Toàn bộ mã nguồn Backend nằm trong thư mục `back-end/`.
- Toàn bộ mã nguồn Frontend nằm trong thư mục `font-end/`.
- Dữ liệu thô và script tiền xử lý nằm trong thư mục `tools/`.
- Các gói tài liệu kỹ thuật nằm trong `specs/`.
- Lập trình viên và AI agent khi thực hiện task chỉ thao tác đúng các file thuộc phạm vi task đó; MUST NOT tự ý sửa chéo hoặc refactor toàn bộ thư mục gây xung đột.

**Quy trình thực hiện task:**
- Trước khi bắt đầu task mới: MUST kiểm tra các task tiên quyết phụ thuộc đã hoàn thành hay chưa; kiểm tra môi trường đã sẵn sàng.
- Trong khi làm: Bám sát kịch bản nghiệm thu tương ứng trong `spec.md` và hợp đồng trong `contracts/`.
- Hoàn thành task: Chạy kiểm thử xác nhận pass, sau đó tick đánh dấu `- [x]` trực tiếp vào đúng dòng task trong `tasks.md`.

Lý do: Phân định ranh giới rõ ràng giữa các phần của hệ thống và duy trì danh sách task đồng bộ giúp sinh viên và AI agent phối hợp nhịp nhàng, không bị giẫm chân lên nhau.

---

## Ràng buộc kỹ thuật

- Ngăn xếp công nghệ (Stack) và kiến trúc chỉ được quyết định trong `speckit-plan` và ghi vào `plan.md`, kèm mục "Constitution Check" đối chiếu đầy đủ các nguyên tắc trên.
- Mọi giải pháp ngoại lệ làm tăng độ phức tạp MUST được giải trình trong mục "Complexity Tracking" của `plan.md` với lý do xác đáng.
- Mọi thử nghiệm thuật toán (ví dụ: cào dữ liệu, thử nghiệm Gemini prompt, test độ chính xác Levenshtein) được thực hiện trong thư mục `tools/` hoặc `spikes/`; mã thử nghiệm MUST NOT được copy nguyên trạng vào mã nguồn production nếu chưa được chuẩn hóa theo chuẩn NestJS/React.

---

## Quy trình phát triển & Cổng chất lượng

- **Không spec, không code**: Mỗi tính năng mới MUST có đầy đủ `spec.md`, `plan.md`, `tasks.md` trước khi tiến hành lập trình (`speckit-implement`).
- **Spec đổi trước, code đổi sau**: Mọi thay đổi về nghiệp vụ, cấu trúc bảng dữ liệu, hoặc tham số thuật toán phải cập nhật vào tài liệu `specs/` trước khi sửa code.
- **Cổng duyệt tài liệu (Review Gate)**: Sinh viên duyệt kỹ `spec.md` (sau `speckit-clarify`) và `plan.md` trước khi tiến hành code.
- **Cổng kiểm tra nhiệm vụ (Task Gate)**: Thực thi đúng từng task đã phân định trong `tasks.md`, đảm bảo độc lập và không phá vỡ các phần đã hoàn thành.
- **Cổng hoàn thành (Done Gate)**: Toàn bộ Unit Test và kịch bản nghiệm thu Given/When/Then đều đạt (Green), 100% task trong `tasks.md` được tick xong, và dữ liệu đã được xác minh qua các câu lệnh SQL kiểm tra trong `quickstart.md`.

---

## Governance

- Bản Hiến pháp này là văn bản quy định kỹ thuật cao nhất trong toàn bộ kho lưu trữ dự án; file `AGENT.md` đóng vai trò hướng dẫn quy tắc vận hành chi tiết cho các AI agent và tuyệt đối không được mâu thuẫn với Hiến pháp.
- **Sửa đổi Hiến pháp**: Mọi điều chỉnh phải được thực hiện thông qua skill `speckit-constitution`, ghi rõ nguyên nhân và phiên bản mới trong khối "Sync Impact Report" ở đầu file, và phải được người dùng phê duyệt trước khi áp dụng.
- **Quy tắc đánh số phiên bản (Semantic Versioning)**:
  - **MAJOR** ($x.0.0$): Thay đổi hoặc xóa bỏ các nguyên tắc cốt lõi không thể thương lượng.
  - **MINOR** ($1.x.0$): Bổ sung thêm nguyên tắc mới, mở rộng quy trình hoặc chuẩn hóa thêm cổng chất lượng.
  - **PATCH** ($1.0.x$): Chỉnh sửa câu chữ, giải thích rõ nghĩa hơn nhưng không đổi bản chất quy tắc.
- **Kiểm soát tuân thủ**: Mọi kế hoạch trong `plan.md` (mục Constitution Check) và quy trình phân tích trong `speckit-analyze` bắt buộc phải đối chiếu với các điều khoản của Hiến pháp; vi phạm bất kỳ điều khoản nào là lỗi **CRITICAL** cần phải khắc phục trước khi triển khai.

---

**Version**: 2.0.0 | **Ratified**: 2026-11-17 | **Last Amended**: 2026-11-21
