# Frontend Requirements & Design Quality Checklist (`004-frontend-webapp`)

**Purpose**: Kiểm định tính đầy đủ, rõ ràng, nhất quán và khả năng kiểm thử của bộ yêu cầu & thiết kế Frontend trước khi sinh `tasks.md` và tiến hành triển khai (`speckit-checklist`)
**Created**: 2026-11-23
**Feature**: [spec.md](../spec.md) · [plan.md](../plan.md) · [data-model.md](../data-model.md) · [frontend-api-contracts.md](../contracts/frontend-api-contracts.md)

---

## 1. Xác thực, Bảo mật & Phân quyền (`US-1`, `US-8`)

- [x] **CHK001** - Luồng Đăng ký, Đăng nhập Email, Google OAuth 2.0, Đổi mật khẩu và Đăng xuất có xác nhận đều có tiêu chí đầu vào và xử lý lỗi rõ ràng? `[Completeness, Spec §FR-001, US-1]`
- [x] **CHK002** - Cơ chế làm mới phiên (Single-Flight Refresh Token Queue) và xử lý khi refresh thất bại giữa lúc đang làm bài đã được đặc tả tránh Race Condition Reuse Detection? `[Edge Case, Plan §R3, Contracts §2]`
- [x] **CHK003** - Ranh giới phân quyền giữa Học viên và Quản trị viên (ẩn menu + chặn truy cập trực tiếp `/admin*` + xử lý `403 ACCOUNT_DISABLED`) đã thống nhất giữa `spec.md`, `plan.md` và `contracts/`? `[Consistency, Spec §FR-002, FR-015, US-8]`
- [x] **CHK004** - Hộp thoại xem nhanh hồ sơ thành viên trên Bảng xếp hạng tuần đảm bảo ẩn tuyệt đối thông tin riêng tư (`email`, `phone`)? `[Security, Spec §US-6 AS-3, Data Model §6]`

## 2. Chu trình Sư phạm 2 Bước & Chấm điểm (`US-2`, `US-3`)

- [x] **CHK005** - Điều kiện mở khóa Bước 2 (mở đủ 100% thẻ từ ở Bước 1) và mở khóa bài học kế tiếp ($\ge 80\%$) có kịch bản kiểm nhận cả trường hợp Đạt ($\ge 80\%$) lẫn Chưa đạt ($< 80\%$)? `[Coverage, Spec §FR-004, FR-005, US-2]`
- [x] **CHK006** - Quy tắc hiển thị 4 phân loại chấm điểm đúng `grading_status_enum` của `002-backend-core` (`exact` `1,0`, `near_match` `0,5` **chỉ cho từ dài $\ge 3$ ký tự**, `phonetic_match` `0,0`, `incorrect` `0,0` bao gồm từ ngắn $< 3$ ký tự) có khớp 100% giữa `spec.md`, `data-model.md`, `contracts/` và `tasks.md`? `[Consistency, Spec §FR-007, US-3 AS-2..4, Data Model §4]`
- [x] **CHK007** - Thời gian phản hồi từng câu (`responseTimeMs`, kẹp trong `[0, 300000]`) có được định nghĩa rõ trong payload nộp bài để Backend tính chất lượng nhớ $q$ cho SM-2? `[Completeness, Data Model §4, Contracts §1.3]`
- [x] **CHK008** - Mọi giao diện phát âm đều tuân thủ Điều I Hiến pháp (dùng `audioUrl` tĩnh, không lưu Blob/Base64) và có cơ chế dự phòng Web Speech API (`1.0×` / `0.7×`) khi thiếu tệp âm thanh? `[Resilience, Plan §R5, Spec §Edge Cases]`

## 3. Từ điển, Lịch sử, Hồ sơ, Thông báo & Tiện ích v1 (`US-4`–`US-7`)

- [x] **CHK009** - Yêu cầu tra cứu Từ điển Oxford 3000 (`< 300ms` kèm điều kiện đo rõ ràng, tiếng Việt không dấu, lọc CEFR/Loại từ/Chủ đề, gợi ý lỗi chính tả, phím tắt `Ctrl/Cmd + K`) đã đầy đủ và đo được? `[Measurability, Spec §FR-009, SC-003]`
- [x] **CHK010** - Trang Lịch sử tách biệt nằm trên mục Trang cá nhân, tự động cập nhật sau mỗi bài học/phiên ôn, có chi tiết từ đúng/sai, nút ôn lại nhanh và giới hạn khung cuộn 10 phiên mới nhất? `[Completeness, Spec §FR-010, US-5]`
- [x] **CHK011** - Đồng bộ thông số toàn ứng dụng (XP, Streak, Tên, Ảnh đại diện, Thứ hạng nhóm) được đảm bảo sau mỗi thao tác nộp bài / cập nhật hồ sơ mà không cần tải lại trang? `[Consistency, Spec §FR-003, SC-004, Contracts §1]`
- [x] **CHK012** - Hành vi bản v1 của Trợ lý AI, Popup Hỗ trợ QTV, Bảng xếp hạng tuần và Sổ từ đã lưu được phân tách sạch qua tầng `services/adapters/` (không rò rỉ kiến trúc vào `spec.md`) để sẵn sàng nối `003-ai-chatbot` sau này? `[Architecture, Spec §FR-014, FR-016, Plan §R4]`

## 4. Trạng thái Giao diện, Đáp ứng & Chất lượng Kiểm thử

- [x] **CHK013** - Đầy đủ 3 trạng thái UI (`Skeleton/Loading`, `Empty State` có CTA, `Error State` cục bộ có nút *Thử lại*) và ma trận xử lý mã lỗi (`400`, `401`, `403`, `409`, `429`, `500/503`) được đặc tả rõ? `[Edge Case, Spec §FR-013, SC-007, Contracts §2]`
- [x] **CHK014** - Dải kích thước Responsive (`320px`, `768px`, `1280px`, `1440px+`) đồng nhất 100% giữa `Edge Cases`, `FR-013`, `SC-006`, `plan.md` và `quickstart.md`? `[Consistency, Spec §SC-006]`
- [x] **CHK015** - Mã số feature `004-frontend-webapp` và phạm vi `font-end/web/` khớp 100% với `001-vocabulary-data`, `002-backend-core` và không đụng chạm `back-end/`, `font-end/Dashboard/`, `font-end/testDashboard/`? `[Governance, Constitution §IV, §VI]`

---

**Kết luận Checklist**: **15/15 tiêu chí đạt (`[x]`)** — Toàn bộ `spec.md`, `plan.md`, `data-model.md`, `contracts/`, `quickstart.md` và `tasks.md` (`T001`–`T070`) đã hoàn tất đồng bộ, sẵn sàng chuyển sang triển khai (`speckit-implement`).
