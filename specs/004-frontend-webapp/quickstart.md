# Quickstart & Validation Guide: Frontend Web Application (`004-frontend-webapp`)

**Feature**: `004-frontend-webapp` | **Date**: 2026-11-23 | **Plan**: [plan.md](./plan.md)

Tài liệu này hướng dẫn cài đặt, chạy phát triển và kiểm chứng nghiệm thu toàn bộ `US-1` → `US-8` của ứng dụng Frontend chính thức trong `font-end/web/` sau pha `implement`.

---

## 1. Điều kiện tiên quyết (Prerequisites)

- **Node.js**: `>= 20.x` (khuyến nghị `22 LTS` khớp với `back-end/`).
- **Package manager**: `npm` (hoặc `pnpm`).
- **Tùy chọn Backend thật**: Khi chạy kiểm thử tích hợp end-to-end với Backend, cần `back-end/` đang chạy ở `http://localhost:3000` (xem `specs/002-backend-core/quickstart.md`). Khi phát triển/test độc lập Frontend, có thể chạy chế độ MSW Mock tích hợp.

---

## 2. Cấu hình môi trường & Khởi chạy

```powershell
cd D:\english_vocabulary_practice-main\english_vocabulary_practice\font-end\web

# 1. Cài đặt dependencies
npm install

# 2. Tạo file biến môi trường từ mẫu
Copy-Item .env.example .env
# Nội dung mẫu .env:
# VITE_API_BASE_URL=http://localhost:3000/api/v1
# VITE_GOOGLE_CLIENT_ID=<optional-google-oauth-client-id>
# VITE_ENABLE_MSW=false

# 3. Khởi chạy chế độ phát triển (http://localhost:5173)
npm run dev

# 4. Kiểm tra kiểu TypeScript & build production
npm run typecheck
npm run build
```

---

## 3. Chạy Bộ Kiểm thử Tự động (Vitest + Testing Library + MSW)

```powershell
# Chạy toàn bộ Unit Test & Integration Test (1 lần)
npm run test

# Chạy ở chế độ watch khi phát triển theo TDD
npm run test:watch

# Kiểm tra độ bao phủ (coverage)
npm run test:coverage
```

---

## 4. Kịch bản Kiểm chứng End-to-End theo User Stories

Tham chiếu chi tiết hợp đồng tại [contracts/frontend-api-contracts.md](./contracts/frontend-api-contracts.md) và kiểu dữ liệu tại [data-model.md](./data-model.md).

| Kịch bản | Thao tác kiểm chứng | Kết quả mong đợi |
| :--- | :--- | :--- |
| **V1 — Auth & Route Guard (`US-1`)** | Truy cập `/courses` khi chưa đăng nhập → chuyển `/login` → đăng ký tài khoản mới → đăng xuất xác nhận | Redirect đúng về trang đích sau đăng nhập; đăng xuất xóa sạch phiên & đưa về `/login`. |
| **V2 — Học 2 bước & Cổng 80% (`US-2`)** | Mở Bài 1, mới lật 3/16 thẻ rồi thử bấm *Luyện tập* → mở đủ 16/16 thẻ → nộp bài đạt `< 80%` rồi làm lại đạt `≥ 80%` | Chặn Bước 2 khi chưa đủ thẻ; dưới 80% giữ khóa Bài 2; đạt `≥ 80%` mở khóa Bài 2 và cập nhật XP/Streak ngay lập tức. |
| **V3 — 4 loại phản hồi & SM-2 (`US-3`)** | Làm phiên ôn SM-2 gồm câu đúng, câu gõ đảo 2 chữ cái (`paeceful`), câu đồng âm Dictation (`fone`) và câu sai | Hiển thị đủ 4 nhãn màu/chữ phân biệt rõ; sau nộp bài, phân bố 5 Hộp Leitner và số từ đến hạn cập nhật ngay. |
| **V4 — Tra từ & Sổ từ (`US-4`, `US-6`)** | Nhấn `Ctrl+K`, tra tiếng Anh, tiếng Việt không dấu (`moi truong`), từ sai nhẹ (`enviroment`), lưu 3 từ vào Sổ từ | Kết quả `< 300ms`, hiện gợi ý chính tả, lọc đúng theo CEFR/Loại từ/Chủ đề, 3 từ đã lưu xuất hiện ở nguồn ôn *Sổ từ đã lưu*. |
| **V5 — Lịch sử 10 phiên & Hồ sơ (`US-5`)** | Hoàn thành phiên ôn → mở **Lịch sử** (nằm trên Trang cá nhân) → mở chi tiết từ & bấm *Ôn lại* → cập nhật tên/email nhắc học & kiểm tra **Thông báo** | Phiên mới lên đầu danh sách, khung giữ tối đa 10 phiên có thanh cuộn; đổi tên/XP đồng bộ toàn trang; chấm đỏ thông báo ẩn khi đọc hết. |
| **V6 — Bảng xếp hạng tự nhảy (`US-6`)** | Cộng XP vượt thành viên xếp trên → bấm `Nhóm B2 Pro` → bấm 1 thành viên khác | Thứ hạng tự nhảy không cần F5; modal nhóm hiện skeleton rồi đủ danh sách; hồ sơ nhanh không lộ email/SĐT. |
| **V7 — Trợ lý AI v1 & Hỗ trợ QTV (`US-7`)** | Mở **Trợ lý AI** hỏi *"Phân biệt peaceful và calm?"* → mở nút **Hỗ trợ** góc phải dưới gửi biểu mẫu Góp ý/Báo lỗi | Trợ lý AI trả lời có cấu trúc + nút nghe/tra từ và giữ lịch sử; gửi góp ý đẩy thông báo xác nhận lên nút chuông. |
| **V8 — Phân quyền Admin (`US-8`)** | Đăng nhập Học viên thử vào `/admin` → đăng nhập Admin vào `/admin`, khóa/mở 1 học viên, xem Audit Logs | Học viên bị chặn và chuyển về `/`; Admin thao tác khóa/mở có xác nhận và thấy log cập nhật. |
| **V9 — Responsive & Mất mạng (`SC-006`, `SC-007`)** | Kiểm tra các mốc viewport `320px`, `768px`, `1280px`, `1440px`; ngắt mạng (Offline) và tải lại widget | Không vỡ bố cục hay tràn ngang ở mọi mốc; lỗi mạng hiển thị khung lỗi cục bộ kèm nút **Thử lại**, không trắng trang. |
