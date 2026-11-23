# AGENTS.md: Luật chơi cho AI agent

> Repo này làm việc theo **Spec-Driven Development** với **GitHub Spec Kit** (`.specify/`).
> Dự án: **"Website Hỗ trợ Học Từ Vựng Tiếng Anh Thông Minh"** (Đề cương Thực tập Chuyên ngành FITA - VNUA).
> *Spec là nguồn sự thật. Code là sản phẩm phái sinh từ spec.*
> Người dùng có thể là **người mới**, chưa biết Spec Kit. Nhiệm vụ của bạn là **dẫn họ đi đúng quy trình**, không bắt họ phải nhớ tên lệnh.

---

## 1. Nguyên tắc vàng

1. **Không spec, không code.** Không viết hoặc sửa code ứng dụng nếu feature chưa có `specs/<NNN-feature>/spec.md`, `plan.md` và `tasks.md`.
2. **Người dùng bảo "code luôn", "làm app…", "build…"?** Đừng từ chối, cũng đừng lao vào code. Nói ngắn gọn:
   > "Repo này dùng Spec Kit. Mình sẽ viết spec trước (vài phút), hỏi bạn vài câu, rồi mới code."

   Sau đó chạy skill `speckit-specify` với mô tả của người dùng.
3. **5 Điều cấm kỵ cốt lõi (Non-negotiables)** theo Hiến pháp [`.specify/memory/constitution.md`](.specify/memory/constitution.md):
   - **CẤM** lưu trữ binary audio (Blob/Base64) trực tiếp vào PostgreSQL; chỉ lưu URL tĩnh (`VARCHAR(500)`).
   - **CẤM** tự ý thay đổi tên 9 cột dữ liệu chuẩn đã trích xuất từ `tools/oxford_3000_vocabulary.xlsx`.
   - **CẤM** để cột `word` dính số homonym (`close2`), dính ngoặc đơn ngữ cảnh (`bear (animal)`), hoặc dính `\xa0`.
   - **CẤM** viết Chatbot AI theo dạng Autonomous Multi-agent loop tự do; chatbot bắt buộc chỉ dùng Function Calling (Level 2) với đúng 3 tools (`lookup_vocabulary`, `get_user_study_status`, `generate_quick_quiz`).
   - **CẤM** code lẫn lộn: Toàn bộ Backend nằm trong `back-end/`, toàn bộ Frontend nằm trong `font-end/`.
4. **Thử nghiệm, spike, prototype** → làm trong `spikes/<tên>/` hoặc `tools/`, không cần spec. **Không bao giờ copy thẳng từ `spikes/` hay `tools/` vào code chính.** Muốn giữ ý tưởng thì đưa vào `speckit-specify` và `speckit-plan`.
5. **Mơ hồ thì hỏi, không đoán.** Dùng `[NEEDS CLARIFICATION: …]` trong spec và chạy `speckit-clarify`. Khi hỏi người mới, **luôn kèm gợi ý đáp án** (A/B/C, hoặc "mặc định: …").
6. **Spec đổi trước, code đổi sau.** Yêu cầu mới, sửa cấu trúc bảng hoặc thay đổi hành vi thì cập nhật `spec.md`, `data-model.md` (và `plan.md` nếu ảnh hưởng thiết kế) trước khi sửa code.
7. **Người dùng duyệt, không phải agent.** Sau `speckit-clarify`, hỏi rõ "Bạn duyệt spec này chứ?" trước khi sang `speckit-plan`. Sau `speckit-plan` và `speckit-analyze`, cho người dùng xem trước khi `speckit-implement`.
8. **Chỉ "xong" khi `speckit-converge` báo Converged.** Không tự tuyên bố hoàn thành.
9. **Test là spec chạy được.** Mỗi kịch bản Given/When/Then cần ít nhất một test tự động. Không sửa hoặc xoá test để cho pass.

---

## 2. Quy trình chuẩn (theo Spec Kit Quickstart)

- **Lộ trình đầy đủ** (mặc định, cho sản phẩm thật): `constitution` (1 lần) → `specify` → `clarify` → `plan` → `checklist` → `tasks` → `analyze` → `implement` → `converge`
- **Lộ trình ngắn** (chỉ khi người dùng nói rõ là việc nhỏ): `specify` → `plan` → `tasks` → `implement` → `converge`
- **Chạy từng bước một.** Sau mỗi bước: tóm tắt kết quả, chỉ ra file đã tạo, và **dừng chờ người dùng xem** rồi mới sang bước tiếp.
- `implement` lặp với `converge` cho tới khi báo **Converged**.

---

## 3. Dịch câu nói của người dùng → bước Spec Kit

| Người dùng nói… | Bạn làm |
|---|---|
| "mình muốn làm…", "code luôn đi", "thêm tính năng…" | `speckit-specify` (chưa có `constitution` thì chạy `speckit-constitution` trước) |
| "còn gì chưa rõ?", "review spec", "hỏi mình đi" | `speckit-clarify` |
| "dùng X hay Y?", "lên kế hoạch", "chọn công nghệ" | `speckit-plan` (stack và kiến trúc chỉ quyết ở đây) |
| "spec ổn chưa?", "kiểm tra yêu cầu" | `speckit-checklist` |
| "chia việc", "làm gì trước?" | `speckit-tasks`, rồi `speckit-analyze` |
| "làm đi", "code đi" (đã có tasks) | `speckit-implement`, theo từng phase, **phiên mới cho mỗi đợt lớn** |
| "xong chưa?", "còn thiếu gì?" | `speckit-converge` |
| "mình đang ở đâu?", "làm gì tiếp?" | Đọc `.specify/feature.json` và thư mục `specs/`, báo trạng thái và **đúng 1 bước tiếp theo** |
| "thử nhanh…", "spike", "prototype" | Làm trong `spikes/` hoặc `tools/` |
| "mình đã vibe được bản demo rồi" | Đọc prototype, liệt kê hành vi quan sát được, rồi `speckit-specify` với mô tả đó; hành vi nghi là bug thì đánh `[NEEDS CLARIFICATION]` |

**Cách xác định "đang ở đâu":**
- Không có `.specify/memory/constitution.md` đã điền → bước `constitution`
- Có `spec.md` còn `[NEEDS CLARIFICATION]` → bước `clarify`
- Có `spec.md` nhưng chưa có `plan.md` → bước `plan`
- Có `plan.md` nhưng chưa có `tasks.md` → bước `tasks` và `analyze`
- Có `tasks.md` còn `- [ ]` → bước `implement`
- `tasks.md` đã tick hết → bước `converge`

---

## 4. Bản đồ repo

| Đường dẫn | Nội dung |
|---|---|
| [`.specify/memory/constitution.md`](.specify/memory/constitution.md) | Hiến pháp dự án (bất biến); mọi plan bắt buộc phải tuân theo |
| `.specify/templates/`, `.specify/scripts/` | Template và script của Spec Kit (không sửa tay) |
| `.agents/skills/` | Bộ công cụ kỹ năng tự động hóa Spec Kit cho Agent |
| `specs/NNN-feature/` | `spec.md` · `plan.md` · `research.md` · `data-model.md` · `contracts/` · `quickstart.md` · `tasks.md` · `checklists/` |
| `docs/` | Tài liệu thiết kế hệ thống (biểu đồ Use Case `usecase-diagram.png`, ERD `erd-diagram.jpg`) |
| `tools/` | Tập dữ liệu Oxford 3000 (`oxford_3000_vocabulary.xlsx`), script tiền xử lý, báo cáo dữ liệu |
| `spikes/` | 🎸 Vùng vibe coding thử nghiệm tự do, không lên production |
| `back-end/` | Mã nguồn Backend NestJS + TypeORM + PostgreSQL 16+ (Docker `pgvector`) |
| `font-end/` | Mã nguồn Frontend ReactJS (Vite) + TailwindCSS + TypeScript |

---

## 5. Giữ context sạch

- Chỉ đọc những gì task cần: constitution, rồi spec, plan và tasks của feature hiện tại, rồi code liên quan.
- Mọi quyết định phải nằm trong **file**, không chỉ trong chat. Bộ nhớ của dự án là repo.
- Feature lớn: implement theo phase, mỗi phase kiểm tra xong mới sang phase tiếp.
