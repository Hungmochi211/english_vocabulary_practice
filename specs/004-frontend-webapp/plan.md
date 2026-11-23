# Implementation Plan: Ứng dụng Web Học Từ Vựng Tiếng Anh Thông Minh (`004-frontend-webapp`)

**Branch**: `004-frontend-webapp` | **Date**: 2026-11-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-frontend-webapp/spec.md`

---

## Summary

Gói tính năng này xây dựng **ứng dụng web Frontend chính thức** bằng **React 19 + Vite 6 + TypeScript 5 + Tailwind CSS v4** đặt trong `font-end/web/` (giữ nguyên toàn vẹn các bản mẫu tĩnh `font-end/Dashboard/` và `font-end/testDashboard/`), bao phủ trọn vẹn 8 User Stories (`US-1` → `US-8`):
1. **Xác thực & Điều hướng phân quyền (`auth`, `router`)**: Đăng ký/Đăng nhập Email, Google OAuth 2.0, `GuestOnlyRoute` / `ProtectedRoute` / `AdminRoute`, Single-Flight Refresh Token Rotation trên Axios interceptor chống race condition `401`.
2. **Bảng điều khiển & Học 2 bước (`dashboard`, `courses`, `study`, `practice`)**: Trang chủ tổng quan đồng bộ thời gian thực qua TanStack Query invalidation, lộ trình CEFR `A1`–`B2`, Bước 1 Học nạp Flashcard 3D ghi nhận mở từng thẻ (`15–18` từ/bài), Bước 2 Luyện tập đa dạng (Trắc nghiệm 4 đáp án, Gõ từ, Nghe chép, Kiểm tra tổng hợp) với đo `responseTimeMs`, 4 trạng thái phản hồi trực quan và cổng mở khóa $\ge 80\%$.
3. **Ôn tập SM-2, Từ điển & Lịch sử (`review`, `dictionary`, `history`)**: Trung tâm ôn tập 4 chế độ + 5 Hộp Leitner, Từ điển Oxford 3000 (`Ctrl/Cmd + K`, tìm tiếng Việt không dấu, gợi ý Levenshtein, phát âm 2 tầng Audio URL + Web Speech API), trang Lịch sử tách biệt nằm trên Trang cá nhân với khung cuộn tối đa 10 phiên mới nhất và nút ôn lại nhanh.
4. **Hồ sơ, Thông báo, Tiện ích mở rộng & Quản trị (`profile`, `notifications`, `leaderboard`, `ai-chat`, `support`, `admin`)**: Quản lý hồ sơ & cài đặt nhắc học 20:00, Trung tâm Thông báo, Khu vực Quản trị viên (role `admin`), cùng lớp Adapter độc lập cho Bảng xếp hạng tuần, Sổ từ đã lưu, Trợ lý AI bản v1 và Popup Hỗ trợ QTV sẵn sàng nâng cấp nối API Backend (`003-ai-chatbot`).

Chi tiết quyết định kỹ thuật: [research.md](./research.md) · Kiểu dữ liệu & State: [data-model.md](./data-model.md) · Hợp đồng API: [contracts/frontend-api-contracts.md](./contracts/frontend-api-contracts.md) · Hướng dẫn chạy & kiểm chứng: [quickstart.md](./quickstart.md).

---

## Technical Context

**Language/Version**: TypeScript 5.x (`strict: true`) trên Node.js 22 LTS + React 19 + Vite 6.

**Primary Dependencies**:
- Core UI & Styling: `react`, `react-dom`, `tailwindcss` v4, `lucide-react`
- Routing: `react-router-dom` v7
- Data Fetching & Server State: `axios`, `@tanstack/react-query` v5
- Forms & Validation: `zod` (nhẹ, đồng nhất type-safe cho form Auth, Profile, Feedback)
- Testing: `vitest`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`, `msw`

**Storage**:
- Server State (nguồn sự thật chính): tiêu thụ qua RESTful API từ `001-vocabulary-data` & `002-backend-core` (cache trong bộ nhớ bởi TanStack Query).
- Client Persistence (phiên đăng nhập & tiện ích mở rộng v1 qua Adapter): `localStorage` có khóa phân phiên bản (`lexitag:v1:*`) kèm xử lý lỗi quota an toàn.

**Testing**:
- Unit Test (`vitest`): kiểm thử các hàm thuần (Single-Flight refresh queue, kẹp `responseTimeMs`, ánh xạ 4 trạng thái phản hồi, tìm kiếm tiếng Việt không dấu & gợi ý Levenshtein, tự sắp xếp Bảng xếp hạng, audio fallback).
- Integration / Component Test (`@testing-library/react` + `msw`): bao phủ toàn bộ kịch bản Given/When/Then của `US-1` → `US-8` (Auth guard, Học 2 bước chặn/mở khóa, Ôn tập SM-2, Tra từ `< 300ms`, Lịch sử cuộn 10 phiên, Bảng xếp hạng, Trợ lý AI v1, Hỗ trợ QTV, Phân quyền Admin và xử lý lỗi mạng).

**Target Platform**: Trình duyệt web hiện đại (Chrome, Edge, Safari, Firefox), responsive toàn dải `320px`, `768px`, `1280px` và `1440px+`.

**Project Type**: Frontend Single-Page Web Application (nằm hoàn toàn trong `font-end/web/`).

**Performance Goals**:
- Tìm kiếm & lọc Từ điển trên 3.813 từ phản hồi hiển thị **$< 300ms$** sau khi ngừng gõ (`SC-003`).
- Chuyển màn hình SPA mượt mà, tự động chia nhỏ bundle (lazy-load trang `Admin`, `AiChat`, `Dictionary`).
- Cập nhật đồng bộ XP, Streak, Leitner và Bảng xếp hạng ngay tức thì sau nộp bài (`SC-004`).

**Constraints**:
- Tuân thủ tuyệt đối 6 Điều khoản Hiến pháp [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) (`v2.0.0`).
- **Không chỉnh sửa** `back-end/`, `tools/`, `font-end/testDashboard/` hay phá vỡ `font-end/Dashboard/`.
- Không lưu hay hiển thị bí mật/mật khẩu rõ; chỉ phát âm từ `audioUrl` tĩnh (`VARCHAR(500)`) kèm dự phòng Web Speech API.
- Mọi request/response bám sát envelope `{ success, data, error }` của `001` & `002`.

**Scale/Scope**:
- 11 màn hình chính (Auth Login/Register, Trang chủ, Khóa học, Học thẻ Bước 1, Luyện tập Bước 2, Ôn tập SM-2, Tra từ, Trợ lý AI, Lịch sử, Hồ sơ cá nhân, Quản trị viên) + 3 thành phần toàn cục (Trung tâm Thông báo, Popup Hỗ trợ QTV, Thanh tìm kiếm nhanh `Ctrl/Cmd + K`), phục vụ tập dữ liệu 3.813 từ Oxford 3000.

---

## Constitution Check

*GATE: Đánh giá cả trước Phase 0 và xác nhận lại sau Phase 1 design (`research.md`, `data-model.md`, `contracts/frontend-api-contracts.md`, `quickstart.md`).*

| Điều khoản Hiến pháp | Đánh giá & Bằng chứng Tuân thủ (Pre & Post Design) | Kết quả |
| :--- | :--- | :---: |
| **I. Quy tắc & Dữ liệu từ Spec** | Toàn bộ 16 `FR`, 8 User Stories và 7 `SC` đã sạch 0 `[NEEDS CLARIFICATION]`; tôn trọng tuyệt đối 9 cột từ vựng Oxford 3000, chuỗi từ sạch và URL âm thanh tĩnh (`R5`). | ✅ **PASS** |
| **II. Chuẩn mực Sư phạm & Thuật toán** | `data-model.md` và `contracts/` khóa chặt luồng 2 bước (`POST /cards/:vocabId/open` $\rightarrow$ `acquisitionCompleted` $\rightarrow$ `practice/start`), gửi `responseTimeMs` cho SM-2, hiển thị đủ 4 phân loại chấm điểm đúng `grading_status_enum` của `002` (`exact`, `near_match` cho từ $\ge 3$ ký tự, `phonetic_match`, `incorrect`) và cổng mở khóa $\ge 80\%$. | ✅ **PASS** |
| **III. Test trước (Given/When/Then - TDD)** | `research.md` R7 chốt bộ `vitest` + `@testing-library/react` + `msw`, lập kế hoạch test tự động bao phủ 100% kịch bản Given/When/Then của `US-1`–`US-8` và các trường hợp biên trước khi hoàn tất triển khai. | ✅ **PASS** |
| **IV. Hợp đồng API & Kiến trúc** | Dùng đúng stack Hiến pháp **ReactJS (Vite) + TailwindCSS + TypeScript** (`R1`); toàn bộ API tiêu thụ được ánh xạ trong `contracts/frontend-api-contracts.md` theo đúng envelope `{ success, data, error }`; Trợ lý AI bản v1 tách sau `AiTutorAdapter` tôn trọng ranh giới AI Level 2 (`003-ai-chatbot`). | ✅ **PASS** |
| **V. Bảo mật & Đơn giản trước** | Cấu hình qua `.env` (`VITE_*`), không hardcode secret; bảo vệ Route theo JWT + Role Guard (`AdminRoute`); tự động thoát ký tự đặc biệt (chống XSS mặc định của React + renderer an toàn cho AI Chat); chọn TanStack Query thay Redux để đơn giản và dễ bảo trì. | ✅ **PASS** |
| **VI. Cộng tác & Quản lý Task** | Toàn bộ mã nguồn Frontend chính thức đặt gọn trong `font-end/web/`, tách biệt hoàn toàn với `back-end/`, `tools/` và giữ nguyên bản mẫu `font-end/Dashboard/`, `font-end/testDashboard/`. | ✅ **PASS** |

**Post-Design Gate Result**: ✅ **PASS** — Toàn bộ tài liệu `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`, `checklists/` (`requirements.md`, `frontend.md`) và `tasks.md` đã hoàn tất và tuân thủ 100% Hiến pháp `v2.0.0`, sẵn sàng triển khai (`speckit-implement`).

---

## Project Structure

### Documentation (this feature)

```text
specs/004-frontend-webapp/
├── spec.md                              # Đặc tả 8 User Stories, FR-001..016, SC-001..007 (Approved)
├── plan.md                              # Kế hoạch kỹ thuật & Constitution Check (File này)
├── research.md                          # Quyết định kỹ thuật R1–R7
├── data-model.md                        # TypeScript DTOs, State Transitions & Adapter Models
├── quickstart.md                        # Hướng dẫn cài đặt, chạy dev/test & kịch bản E2E
├── contracts/
│   └── frontend-api-contracts.md        # Bảng ánh xạ API 001/002, Error Matrix & Adapter Interfaces
├── checklists/
│   ├── requirements.md                  # Checklist kiểm định chất lượng spec (16/16 ĐẠT)
│   └── frontend.md                      # Checklist chất lượng thiết kế Frontend (15/15 ĐẠT)
└── tasks.md                             # Danh sách 70 tasks (T001–T070) chia 11 Phases (Đã hoàn tất)
```

### Source Code (repository root)

```text
font-end/
├── Dashboard/                           # Bản mẫu tĩnh tham chiếu (giữ nguyên)
├── testDashboard/                       # Bản mẫu gốc của nhóm (giữ nguyên)
└── web/                                 # Ứng dụng React + Vite + Tailwind + TypeScript chính thức
    ├── index.html
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── .env.example
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx
    │   ├── styles/
    │   │   └── tokens.css               # Hệ màu dịu LexiTag & Tailwind v4 theme
    │   ├── app/
    │   │   ├── router.tsx               # Route tree + GuestOnlyRoute, ProtectedRoute, AdminRoute
    │   │   ├── queryClient.ts           # TanStack Query cấu hình retry & staleTime
    │   │   └── AuthProvider.tsx         # Phiên đăng nhập & đồng bộ thông tin User
    │   ├── services/
    │   │   ├── api/
    │   │   │   ├── httpClient.ts        # Axios instance + envelope unwrap + Single-Flight refresh queue
    │   │   │   ├── auth.api.ts
    │   │   │   ├── users.api.ts
    │   │   │   ├── vocabulary.api.ts
    │   │   │   ├── learning.api.ts
    │   │   │   ├── review.api.ts
    │   │   │   ├── stats.api.ts
    │   │   │   └── admin.api.ts
    │   │   └── adapters/
    │   │       ├── savedWords.adapter.ts
    │   │       ├── history.adapter.ts
    │   │       ├── leaderboard.adapter.ts
    │   │       ├── aiTutor.adapter.ts
    │   │       ├── notifications.adapter.ts
    │   │       └── support.adapter.ts
    │   ├── hooks/
    │   │   ├── useVocabularyAudio.ts    # Audio URL tĩnh + Web Speech API fallback (1.0x / 0.7x)
    │   │   └── useKeyboardShortcuts.ts  # Ctrl/Cmd+K, Space, Enter, 1-4
    │   ├── components/
    │   │   ├── layout/                  # AppShell, Sidebar (Drawer mobile), Topbar, NotificationBell
    │   │   ├── common/                  # Skeleton, EmptyState, ErrorRetryBox, ConfirmModal, Toast
    │   │   └── support/                 # FloatingSupportWidget (4 kênh + Chat QTV + Góp ý)
    │   ├── features/
    │   │   ├── auth/                    # LoginPage, RegisterPage, GoogleSignInButton
    │   │   ├── dashboard/               # DashboardPage, DailyGoalRing, StatsCards, SrsWidget, WeeklyLeaderboard
    │   │   ├── courses/                 # CoursesRoadmapPage, LessonStudyPage (Bước 1), LessonPracticePage (Bước 2)
    │   │   ├── review/                  # ReviewCenterPage (4 chế độ + 5 Hộp Leitner + Mixed Quiz)
    │   │   ├── dictionary/              # DictionaryPage (Search, Filter, Fuzzy Suggest, Detail, Saved Words)
    │   │   ├── ai-chat/                 # AiChatPage (Multi-conversation, Quick Prompts, Oxford v1)
    │   │   ├── history/                 # HistoryPage (4 KPIs, Filter, 10-row Scrollable Drawer, Quick Retry)
    │   │   ├── profile/                 # ProfilePage (Edit Profile, Avatar, Change Password, Reminder 20:00, Logout)
    │   │   └── admin/                   # AdminDashboardPage, AdminUsersTable, AdminAuditLogsPage
    │   └── utils/
    │       ├── formatters.ts            # Format XP, initials, diacritic stripping, clamp responseTimeMs
    │       ├── fuzzySearch.ts           # Levenshtein suggestions cho tra từ điển
    │       └── gradingFeedback.ts       # Ánh xạ 4 trạng thái chấm điểm sang màu & nhãn tiếng Việt
    └── tests/
        ├── setup.ts                     # Vitest + Testing Library + MSW server
        ├── mocks/
        │   └── handlers.ts              # MSW handlers khớp 100% OpenAPI 001 & 002
        ├── unit/                        # Test thuần: httpClient refresh queue, fuzzySearch, formatters, leaderboard sort
        └── integration/                 # Test Given/When/Then cho US-1 → US-8
```

**Structure Decision**: Chọn cấu trúc **Feature-based SPA (`font-end/web/src/features/*`)** tách riêng tầng `services/api/` (nối thẳng `001` & `002`) và `services/adapters/` (các tiện ích v1 có thể thay nóng bằng API tương lai). Cấu trúc này tuân thủ tuyệt đối Điều IV & VI Hiến pháp, giữ nguyên các bản mẫu tham chiếu `font-end/Dashboard/` và `font-end/testDashboard/`.

---

## Complexity Tracking

*Không có vi phạm Hiến pháp cần giải trình. Toàn bộ thư viện phụ trợ (`react-router-dom`, `axios`, `@tanstack/react-query`, `zod`, `lucide-react`, `vitest`, `msw`) đều là bộ công cụ tối giản, tiêu chuẩn của hệ sinh thái React + Vite và hoàn toàn độc lập với `back-end/`.*
