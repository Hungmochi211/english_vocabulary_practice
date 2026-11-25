# Tasks: Ứng dụng Web Học Từ Vựng Tiếng Anh Thông Minh (`004-frontend-webapp`)

**Input**: Design documents from `/specs/004-frontend-webapp/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/frontend-api-contracts.md](./contracts/frontend-api-contracts.md), [quickstart.md](./quickstart.md)

**Tests**: Bắt buộc theo Nguyên tắc III của Hiến pháp (`.specify/memory/constitution.md`): mỗi kịch bản nghiệm thu Given/When/Then trong `spec.md` phải có test tự động tương ứng viết trước (TDD Red $\rightarrow$ Green) bằng `vitest` + `@testing-library/react` + `msw`.

**Organization**: Các task được tổ chức theo từng giai đoạn (Phase) và nhóm theo 8 User Stories độc lập (`US1` → `US8`), đảm bảo có thể triển khai và kiểm thử từng lát cắt độc lập trong `font-end/web/` (giữ nguyên hoàn toàn `font-end/Dashboard/`, `font-end/testDashboard/` và `back-end/`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Có thể chạy song song (khác file, không phụ thuộc lẫn nhau)
- **[Story]**: Ánh xạ User Story trong `spec.md` (`US1`..`US8`)
- Mọi đường dẫn dưới đây đều tương đối tính từ gốc repository (`english_vocabulary_practice/`).

---

## Phase 1: Setup (Khởi tạo dự án `font-end/web/`)

**Purpose**: Khởi tạo khung ứng dụng React 19 + Vite 6 + TypeScript 5 + Tailwind CSS v4 và môi trường test Vitest + MSW.

- [x] T001 Khởi tạo cấu trúc thư mục `font-end/web/` và `font-end/web/package.json` với dependencies (`react`, `react-dom`, `react-router-dom`, `axios`, `@tanstack/react-query`, `zod`, `lucide-react`) và devDependencies (`vite`, `typescript`, `tailwindcss`, `vitest`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`, `msw`)
- [x] T002 [P] Cấu hình TypeScript strict mode tại `font-end/web/tsconfig.json`, Vite + Vitest tại `font-end/web/vite.config.ts` và biến môi trường mẫu tại `font-end/web/.env.example`
- [x] T003 [P] Cấu hình hệ biến màu LexiTag (tái sử dụng bảng màu dịu từ `font-end/Dashboard/style.css`) và Tailwind CSS v4 tại `font-end/web/src/styles/tokens.css` và `font-end/web/index.html`
- [x] T004 [P] Thiết lập môi trường test `font-end/web/tests/setup.ts` và bộ MSW handlers cơ sở khớp OpenAPI `001` & `002` tại `font-end/web/tests/mocks/handlers.ts`
- [x] T005 Cấu hình scripts `dev`, `build`, `typecheck`, `test`, `test:watch`, `test:coverage` trong `font-end/web/package.json` và xác nhận `npm run typecheck` + `npm run test` chạy thông

---

## Phase 2: Foundational (Hạ tầng lõi — Chặn tất cả User Stories)

**Purpose**: Xây dựng hạ tầng chung (DTO types, HTTP client + Single-Flight refresh queue, TanStack QueryClient, AppShell responsive, UI States dùng chung và Audio/Shortcut hooks) trước khi bắt đầu bất kỳ User Story nào.

**⚠️ CRITICAL**: Không bắt đầu triển khai `US1`–`US8` trước khi hoàn thành Phase 2.

- [x] T006 [P] Định nghĩa toàn bộ TypeScript DTOs & Envelope (`ApiResponse`, `UserProfile`, `VocabularyItem`, `LessonProgressItem`, `QuizAttemptStart`, `QuizSubmitResult`, `StatsOverview`, `AdminUserRow`, Adapter models) tại `font-end/web/src/types/models.ts` theo `data-model.md`
- [x] T007 [P] Viết Unit Test TDD cho HTTP Client (mở bọc envelope `{ success, data, error }`, Single-Flight Refresh Token Queue chống gửi trùng `POST /auth/refresh` khi nhiều request dính `401`, xử lý `403 ACCOUNT_DISABLED`) tại `font-end/web/tests/unit/httpClient.test.ts`
- [x] T008 Cài đặt Axios `httpClient` + interceptors + Single-Flight Refresh Queue tại `font-end/web/src/services/api/httpClient.ts` (đạt pass `T007`)
- [x] T009 [P] Cấu hình TanStack `queryClient` và hàm tiện ích `invalidateLearningCaches()` tại `font-end/web/src/app/queryClient.ts`
- [x] T010 [P] Cài đặt hàm tiện ích thuần (`formatXp`, `getInitials`, `stripVietnameseDiacritics`, `clampResponseTimeMs`) và Unit Test tại `font-end/web/src/utils/formatters.ts` và `font-end/web/tests/unit/formatters.test.ts`
- [x] T011 [P] Cài đặt hook phát âm 2 tầng (Audio URL tĩnh + Web Speech API fallback `en-US`/`en-GB`, tốc độ `1.0×`/`0.7×`) và Unit Test tại `font-end/web/src/hooks/useVocabularyAudio.ts` và `font-end/web/tests/unit/useVocabularyAudio.test.ts`
- [x] T012 [P] Cài đặt hook phím tắt toàn cục (`Ctrl/Cmd + K`, `Space`, `Enter`, `1`–`4`, `Esc`) tại `font-end/web/src/hooks/useKeyboardShortcuts.ts`
- [x] T013 [P] Tạo bộ component UI dùng chung (`Skeleton`, `EmptyState`, `ErrorRetryBox`, `ConfirmModal`, `ToastProvider`) tại `font-end/web/src/components/common/`
- [x] T014 Tạo khung bố cục `AppShell` gồm `Sidebar` (thứ tự menu: *Trang chủ → Khóa học → Ôn tập → Tra từ → Trợ lý AI → Lịch sử → Trang cá nhân*, kèm mục *Quản trị* ẩn với Học viên; tự thu thành Drawer `< 1024px`) và `Topbar` (tìm nhanh, Streak pill, XP pill đồng bộ, nút Thông báo, Avatar) tại `font-end/web/src/components/layout/`

**Checkpoint**: Hạ tầng sẵn sàng — có thể triển khai song song hoặc tuần tự các User Stories.

---

## Phase 3: User Story 1 — Xác thực Tài khoản & Bảo vệ Phiên học (Priority: P1) 🎯 MVP

**Goal**: Cho phép đăng ký, đăng nhập Email/Mật khẩu, đăng nhập Google OAuth 2.0, bảo vệ đường dẫn riêng tư và đăng xuất có xác nhận.

**Independent Test**: Chạy `font-end/web/tests/integration/auth.test.tsx` xác minh đủ 5 Acceptance Scenarios của `US1` (đăng ký, báo lỗi sai mật khẩu/tài khoản bị khóa, Google OAuth, redirect chưa đăng nhập, đăng xuất xóa sạch phiên).

### Tests for User Story 1 ⚠️

> **NOTE: Viết test FAIL trước khi cài đặt UI/Service**

- [x] T015 [P] [US1] Viết Integration Test (Vitest + RTL + MSW) cho đủ 5 kịch bản Given/When/Then của `US1` tại `font-end/web/tests/integration/auth.test.tsx`

### Implementation for User Story 1

- [x] T016 [P] [US1] Tạo service gọi API xác thực (`POST /auth/register`, `/auth/login`, `/auth/google`, `/auth/refresh`, `/auth/logout`, `/auth/change-password`) tại `font-end/web/src/services/api/auth.api.ts`
- [x] T017 [US1] Cài đặt `AuthProvider` quản lý phiên đăng nhập, lưu token an toàn và cung cấp `useAuth()` tại `font-end/web/src/app/AuthProvider.tsx`
- [x] T018 [US1] Cài đặt Route Tree và 3 lớp Guard (`GuestOnlyRoute`, `ProtectedRoute`, `AdminRoute`) tại `font-end/web/src/app/router.tsx`
- [x] T019 [P] [US1] Xây dựng màn hình `LoginPage` (Email/Mật khẩu + nút Google OAuth 2.0 + validate `zod` + hiển thị lỗi `401`/`403 ACCOUNT_DISABLED`/`429`) tại `font-end/web/src/features/auth/LoginPage.tsx`
- [x] T020 [P] [US1] Xây dựng màn hình `RegisterPage` (Họ tên, Email, Mật khẩu $\ge 8$ ký tự, Xác nhận mật khẩu) và hộp thoại xác nhận Đăng xuất tại `font-end/web/src/features/auth/RegisterPage.tsx` và `font-end/web/src/features/auth/LogoutModal.tsx`

**Checkpoint**: `US1` chạy độc lập và pass 100% `auth.test.tsx`.

---

## Phase 4: User Story 2 — Bảng điều khiển Tổng quan & Lộ trình Học 2 Bước (Priority: P1) 🎯 MVP

**Goal**: Hiển thị Trang chủ tổng quan đồng bộ XP/Streak/Mục tiêu ngày, Lộ trình Khóa học CEFR `A1`–`B2`, Bước 1 Học nạp Flashcard 3D (mở đủ 100% thẻ) và Bước 2 Luyện tập với cổng mở khóa $\ge 80\%$.

**Independent Test**: Chạy `font-end/web/tests/integration/learning-flow.test.tsx` kiểm chứng mở Bài 1, bị chặn Bước 2 khi mới mở 10/16 thẻ, mở khóa Bước 2 khi đủ 16/16 thẻ, nộp `< 80%` giữ khóa Bài 2 và nộp $\ge 80\%$ mở khóa Bài 2 + đồng bộ XP/Streak.

### Tests for User Story 2 ⚠️

- [x] T021 [P] [US2] Viết Integration Test cho Trang chủ + Chu trình 2 bước (mở thẻ Bước 1, cổng chặn chưa đủ thẻ, ngưỡng mở khóa `< 80%` vs $\ge 80\%$, đồng bộ XP/Streak) tại `font-end/web/tests/integration/learning-flow.test.tsx`

### Implementation for User Story 2

- [x] T022 [P] [US2] Tạo API services `font-end/web/src/services/api/stats.api.ts` (`GET /stats/overview`) và `font-end/web/src/services/api/learning.api.ts` (`GET /learning/lessons`, `POST /cards/:id/open`, `POST /practice/start`, `POST /quizzes/:id/submit`)
- [x] T023 [P] [US2] Tạo API service `font-end/web/src/services/api/vocabulary.api.ts` (`GET /topics`, `GET /lessons`, `GET /lessons/:id`, `GET /vocabularies/:id`, `GET /vocabularies/search`)
- [x] T024 [US2] Xây dựng `DashboardPage` gồm Hero Banner, Vòng tiến độ Mục tiêu ngày, 4 thẻ chỉ số đồng bộ (Từ đã thuộc, Phát âm AI, Streak, Tổng XP), Khóa học đang học và Hộp nhắc SRS đến hạn tại `font-end/web/src/features/dashboard/DashboardPage.tsx`
- [x] T025 [US2] Xây dựng `CoursesRoadmapPage` lọc theo 4 cấp độ CEFR (`A1`–`B2`) & 16 chủ đề, hiển thị trạng thái mở khóa (`isUnlocked`), tiến độ mở thẻ và điểm cao nhất (`bestScore`) tại `font-end/web/src/features/courses/CoursesRoadmapPage.tsx`
- [x] T026 [US2] Xây dựng màn hình Bước 1 `LessonStudyPage` (Thẻ Flashcard 3D 2 mặt, từ sạch, nhãn loại từ Multi-POS, IPA, phát âm `1.0×`/`0.7×`, câu ví dụ tô nổi từ khóa, gọi `POST /cards/:vocabId/open`, thanh tiến độ `openedCount/wordCount` và cổng khóa nút Bước 2) tại `font-end/web/src/features/courses/LessonStudyPage.tsx`
- [x] T027 [US2] Xây dựng màn hình Bước 2 `LessonPracticePage` (đo `responseTimeMs` từng câu, nộp `POST /learning/quizzes/:attemptId/submit`, màn hình tổng kết Đạt $\ge 80\%$ mở khóa bài kế tiếp / Chưa đạt liệt kê từ sai kèm nút làm lại) tại `font-end/web/src/features/courses/LessonPracticePage.tsx`
- [x] T028 [US2] Kết nối tự động làm mới cache TanStack Query (`stats/overview`, `learning/lessons`, `reviews/due`) sau khi hoàn tất Bước 1 & nộp Bước 2 để đồng bộ toàn ứng dụng không cần F5

**Checkpoint**: Hoàn tất lõi MVP Học 2 bước; pass 100% `learning-flow.test.tsx`.

---

## Phase 5: User Story 3 — Luyện tập Đa chế độ & Ôn tập Ngắt quãng SM-2 (Priority: P1) 🎯 MVP

**Goal**: Cung cấp Trung tâm Ôn tập với 4 chế độ (Thẻ SM-2, Trắc nghiệm 4 đáp án, Gõ từ, Nghe chép chính tả), hiển thị 5 Hộp Leitner và 4 phân loại phản hồi chấm điểm đồng nhất `002-backend-core` (bao gồm giới hạn $\ge 3$ ký tự cho *"Gần đúng"*).

**Independent Test**: Chạy `font-end/web/tests/unit/gradingFeedback.test.ts` và `font-end/web/tests/integration/review-center.test.tsx` xác minh đủ 4 trạng thái chấm điểm (gồm cả từ ngắn `go` → `do` trả *"Chưa đúng"*), 5 Hộp Leitner và Kiểm tra tổng hợp.

### Tests for User Story 3 ⚠️

- [x] T029 [P] [US3] Viết Unit Test TDD cho ánh xạ 4 phân loại chấm điểm đúng `grading_status_enum` (`exact`, `near_match` chỉ cho từ dài $\ge 3$ ký tự, `phonetic_match`, `incorrect` bao gồm từ ngắn $< 3$ ký tự như `go` vs `do`) tại `font-end/web/tests/unit/gradingFeedback.test.ts`
- [x] T030 [P] [US3] Viết Integration Test cho `US3` (xem từ đến hạn SM-2, 5 Hộp Leitner, 4 chế độ luyện tập, phím tắt `Space`/`1`–`4`/`Enter`, phản hồi `paeceful` → Gần đúng, `go`/`do` → Chưa đúng, `fone` → Đúng âm sai chữ, nộp bài cập nhật Leitner & XP) tại `font-end/web/tests/integration/review-center.test.tsx`

### Implementation for User Story 3

- [x] T031 [P] [US3] Tạo API service ôn tập (`GET /reviews/due`, `POST /reviews/session/start`, `POST /learning/quizzes/mixed/start`) tại `font-end/web/src/services/api/review.api.ts`
- [x] T032 [P] [US3] Cài đặt module ánh xạ hiển thị 4 phân loại phản hồi chấm điểm (`exact` xanh lá, `near_match` vàng/cam cho từ $\ge 3$ ký tự, `phonetic_match` xanh dương, `incorrect` đỏ) tại `font-end/web/src/utils/gradingFeedback.ts`
- [x] T033 [US3] Xây dựng thành phần 5 Hộp Leitner tương tác (`LeitnerBoxesBar`) và khung chọn chế độ/nguồn từ tại `font-end/web/src/features/review/LeitnerBoxesBar.tsx`
- [x] T034 [P] [US3] Xây dựng 4 thành phần chế độ làm bài (`SrsFlashcardStage`, `QuizQuestionStage`, `TypingQuestionStage`, `DictationQuestionStage`) có đo `responseTimeMs`, gợi ý chữ cái và phát âm US/UK `1.0×`/`0.7×` tại `font-end/web/src/features/review/modes/`
- [x] T035 [US3] Xây dựng trang `ReviewCenterPage` tích hợp 4 chế độ, Bài kiểm tra tổng hợp (Mixed Quiz), đồng hồ phiên và màn hình tổng kết + nút *"Ôn lại các từ sai"* tại `font-end/web/src/features/review/ReviewCenterPage.tsx`
- [x] T036 [US3] Gắn phản hồi lỗi `409 ATTEMPT_ALREADY_SUBMITTED` và trạng thái trống khi không có từ đến hạn SM-2 (kèm CTA chuyển sang ôn Oxford 3000 hoặc Khóa học)

**Checkpoint**: Hoàn tất trọn bộ MVP P1 (`US1` + `US2` + `US3`).

---

## Phase 6: User Story 4 — Tra cứu Từ điển Oxford 3000 (Priority: P2)

**Goal**: Cho phép tra cứu nhanh 3.813 từ Oxford 3000 theo tiếng Anh và tiếng Việt không dấu, lọc đa tiêu chí (CEFR, loại từ, chủ đề), gợi ý sửa lỗi chính tả Levenshtein, phát âm 2 tốc độ và phím tắt `Ctrl/Cmd + K`.

**Independent Test**: Chạy `font-end/web/tests/integration/dictionary.test.tsx` kiểm tra tìm kiếm `< 300ms`, tìm tiếng Việt không dấu (`moi truong`), lọc CEFR/Loại từ/Chủ đề, gợi ý lỗi chính tả (`enviroment` → `environment`) và phím tắt `Ctrl+K`.

### Tests for User Story 4 ⚠️

- [x] T037 [P] [US4] Viết Unit Test cho tìm kiếm không dấu & gợi ý Levenshtein (`fuzzySearch`) tại `font-end/web/tests/unit/fuzzySearch.test.ts`
- [x] T038 [P] [US4] Viết Integration Test cho `US4` (ô tìm nhanh topbar + `Ctrl+K`, tìm Anh/Việt, lọc đa tiêu chí, bảng chi tiết tô nổi từ trong câu ví dụ, gợi ý lỗi chính tả) tại `font-end/web/tests/integration/dictionary.test.tsx`

### Implementation for User Story 4

- [x] T039 [P] [US4] Cài đặt tiện ích gợi ý chính tả Levenshtein (`computeSpellingSuggestions`) và tô nổi từ khóa trong câu ví dụ (`highlightWordInExample`) tại `font-end/web/src/utils/fuzzySearch.ts`
- [x] T040 [US4] Xây dựng `DictionaryPage` bố cục 2 cột (cột trái danh sách kết quả cuộn + tải thêm, cột phải bảng chi tiết cố định với IPA, CEFR, loại từ Multi-POS, chủ đề, phát âm US/UK `1.0×`/`0.7×`, từ cùng chủ đề & nút sao chép) tại `font-end/web/src/features/dictionary/DictionaryPage.tsx`
- [x] T041 [US4] Kết nối ô tìm kiếm nhanh trên `Topbar` (nhấn `Enter` hoặc `Ctrl/Cmd + K`) điều hướng thẳng tới `/dictionary?q=...`

**Checkpoint**: `US4` hoạt động độc lập và pass 100% test Từ điển.

---

## Phase 7: User Story 5 — Lịch sử Học tập chi tiết, Hồ sơ Cá nhân & Thông báo (Priority: P2)

**Goal**: Tách trang **Lịch sử** riêng (nằm ngay trên Trang cá nhân ở Sidebar, khung cuộn tối đa 10 phiên mới nhất, xem chi tiết từ đúng/sai & ôn lại nhanh), hoàn thiện trang **Hồ sơ cá nhân** và **Trung tâm Thông báo** tại nút chuông.

**Independent Test**: Chạy `font-end/web/tests/integration/history-profile-notif.test.tsx` xác nhận phiên ôn mới tự cập nhật lên đầu trang Lịch sử, khung giữ chiều cao cuộn 10 phiên, cập nhật hồ sơ/đổi mật khẩu đồng bộ toàn trang và chấm đỏ Thông báo tự ẩn khi đọc hết.

### Tests for User Story 5 ⚠️

- [x] T042 [P] [US5] Viết Integration Test cho `US5` (tự ghi nhận Lịch sử sau học/ôn, mở chi tiết từ đúng/sai, ôn lại phiên, cuộn 10 phiên, sửa Hồ sơ & Đổi mật khẩu, lọc & đánh dấu đã đọc Thông báo) tại `font-end/web/tests/integration/history-profile-notif.test.tsx`

### Implementation for User Story 5

- [x] T043 [P] [US5] Tạo API service `font-end/web/src/services/api/users.api.ts` (`GET /users/me`, `PATCH /users/me`)
- [x] T044 [P] [US5] Cài đặt Adapter lưu trữ `font-end/web/src/services/adapters/history.adapter.ts` và `font-end/web/src/services/adapters/notifications.adapter.ts` theo `contracts/frontend-api-contracts.md`
- [x] T045 [US5] Xây dựng `HistoryPage` (4 KPI tổng quan, tìm kiếm & lọc theo 6 loại hoạt động + kết quả $\ge 80\%$ / $< 80\%$, khung danh sách `.hs-list` cố định chiều cao 10 phiên có thanh cuộn, ngăn kéo chi tiết từng từ đúng/sai + nút *Ôn lại phiên này* / *Ôn các từ sai*) tại `font-end/web/src/features/history/HistoryPage.tsx`
- [x] T046 [US5] Xây dựng `ProfilePage` (chỉnh sửa họ tên, ảnh đại diện, mục tiêu CEFR, mục tiêu từ/ngày, bật/tắt email nhắc học 20:00, Đổi mật khẩu thu hồi phiên, thống kê Streak/CEFR/5 Hộp Leitner, nút *Xem lịch sử học tập* thay cho danh sách dài) tại `font-end/web/src/features/profile/ProfilePage.tsx`
- [x] T047 [US5] Xây dựng `NotificationBell` popover trên `Topbar` (chấm đỏ chưa đọc, tab *Tất cả / Chưa đọc*, *Đánh dấu đã đọc tất cả*, xóa từng tin, bấm tin điều hướng tới màn hình tương ứng) tại `font-end/web/src/components/layout/NotificationBell.tsx`
- [x] T048 [US5] Gắn tự động ghi Lịch sử & đẩy Thông báo sau khi hoàn tất Bước 1, nộp Bước 2 và nộp phiên Ôn tập SM-2

**Checkpoint**: `US5` hoạt động độc lập, Trang Ôn tập & Trang cá nhân gọn gàng cân đối.

---

## Phase 8: User Story 6 — Bảng xếp hạng Tuần & Sổ từ đã lưu (Priority: P2)

**Goal**: Bảng xếp hạng tuần tự động sắp xếp lại thứ hạng khi XP thay đổi, mở modal toàn bộ nhóm kèm Skeleton loading, xem nhanh hồ sơ công khai (ẩn email/SĐT), và Sổ từ đã lưu đồng bộ giữa Tra từ và Ôn tập.

**Independent Test**: Chạy `font-end/web/tests/unit/leaderboard.test.ts` và `font-end/web/tests/integration/leaderboard-savedwords.test.tsx` xác nhận tự nhảy từ Hạng 3 lên Hạng 2 khi XP vượt `2,840`, hồ sơ nhanh không lộ email/SĐT và 3 từ đã lưu xuất hiện làm nguồn ôn tập.

### Tests for User Story 6 ⚠️

- [x] T049 [P] [US6] Viết Unit Test cho thuật toán xếp hạng & định dạng thành viên Bảng xếp hạng tuần tại `font-end/web/tests/unit/leaderboard.test.ts`
- [x] T050 [P] [US6] Viết Integration Test cho `US6` (tự nhảy thứ hạng khi XP tăng, modal toàn bộ nhóm có Skeleton, modal hồ sơ công khai ẩn email/SĐT, lưu 3 từ bên Tra từ và mở phiên *Luyện tập tự chọn* tại Ôn tập hiển thị rõ nhãn không thay đổi lịch SM-2/Streak máy chủ và không gọi `/reviews/session/start`) tại `font-end/web/tests/integration/leaderboard-savedwords.test.tsx`

### Implementation for User Story 6

- [x] T051 [P] [US6] Cài đặt Adapter `font-end/web/src/services/adapters/leaderboard.adapter.ts` và `font-end/web/src/services/adapters/savedWords.adapter.ts`
- [x] T052 [US6] Xây dựng `WeeklyLeaderboardWidget`, `GroupLeaderboardModal` (có trạng thái Skeleton/Empty/Error) và `QuickProfileModal` (chỉ hiện thông tin công khai) tại `font-end/web/src/features/dashboard/WeeklyLeaderboard.tsx`
- [x] T053 [US6] Gắn nút lưu dấu trang (`Bookmark`) và bộ lọc *Sổ từ đã lưu* vào `DictionaryPage`, đồng thời nối luồng phiên `client_custom_practice` (chấm điểm cục bộ không gọi `/reviews/session/start`, kèm nhãn chú thích không thay đổi SM-2/Streak máy chủ) vào `ReviewCenterPage`
- [x] T054 [US6] Đồng bộ nhãn thứ hạng nhóm (`Hạng Vàng / Bạc / Đồng • Rank #N nhóm`) giữa `WeeklyLeaderboard`, `DashboardPage` và `ProfilePage`

**Checkpoint**: `US6` pass 100% test và đồng bộ mượt mà với XP toàn cục.

---

## Phase 9: User Story 7 — Trợ lý AI (Bản v1) & Popup Hỗ trợ Quản trị viên (Priority: P3)

**Goal**: Trang Trợ lý AI toàn màn hình trên Sidebar (nhiều cuộc hội thoại, gợi ý nhanh, trả lời theo kho Oxford 3000 ở bản v1 sẵn sàng nối `003-ai-chatbot`) và Popup Hỗ trợ QTV nổi góc phải dưới với 4 kênh.

**Independent Test**: Chạy `font-end/web/tests/integration/ai-and-support.test.tsx` kiểm tra hỏi đáp Trợ lý AI, lưu/đổi/xóa hội thoại, nút nghe/tra từ và 4 kênh trong Popup Hỗ trợ QTV (gồm gửi Góp ý đẩy thông báo lên nút chuông).

### Tests for User Story 7 ⚠️

- [x] T055 [P] [US7] Viết Integration Test cho `US7` (gửi câu hỏi phân biệt từ & xin ví dụ tới Trợ lý AI v1, giữ lịch sử nhiều hội thoại, mở Popup Hỗ trợ QTV 4 kênh, gửi biểu mẫu Góp ý đẩy thông báo lên chuông) tại `font-end/web/tests/integration/ai-and-support.test.tsx`

### Implementation for User Story 7

- [x] T056 [P] [US7] Cài đặt `font-end/web/src/services/adapters/aiTutor.adapter.ts` (bản v1 truy vấn Oxford 3000 cục bộ + cấu trúc sẵn sàng đổi sang API `003-ai-chatbot`) và `font-end/web/src/services/adapters/support.adapter.ts`
- [x] T057 [US7] Xây dựng `AiChatPage` bố cục 2 cột (cột trái danh sách cuộc hội thoại, cột phải khung chat, 4 gợi ý nhanh, renderer an toàn không XSS, nút *Nghe phát âm* & *Mở trong Tra từ*) tại `font-end/web/src/features/ai-chat/AiChatPage.tsx`
- [x] T058 [US7] Xây dựng `FloatingSupportWidget` nổi góc phải dưới (*HỖ TRỢ — Bạn cần hỗ trợ gì?*) gồm 4 màn hình con: Chat trực tiếp QTV, Biểu mẫu Góp ý/Báo lỗi, Tư vấn khóa học, Cộng đồng học tập tại `font-end/web/src/components/support/FloatingSupportWidget.tsx`
- [x] T059 [US7] Gắn `FloatingSupportWidget` vào `AppShell` và đảm bảo vị trí `Toast` không chồng lấn lên nút Hỗ trợ trên cả desktop lẫn mobile
- [x] T060 [US7] Kết nối biểu mẫu *Góp ý/Báo lỗi* đẩy thông báo tiếp nhận vào `NotificationBell`

**Checkpoint**: `US7` pass 100% test độc lập.

---

## Phase 10: User Story 8 — Khu vực Quản trị viên (Admin Portal) (Priority: P3)

**Goal**: Cung cấp giao diện Quản trị viên gọn nhẹ chỉ hiển thị với role `admin`, khai thác đủ 4 API quản trị của `002-backend-core`.

**Independent Test**: Chạy `font-end/web/tests/integration/admin-portal.test.tsx` kiểm tra Học viên bị chặn `/admin`, Quản trị viên xem thống kê, tìm/phân trang học viên, khóa/mở tài khoản có xác nhận và xem Nhật ký kiểm toán.

### Tests for User Story 8 ⚠️

- [x] T061 [P] [US8] Viết Integration Test cho `US8` (Học viên bị chặn `/admin`, Admin xem thống kê, tìm kiếm & phân trang học viên, khóa/mở tài khoản có xác nhận và kiểm tra Audit Logs) tại `font-end/web/tests/integration/admin-portal.test.tsx`

### Implementation for User Story 8

- [x] T062 [P] [US8] Tạo API service quản trị (`GET /admin/users`, `PATCH /admin/users/:id/status`, `GET /admin/stats`, `GET /admin/audit-logs`) tại `font-end/web/src/services/api/admin.api.ts`
- [x] T063 [US8] Xây dựng `AdminDashboardPage` hiển thị 4 thẻ thống kê tổng quan hệ thống và điều hướng nhanh tại `font-end/web/src/features/admin/AdminDashboardPage.tsx`
- [x] T064 [US8] Xây dựng `AdminUsersPage` (bảng phân trang, tìm kiếm theo tên/email, nút Khóa/Mở khóa kèm `ConfirmModal` xác nhận) tại `font-end/web/src/features/admin/AdminUsersPage.tsx`
- [x] T065 [US8] Xây dựng `AdminAuditLogsPage` (bảng tra cứu nhật ký kiểm toán phân trang) tại `font-end/web/src/features/admin/AdminAuditLogsPage.tsx`

**Checkpoint**: Hoàn tất toàn bộ 8 User Stories (`US1` → `US8`).

---

## Phase 11: Polish, Responsive, Security & E2E Validation

**Purpose**: Tối ưu hiệu năng, kiểm tra responsive toàn dải `320px`–`1440px+`, xử lý lỗi mạng toàn diện và xác nhận toàn bộ kịch bản trong `quickstart.md`.

- [x] T066 [P] Áp dụng lazy-loading (`React.lazy` + `Suspense`) cho các trang nặng (`DictionaryPage`, `AiChatPage`, `Admin*`) trong `font-end/web/src/app/router.tsx` và kiểm tra kích thước bundle build (`npm run build`)
- [x] T067 [P] Rà soát responsive trên 4 mốc `320px`, `768px`, `1280px`, `1440px+` (Sidebar Drawer, Flashcard 3D, Quiz options, Dictionary split, History drawer, Admin table) đảm bảo 0 tràn ngang (`SC-006`)
- [x] T068 [P] Viết Integration Test kiểm chứng trạng thái mất mạng / lỗi `500`/`503` kèm nút **Thử lại** trên các màn hình chính (`SC-007`) tại `font-end/web/tests/integration/error-resilience.test.tsx`
- [x] T069 Rà soát bảo mật Frontend: kiểm tra không hardcode secret, không lộ token trong log, không dùng `dangerouslySetInnerHTML` chưa thoát ký tự, `tsc --noEmit` đạt 0 lỗi
- [x] T070 Chạy toàn bộ test suite (`npm run test`), build (`npm run build`) và đối chiếu nghiệm thu 9 kịch bản V1–V9 trong `specs/004-frontend-webapp/quickstart.md`

---

## Phase 12: Đồng bộ Máy chủ cho Quên Mật khẩu OTP, History, Saved Words, Notifications & Support (6 Đợt Push Git)

**Purpose**: Nâng cấp các luồng cục bộ trên Frontend sang kết nối trực tiếp với các API mới của `002-backend-core` (trừ AI Chat giữ nguyên cho `003`), kèm màn hình `/forgot-password` và `/admin/support`.

- [x] T071 [US1] [Đợt 2] Bổ sung `forgotPassword` & `resetPassword` trong `font-end/web/src/services/api/auth.api.ts`, tạo trang `ForgotPasswordPage.tsx` (nhập email gửi OTP 6 số + đặt lại mật khẩu mới), gắn link ở `LoginPage.tsx` & route `/forgot-password` tại `router.tsx`
- [x] T072 [US1] [Đợt 2 - Test] Bổ sung MSW handlers và Integration Test cho luồng Quên mật khẩu OTP trên Frontend tại `font-end/web/tests/integration/account-recovery-sync.test.tsx`
- [x] T073 [US5] [Đợt 3] Bổ sung `listHistory` trong `font-end/web/src/services/api/learning.api.ts` và nâng cấp `HistoryPage.tsx` đồng bộ lịch sử từ máy chủ (hợp nhất an toàn với phiên tự luyện cục bộ) + test tại `account-recovery-sync.test.tsx`
- [x] T074 [US6] [Đợt 4] Bổ sung API Sổ từ đã lưu (`listSavedWords`, `saveWord`, `unsaveWord`) trong `vocabulary.api.ts`, đồng bộ `savedWords.adapter.ts` / `DictionaryPage.tsx` / `ReviewCenterPage.tsx` với máy chủ (giữ nguyên chế độ tự luyện khi bấm Ôn Sổ từ) + test tại `account-recovery-sync.test.tsx`
- [x] T075 [US5] [Đợt 5] Tạo `font-end/web/src/services/api/notifications.api.ts` và nâng cấp `notifications.adapter.ts` / `NotificationBell.tsx` đồng bộ danh sách, đánh dấu đã đọc và xóa thông báo với máy chủ + test tại `account-recovery-sync.test.tsx`
- [ ] T076 [US7] [Đợt 6] Tạo `font-end/web/src/services/api/support.api.ts`, nâng cấp `support.adapter.ts` / `FloatingSupportWidget.tsx` lưu tin nhắn & phiếu góp ý lên máy chủ
- [ ] T077 [US8] [Đợt 6] Xây dựng trang `AdminSupportPage.tsx` (`/admin/support`) để Quản trị viên xem hội thoại & phiếu góp ý và trả lời trực tiếp cho học viên, gắn liên kết điều hướng từ `AdminDashboardPage.tsx` & `router.tsx` + test tại `account-recovery-sync.test.tsx`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)** → **Phase 2 (Foundational)**: Tuần tự, bắt buộc hoàn tất trước khi vào User Stories.
- **Phase 3 (`US1` — Auth)**: Phụ thuộc Phase 2; cung cấp phiên đăng nhập cho các màn hình cần xác thực.
- **Phase 4 (`US2` — Dashboard & Học 2 bước)** & **Phase 5 (`US3` — Ôn tập SM-2)**: Phụ thuộc Phase 2 & `US1` (cùng nhau tạo thành **MVP cốt lõi P1**).
- **Phase 6 (`US4` — Tra từ)**, **Phase 7 (`US5` — Lịch sử, Hồ sơ, Thông báo)**, **Phase 8 (`US6` — Bảng xếp hạng & Sổ từ)**: Có thể triển khai **song song** sau khi hoàn thành Phase 2 + `US1`.
- **Phase 9 (`US7` — Trợ lý AI & Hỗ trợ QTV)** & **Phase 10 (`US8` — Admin Portal)**: Có thể triển khai **song song** ở đợt P3 sau Phase 2 + `US1`.
- **Phase 11 (Polish & Validation)**: Chạy cuối cùng sau khi hoàn tất các User Stories mục tiêu.

### Parallel Opportunities (Ví dụ chia việc cho nhóm)

```text
Sau khi hoàn thành Phase 1 + Phase 2 + Phase 3 (US1):
- Thành viên A: Phase 4 (US2 — Dashboard & Học 2 bước) → Phase 5 (US3 — Ôn tập SM-2)
- Thành viên B: Phase 6 (US4 — Tra từ) → Phase 8 (US6 — Bảng xếp hạng & Sổ từ)
- Thành viên C: Phase 7 (US5 — Lịch sử, Hồ sơ, Thông báo) → Phase 9 (US7 — Trợ lý AI & Hỗ trợ) → Phase 10 (US8 — Admin)
```

### Implementation Strategy

1. **MVP First (`Phase 1` → `Phase 5`)**: Dựng nền móng + Auth (`US1`) + Học 2 bước (`US2`) + Ôn tập SM-2 (`US3`) để có bản chạy hoàn chỉnh toàn bộ quy trình sư phạm cốt lõi.
2. **Incremental Delivery (`Phase 6` → `Phase 8`)**: Bổ sung Từ điển (`US4`), Lịch sử/Hồ sơ/Thông báo (`US5`) và Gamification/Sổ từ (`US6`).
3. **Full Ecosystem (`Phase 9` → `Phase 11`)**: Hoàn thiện Trợ lý AI v1 & Hỗ trợ QTV (`US7`), Khu vực Quản trị viên (`US8`) và kiểm chứng toàn diện theo `quickstart.md`.
