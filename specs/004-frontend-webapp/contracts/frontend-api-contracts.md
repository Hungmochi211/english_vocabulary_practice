# Frontend API Consumption & Adapter Contracts (`004-frontend-webapp`)

**Feature**: `004-frontend-webapp` | **Date**: 2026-11-23 | **Base URL**: `VITE_API_BASE_URL` (mặc định `http://localhost:3000/api/v1`)

Tài liệu này khóa chặt hợp đồng giao tiếp giữa Frontend (`font-end/web/`) với hai gói Backend đã đặc tả (`001-vocabulary-data` và `002-backend-core`) cùng giao diện Adapter cho các phần mở rộng v1.

---

## 1. Bảng Ánh xạ Endpoint Backend (`001` & `002`)

### 1.1. Xác thực & Hồ sơ (từ `specs/002-backend-core/contracts/openapi.yaml`)

| Màn hình / Thao tác | Method & Path | Query Keys bị làm mới (`invalidate`) |
| :--- | :--- | :--- |
| Đăng ký tài khoản | `POST /auth/register` | Set session + `['users', 'me']` |
| Đăng nhập Email/Mật khẩu | `POST /auth/login` | Set session + `['users', 'me']` |
| Đăng nhập Google OAuth 2.0 | `POST /auth/google` | Set session + `['users', 'me']` |
| Làm mới phiên tự động (Single-Flight) | `POST /auth/refresh` | Cập nhật `accessToken` + `refreshToken` |
| Đăng xuất phiên hiện tại | `POST /auth/logout` | Xóa toàn bộ `queryClient.clear()` & session |
| Đổi mật khẩu (thu hồi mọi phiên) | `POST /auth/change-password` | Xóa session → chuyển `/login` kèm thông báo |
| Lấy hồ sơ hiện tại | `GET /users/me` | `['users', 'me']` |
| Cập nhật hồ sơ, xóa ảnh (`avatarUrl: null`) & nhắc học | `PATCH /users/me` | `['users', 'me']`, đồng bộ Bảng xếp hạng (ảnh tải từ máy lưu cục bộ v1 qua `localAvatarAdapter`, không gửi base64 > 500 ký tự lên Backend) |

### 1.2. Từ vựng & Tra cứu Từ điển (từ `specs/001-vocabulary-data/contracts/openapi.yaml`)

| Màn hình / Thao tác | Method & Path | Ghi chú Contract |
| :--- | :--- | :--- |
| Danh sách 16 chủ đề | `GET /topics` | `staleTime: 10 phút` (dữ liệu ít thay đổi) |
| Danh sách bài học theo lọc | `GET /lessons` | Query: `level`, `topicId`, `page`, `limit` |
| Chi tiết bài học + 15–18 từ | `GET /lessons/{id}` | Dùng cho Bước 1 (Học nạp Flashcard) |
| Chi tiết 1 từ vựng | `GET /vocabularies/{id}` | Dùng cho bảng chi tiết Tra từ |
| Tra cứu từ vựng | `GET /vocabularies/search` | Query: `q`, `level`, `partOfSpeech`, `topicId`, `page`, `limit`; debounce `150ms` |

### 1.3. Học 2 Bước, Luyện tập, Ôn SM-2 & Thống kê (từ `specs/002-backend-core/contracts/openapi.yaml`)

| Màn hình / Thao tác | Method & Path | Query Keys bị làm mới (`invalidate`) |
| :--- | :--- | :--- |
| Danh sách bài học kèm mở khóa | `GET /learning/lessons` | `['learning', 'lessons', level, topicId]` |
| Ghi nhận mở 1 thẻ ở Bước 1 | `POST /learning/lessons/{lessonId}/cards/{vocabularyId}/open` | `['learning', 'lessons']` (cập nhật `openedCount`, `acquisitionCompleted`) |
| Bắt đầu thực hành Bước 2 | `POST /learning/lessons/{lessonId}/practice/start` | Trả `attemptId` + `questions[]` (ẩn đáp án) |
| Bắt đầu Kiểm tra tổng hợp | `POST /learning/quizzes/mixed/start` | Body `{ totalQuestions: 5..40 }` |
| Nộp bài & chấm điểm | `POST /learning/quizzes/{attemptId}/submit` | `['stats', 'overview']`, `['learning', 'lessons']`, `['reviews', 'due']` + ghi Lịch sử & Thông báo. Trả về `gradingStatus` đúng chuẩn `grading_status_enum` của `002`: `'exact' \| 'near_match' \| 'phonetic_match' \| 'incorrect'` |
| Lấy từ đến hạn SM-2 hôm nay | `GET /reviews/due` | `['reviews', 'due']` |
| Bắt đầu phiên ôn SM-2 | `POST /reviews/session/start` | Body `{ limit?: 1..50 }` (mặc định 20) — **chỉ lấy từ đến hạn SM-2 trên máy chủ**, trả `attemptId` + `questions[]` |
| Thống kê Streak, Leitner & 7 ngày | `GET /stats/overview` | `['stats', 'overview']` |

#### Quy tắc tách biệt Phiên chính thức vs Phiên luyện tập tự chọn (Sổ từ đã lưu / Ôn lại từ Lịch sử)

- **Phiên chính thức (`origin: 'server_official'`)**: gồm Thực hành bài học (`POST /learning/lessons/{lessonId}/practice/start`), Ôn tập SM-2 đến hạn (`POST /reviews/session/start`) và Kiểm tra tổng hợp (`POST /learning/quizzes/mixed/start`). Mọi phiên này đều nộp qua `POST /learning/quizzes/{attemptId}/submit` để Backend chấm điểm và cập nhật chính thức SM-2, 5 Hộp Leitner, mở khóa bài học, Streak và XP.
- **Phiên luyện tập tự chọn (`origin: 'client_custom_practice'`)**: áp dụng ở bản v1 khi người học chọn ôn từ **Sổ từ đã lưu** hoặc bấm **Ôn lại phiên / Ôn từ sai** từ trang Lịch sử (vì `POST /reviews/session/start` trong `002-backend-core` hiện chỉ nhận `limit`, chưa nhận `vocabularyIds[]`). Phiên này sinh câu hỏi và chấm điểm cục bộ tại trình duyệt theo đúng 4 trạng thái `exact | near_match (>= 3 ký tự) | phonetic_match | incorrect`, ghi vào `ActivityHistoryAdapter`, **không gọi** `/reviews/session/start` hay `/learning/quizzes/{attemptId}/submit`, và hiển thị nhãn rõ cho người học rằng phiên tự chọn không thay đổi lịch SM-2 hay Streak chính thức trên máy chủ. Khi Backend bổ sung endpoint nhận `vocabularyIds[]`, chỉ cần nối trực tiếp mà không đổi UI.

### 1.4. Khu vực Quản trị viên (từ `specs/002-backend-core/contracts/openapi.yaml`)

| Màn hình / Thao tác | Method & Path | Quyền yêu cầu |
| :--- | :--- | :--- |
| Danh sách học viên phân trang | `GET /admin/users` | `role === 'admin'` |
| Khóa / mở khóa tài khoản | `PATCH /admin/users/{userId}/status` | `role === 'admin'` + hộp thoại xác nhận |
| Thống kê tổng quan hệ thống | `GET /admin/stats` | `role === 'admin'` |
| Nhật ký kiểm toán | `GET /admin/audit-logs` | `role === 'admin'` |

---

## 2. Ma trận Xử lý Mã lỗi API phía Frontend

| HTTP Status / `error.code` | Hành vi Bắt buộc của Giao diện |
| :--- | :--- |
| `400` (`VALIDATION_ERROR`) | Hiển thị lỗi chi tiết ngay dưới từng trường nhập tương ứng hoặc banner biểu mẫu. |
| `401` (`UNAUTHORIZED`) | Kích hoạt Single-Flight `POST /auth/refresh` (tối đa 1 lần cho chuỗi lỗi); nếu thất bại → xóa phiên & điều hướng `/login?reason=expired`. |
| `403` (`ACCOUNT_DISABLED`) | Đăng xuất cục bộ và hiển thị thông báo rõ: *"Tài khoản của bạn đã bị tạm khóa. Vui lòng liên hệ Quản trị viên."* |
| `403` (chưa mở khóa bài / bước) | Giữ người học ở màn hình hiện tại và hiển thị hướng dẫn hoàn tất bài trước ($\ge 80\%$) hoặc mở đủ thẻ Bước 1. |
| `409` (`ATTEMPT_ALREADY_SUBMITTED`) | Không cho nộp trùng lần 2; hiển thị thông báo bài đã được chấm và đưa về màn hình kết quả/tổng quan. |
| `429` (`RATE_LIMIT_EXCEEDED`) | Vô hiệu hóa tạm nút gửi và hiển thị thông báo *"Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút."* |
| `500` / `503` / Mất mạng | Hiển thị khung lỗi cục bộ trong widget/trang kèm nút **"Thử lại"** (`refetch()`), không làm trắng toàn trang (`SC-007`). |

---

## 3. Giao diện Adapter cục bộ v1 (Sẵn sàng nối API tương lai)

```typescript
export interface AiTutorAdapter {
  listConversations(): Promise<AiConversation[]>;
  sendMessage(conversationId: string, prompt: string): Promise<AiMessageReply>;
  deleteConversation(conversationId: string): Promise<void>;
}

export interface LeaderboardAdapter {
  getWeeklyGroupLeaderboard(currentUser: {
    fullName: string;
    avatarUrl: string | null;
    targetLevel: CefrLevel;
    totalXp: number;
    currentStreak: number;
  }): Promise<LeaderboardMember[]>;
}

export interface SavedWordsAdapter {
  list(): SavedWordRecord[];
  toggle(word: VocabularyItem): { saved: boolean; items: SavedWordRecord[] };
}

export interface ActivityHistoryAdapter {
  list(): ActivityHistoryItem[];
  record(entry: Omit<ActivityHistoryItem, 'id' | 'createdAt'>): ActivityHistoryItem;
  clear(): void;
}

export interface NotificationAdapter {
  list(): NotificationItem[];
  push(entry: Omit<NotificationItem, 'id' | 'read' | 'createdAt'>): NotificationItem;
  markRead(id: string): NotificationItem[];
  markAllRead(): NotificationItem[];
  remove(id: string): NotificationItem[];
  clear(): void;
}

export interface SupportTicketPayload {
  category: string;
  email: string;
  detail: string;
}

export interface SupportAdapter {
  listMessages(): SupportMessage[];
  sendMessage(text: string): Promise<{ userMessage: SupportMessage; replyMessage: SupportMessage }>;
  submitFeedback(payload: SupportTicketPayload): Promise<{ ticketId: string; submittedAt: string }>;
}
```

> **Quy ước lưu trữ cục bộ v1**: Toàn bộ 6 Adapter trên sử dụng `localStorage` phân phiên bản khóa (`lexitag:v1:*` định nghĩa tại [data-model.md](../data-model.md)) kèm bọc `try/catch` an toàn khi hết quota hoặc chạy ở chế độ ẩn danh. Khi nhóm triển khai `003-ai-chatbot` (hoặc bổ sung endpoint Leaderboard / Bookmarks / Notifications / Support trên Backend), chỉ cần thay implementation của từng adapter sang gọi HTTP `axios` tương ứng mà giữ nguyên toàn bộ UI và test component.
