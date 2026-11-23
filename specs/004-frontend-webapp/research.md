# Technical Research & Decisions: Ứng dụng Web Học Từ Vựng Tiếng Anh Thông Minh (`004-frontend-webapp`)

**Feature**: `004-frontend-webapp` | **Date**: 2026-11-23 | **Spec**: [spec.md](./spec.md)

Mục tiêu của tài liệu này là chốt toàn bộ quyết định công nghệ, thư viện phụ trợ và mẫu kiến trúc Frontend tuân thủ Hiến pháp dự án (`.specify/memory/constitution.md` v2.0.0) và tương thích 100% với hợp đồng API từ `001-vocabulary-data` và `002-backend-core`.

---

## R1: Core Stack & Vị trí Mã nguồn Frontend

- **Decision**: Sử dụng **React 19 + Vite 6 + TypeScript 5 (strict mode) + Tailwind CSS v4**, đặt toàn bộ ứng dụng web chính thức tại **`font-end/web/`**.
- **Rationale**:
  - Khớp chính xác Điều IV Hiến pháp (`ReactJS (Vite), TailwindCSS, TypeScript`) và Điều VI (toàn bộ Frontend nằm trong `font-end/`).
  - Đặt trong `font-end/web/` giữ nguyên 100% hai bản mẫu tĩnh tham chiếu (`font-end/Dashboard/` và `font-end/testDashboard/`) mà nhóm đã xây, tránh xung đột file khi nhiều thành viên cùng làm việc.
  - Vite cho tốc độ khởi động dev server dưới 500ms, build gọn nhẹ, cấu hình đơn giản cho sinh viên bảo vệ đồ án.
- **Alternatives considered**:
  - *Next.js (App Router)*: Bị loại vì trái với quyết định đã chốt trong `constitution.md` (Điều IV chọn ReactJS + Vite) và không cần SSR cho ứng dụng học tập phía sau màn hình đăng nhập.
  - *Cài trực tiếp `package.json` ở gốc `font-end/`*: Bị loại vì dễ lẫn lộn với `font-end/Dashboard/` và `font-end/testDashboard/`.

---

## R2: Điều hướng & Phân quyền Route (`react-router-dom`)

- **Decision**: Sử dụng **`react-router-dom` v7** kết hợp 3 lớp Route Guard:
  - `GuestOnlyRoute`: `/login`, `/register` (đã đăng nhập sẽ tự về `/`).
  - `ProtectedRoute`: `/`, `/courses`, `/courses/:lessonId/study`, `/courses/:lessonId/practice`, `/review`, `/dictionary`, `/ai-chat`, `/history`, `/profile` (chưa đăng nhập tự chuyển `/login?redirect=<path>`).
  - `AdminRoute`: `/admin`, `/admin/users`, `/admin/audit-logs` (kiểm tra `user.role === 'admin'`; Học viên truy cập trực tiếp bị chặn và chuyển về `/` kèm thông báo không có quyền).
- **Rationale**: Phù hợp tuyệt đối với React + Vite SPA, hỗ trợ deep-link, quay lại đúng trang sau khi đăng nhập (`US-1 AS-4`) và tách bạch tuyệt đối giao diện Quản trị viên (`US-8 AS-4`).
- **Alternatives considered**:
  - *Chuyển tab bằng `window.location.hash` như bản mẫu tĩnh*: Bị loại vì khó quản lý tham số động (`:lessonId`), không hỗ trợ code-splitting theo trang và khó kiểm soát Route Guard phân quyền.

---

## R3: Giao tiếp API, Gia hạn Token & Đồng bộ Trạng thái (`axios` + `@tanstack/react-query`)

- **Decision**: Kết hợp **`axios`** (HTTP client tập trung) và **`@tanstack/react-query` v5** (Server State & Cache Synchronization).
- **Rationale**:
  - **Axios Interceptor chuẩn hóa Envelope**: Tự động mở bọc `{ success: true, data, error: null }` và ánh xạ lỗi `{ success: false, data: null, error: { code, message, details } }` sang một lớp `ApiError` thống nhất.
  - **Single-Flight Refresh Token Queue**: Khi nhiều request đồng thời nhận `401 Unauthorized` (Access Token hết hạn 15 phút), chỉ gửi **đúng 1 yêu cầu** `POST /auth/refresh`, đưa các request còn lại vào hàng đợi và phát lại tự động khi có token mới — tránh lỗi Reuse Detection (`session_family_id`) trên Backend `002-backend-core`. Nếu refresh thất bại, tự xóa phiên và điều hướng `/login`.
  - **TanStack Query Invalidation (`US-2`, `US-3`, `US-6`, `SC-004`)**: Sau khi `POST /learning/quizzes/:attemptId/submit` hoặc `PATCH /users/me` thành công, gọi `queryClient.invalidateQueries` cho `['stats', 'overview']`, `['learning', 'lessons']`, `['reviews', 'due']`, `['users', 'me']` → toàn bộ XP, Streak, 5 Hộp Leitner, mở khóa bài học và Bảng xếp hạng tự động cập nhật đồng bộ ngay lập tức không cần F5.
- **Alternatives considered**:
  - *`fetch` thuần + `useEffect` thủ công*: Bị loại vì dễ phát sinh race condition khi refresh token song song, lặp nhiều boilerplate quản lý trạng thái `loading / error / retry` và đồng bộ cache giữa nhiều màn hình.
  - *Redux Toolkit*: Bị loại theo Nguyên tắc V (*Đơn giản trước*) vì phần lớn dữ liệu của ứng dụng là Server State.

---

## R4: Kiến trúc Adapter cho Tiện ích Mở rộng v1 & Trợ lý AI

- **Decision**: Định nghĩa các **Provider Interface độc lập** trong `src/services/adapters/` cho những tính năng chưa có endpoint riêng ở `002-backend-core`:
  - `SavedWordsProvider` (Sổ từ đã lưu trong Tra từ & Ôn tập)
  - `ActivityHistoryProvider` (Lịch sử chi tiết từng từ của mỗi phiên học/ôn)
  - `LeaderboardProvider` (Bảng xếp hạng tuần tự sắp xếp theo XP hiện tại của người học + modal nhóm + hồ sơ công khai)
  - `AiTutorProvider` (Trợ lý AI bản v1 truy vấn kho Oxford 3000 cục bộ + lưu nhiều hội thoại; sẵn sàng đổi implementation sang API của `003-ai-chatbot`)
  - `NotificationProvider` & `SupportProvider` (Trung tâm Thông báo & Popup Hỗ trợ QTV)
- **Rationale**:
  - Mỗi Provider có phiên bản khóa lưu trữ riêng trên `localStorage` (kèm bọc `try/catch` chống đầy quota hoặc chế độ ẩn danh).
  - Giao diện React chỉ gọi qua interface / custom hook (`useSavedWords`, `useHistory`, `useLeaderboard`, `useAiChat`), nên khi Backend bổ sung API mới (như `003-ai-chatbot`), chỉ cần thay đúng 1 file provider mà **không sửa 1 dòng JSX nào**.
- **Alternatives considered**:
  - *Gọi `localStorage` trực tiếp trong từng Component*: Bị loại vì khó viết Unit Test và khó nâng cấp sang API Backend sau này.

---

## R5: Phát âm thanh Từ vựng & Dự phòng An toàn

- **Decision**: Xây dựng hook dùng chung `useVocabularyAudio()` theo cơ chế 2 tầng:
  1. Nếu `vocabulary.audioUrl` tồn tại và hợp lệ: phát bằng phần tử `HTMLAudioElement` (`playbackRate = 1.0` hoặc `0.7` cho chế độ nghe chậm).
  2. Nếu `audioUrl` rỗng hoặc lỗi tải mạng: tự động dự phòng bằng **Web Speech API** (`window.speechSynthesis`, hỗ trợ chọn giọng `en-US` / `en-GB` và tốc độ `1.0×` / `0.7×`); nếu trình duyệt không hỗ trợ, hiển thị toast thân thiện mà không gây lỗi trang.
- **Rationale**: Tuân thủ Điều I Hiến pháp (chỉ dùng URL tĩnh từ Backend, không dùng Blob/Base64) đồng thời đảm bảo bài tập Nghe chép chính tả và Tra từ luôn hoạt động mượt trên mọi máy kiểm thử.
- **Alternatives considered**:
  - *Chỉ dùng `<audio>` không có dự phòng*: Bị loại vì các từ chưa có file `.mp3` tĩnh sẽ không phát được âm thanh trong bài Dictation.

---

## R6: Hệ thống Giao diện, Biểu tượng & Đáp ứng Đa màn hình

- **Decision**:
  - Tái sử dụng hệ biến màu dịu mắt (Slate / Indigo / Soft Amber / Soft Green / Soft Rose) và bố cục từ bản mẫu `font-end/Dashboard/style.css`, chuẩn hóa thành CSS variables + utility classes của **Tailwind CSS v4**.
  - Dùng **`lucide-react`** cho hệ thống icon nhẹ, đồng nhất, hỗ trợ tree-shaking và hiển thị cả khi mất mạng (không phụ thuộc Google Fonts CDN icon).
  - Responsive mobile-first kiểm chứng tại 4 mốc chuẩn: **`320px`, `768px`, `1280px`, `1440px+`** (sidebar tự thu gọn thành Drawer ở `< 1024px`).
- **Rationale**: Giữ đúng thẩm mỹ đã được người dùng duyệt ở bản mẫu `font-end/Dashboard/`, đồng thời đảm bảo tốc độ tải nhanh và không lỗi icon khi test offline.
- **Alternatives considered**:
  - *Cài bộ UI nặng như Ant Design / MUI*: Bị loại vì tăng bundle size lớn và làm lệch phong cách tinh gọn của LexiTag Learning Lab.

---

## R7: Chiến lược Kiểm thử Tự động (TDD theo Điều III Hiến pháp)

- **Decision**: Sử dụng **`vitest` + `@testing-library/react` + `@testing-library/user-event` + `@testing-library/jest-dom` + `msw` (Mock Service Worker)**.
- **Rationale**:
  - `vitest` chạy chung cấu hình Vite + TypeScript cực nhanh, cú pháp tương đồng `jest` mà Backend `002-backend-core` đang dùng.
  - `msw` chặn ở tầng mạng thực sự theo đúng hợp đồng `openapi.yaml` của `001` & `002` (bao gồm giả lập lỗi `401`, `403 ACCOUNT_DISABLED`, `429`, `500` và refresh token rotation) mà không cần chạy Docker Backend khi chạy CI unit/integration test.
  - Bao phủ 100% kịch bản Given/When/Then của cả 8 User Stories (`US-1` → `US-8`) và các helper thuần (chuẩn hóa tiếng Việt không dấu, Levenshtein gợi ý tra từ, tự sắp xếp Bảng xếp hạng, đo `responseTimeMs` kẹp trong `[0, 300000]`).
- **Alternatives considered**:
  - *Jest + ts-jest*: Bị loại vì tốn công cấu hình lại ESM/Vite alias/Tailwind, chậm hơn Vitest trên dự án Vite.
