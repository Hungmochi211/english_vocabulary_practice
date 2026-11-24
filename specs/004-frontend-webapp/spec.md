# Feature Specification: Ứng dụng Web Học Từ Vựng Tiếng Anh Thông Minh (Frontend Web Application)

**Feature Branch**: `004-frontend-webapp`

**Created**: 2026-11-23 | **Last Updated**: 2026-11-23

**Status**: Approved (Plan, Checklists & Tasks Complete — Ready for Implementation)

**Input**: Xây dựng giao diện ứng dụng web đầy đủ cho người dùng của nền tảng **"Website Hỗ trợ Học Từ Vựng Tiếng Anh Thông Minh"** (LexiTag Learning Lab), kế thừa bố cục và trải nghiệm trực quan đã kiểm chứng từ bản mẫu `font-end/Dashboard/`, đồng bộ với kho từ vựng Oxford 3000 (`001-vocabulary-data`) và các nghiệp vụ xác thực, học 2 bước, ôn tập SM-2, Streak, thống kê và quản trị (`002-backend-core`).

---

## Scope & System Boundary *(Ranh giới phạm vi)*

- **Đồng bộ mã số Feature**: `004-frontend-webapp` khớp trực tiếp với lộ trình đã quy ước tại `001-vocabulary-data` và `002-backend-core` (`003-ai-chatbot` dành cho phân hệ dịch vụ Chatbot AI phía máy chủ).
- **Thuộc phạm vi Feature `004-frontend-webapp`**:
  - **Xác thực & Phiên người dùng:** Đăng ký, Đăng nhập bằng email/mật khẩu, Đăng nhập một chạm bằng tài khoản Google, tự động duy trì phiên đăng nhập, Đổi mật khẩu và Đăng xuất có xác nhận.
  - **Bảng điều khiển Trang chủ (Dashboard):** Lời chào cá nhân hóa, mục tiêu từ vựng hằng ngày, các chỉ số tiến độ (từ đã thuộc, độ chuẩn, chuỗi ngày học Streak, tổng điểm XP), danh sách khóa học đang học, hộp nhắc ôn tập SM-2 đến hạn và Bảng xếp hạng tuần.
  - **Lộ trình Khóa học & Chu trình Học 2 bước bắt buộc:**
    - **Bước 1 (Học nạp kiến thức):** Xem danh sách bài học 15–18 từ (bài cuối tối đa 20 từ) theo cấp độ CEFR (`A1`–`B2`) và chủ đề; lật thẻ từ vựng 2 mặt (từ vựng sạch, loại từ, phiên âm IPA, phát âm chuẩn & chậm, nghĩa tiếng Việt, câu ví dụ song ngữ); yêu cầu mở đủ từng thẻ để mở khóa Bước 2.
    - **Bước 2 (Học áp dụng):** Làm bài tập thực hành (Trắc nghiệm 4 đáp án, Gõ từ theo nghĩa kèm phản hồi lỗi chính tả gần đúng/đảo chữ cái, Nghe chép chính tả kèm phản hồi đúng âm sai chữ, và Bài kiểm tra tổng hợp) với ngưỡng đạt $\ge 80\%$ để mở khóa bài học kế tiếp.
  - **Trung tâm Ôn tập Ngắt quãng (SM-2 & 5 Hộp Leitner):** Xem số từ đến hạn ôn trong ngày, thực hiện phiên ôn tập theo 4 chế độ, tự động cập nhật 5 Hộp Leitner và tổng kết phiên.
  - **Tra cứu Từ điển Oxford 3000 & Sổ từ đã lưu:** Tìm kiếm theo từ tiếng Anh hoặc nghĩa tiếng Việt không dấu, lọc theo cấp độ CEFR, loại từ, chủ đề; nghe phát âm chuẩn/chậm; gợi ý sửa lỗi chính tả; lưu/bỏ lưu từ vào Sổ từ cá nhân để ôn tập lại.
  - **Trang Lịch sử Học tập tách biệt:** Xem lại toàn bộ bài học và phiên ôn tập đã hoàn thành, mở chi tiết danh sách từng từ đúng/sai trong mỗi phiên, lọc theo loại hoạt động và kết quả đạt/chưa đạt, khung hiển thị gọn tối đa 10 phiên mới nhất có thanh cuộn và nút ôn lại nhanh.
  - **Hồ sơ Cá nhân & Trung tâm Thông báo:** Cập nhật họ tên, ảnh đại diện, mục tiêu CEFR, mục tiêu từ/ngày, cài đặt nhắc học qua email lúc 20:00; xem thống kê tiến độ, phân bổ CEFR, 5 hộp Leitner; tương tác với Trung tâm Thông báo trên thanh đầu trang.
  - **Bảng xếp hạng Tuần:** Hiển thị thứ hạng thành viên theo tổng điểm XP tuần từ cao đến thấp, tự cập nhật vị trí và nhãn thứ hạng của người học khi XP thay đổi, xem toàn bộ thành viên nhóm và xem nhanh hồ sơ học tập công khai (ẩn thông tin riêng tư).
  - **Trợ lý AI & Popup Hỗ trợ Quản trị viên:** Màn hình Trợ lý AI trên thanh điều hướng (quản lý nhiều cuộc hội thoại, gợi ý câu hỏi nhanh; ở bản v1 trả lời tra nghĩa, ví dụ và phân biệt từ dựa trên kho Oxford 3000 và giữ lại lịch sử hội thoại trên thiết bị cho tới khi dịch vụ AI phía máy chủ kích hoạt) và Popup Hỗ trợ nổi góc phải dưới (Chat QTV, Góp ý/Báo lỗi, Tư vấn khóa học, Cộng đồng học tập).
  - **Khu vực Quản trị viên (Admin Portal):** Giao diện gọn nhẹ chỉ hiển thị và cho phép truy cập với tài khoản mang vai trò Quản trị viên (xem danh sách học viên phân trang, khóa/mở khóa tài khoản có xác nhận, xem thống kê hệ thống và nhật ký kiểm toán).
- **Ngoài phạm vi Feature `004-frontend-webapp`**:
  - Xử lý nghiệp vụ lưu trữ gốc phía máy chủ, tính toán SM-2 phía máy chủ và tác vụ gửi email nền lúc 20:00 (đã đặc tả tại `001-vocabulary-data` và `002-backend-core`).
  - Dịch vụ suy luận AI phía máy chủ (thuộc `003-ai-chatbot`).
  - Tự xóa tài khoản vĩnh viễn, khôi phục mật khẩu qua mã OTP email và ứng dụng di động gốc (ngoài phạm vi v1).

---

## Clarifications

### Session 2026-11-23

- **Q1 (Trợ lý AI & Popup Hỗ trợ QTV):** Đưa cả màn hình Trợ lý AI (trên thanh điều hướng) và Popup Hỗ trợ QTV (góc phải dưới) vào `004-frontend-webapp`. Ở bản v1 khi dịch vụ AI phía máy chủ chưa mở, Trợ lý AI vẫn trả lời được các câu hỏi tra nghĩa, câu ví dụ và phân biệt từ dựa trên kho từ vựng Oxford 3000, đồng thời giữ lại các cuộc hội thoại trên thiết bị; khi dịch vụ AI sẵn sàng sẽ tự chuyển sang trả lời nâng cao mà không đổi trải nghiệm người dùng.
- **Q2 (Giao diện Quản trị viên):** Bao gồm khu vực Quản trị viên gọn nhẹ ngay trong `004-frontend-webapp`, chỉ hiển thị và cho phép truy cập với tài khoản mang vai trò Quản trị viên (quản lý học viên phân trang, khóa/mở khóa tài khoản, thống kê tổng quan hệ thống, nhật ký kiểm toán).
- **Q3 (Tiện ích mở rộng từ bản mẫu):** Giữ đầy đủ trải nghiệm người dùng của Bảng xếp hạng tuần, Sổ từ đã lưu và Lịch sử chi tiết từng từ. Phần dữ liệu đã có dịch vụ từ `001` & `002` đồng bộ trực tiếp với máy chủ; các dữ liệu tiện ích chưa có dịch vụ máy chủ riêng vẫn được ghi nhớ xuyên suốt giữa các lần mở lại trang trên thiết bị của người học (cách tổ chức dữ liệu và tích hợp sẽ được thiết kế trong `plan.md`).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Xác thực Tài khoản và Bảo vệ Phiên học (Priority: P1)

Người học mới hoặc người học cũ truy cập ứng dụng có thể đăng ký tài khoản mới, đăng nhập bằng email/mật khẩu hoặc tài khoản Google, sau đó vào thẳng Bảng điều khiển cá nhân. Khi phiên làm việc hết hạn, hệ thống tự động gia hạn ngầm hoặc điều hướng an toàn về màn hình đăng nhập mà không làm mất trải nghiệm đột ngột.

**Why this priority**: Mọi tiến độ học tập, chuỗi Streak, lịch ôn SM-2 và điểm XP đều gắn với danh tính người dùng; đây là cổng vào bắt buộc trước khi sử dụng toàn bộ ứng dụng.

**Independent Test**: Có thể kiểm thử độc lập bằng cách đăng ký tài khoản mới, đăng xuất, đăng nhập lại và xác nhận thông tin người dùng hiển thị đúng trên thanh điều hướng và trang Hồ sơ cá nhân.

**Acceptance Scenarios**:

1. **Given** khách chưa đăng nhập truy cập trang đăng ký, **When** nhập họ tên, email hợp lệ và mật khẩu đạt yêu cầu rồi gửi biểu mẫu, **Then** tài khoản được tạo thành công và người dùng được chuyển thẳng vào Bảng điều khiển Trang chủ.
2. **Given** người học nhập sai mật khẩu hoặc tài khoản đã bị khóa khi đăng nhập, **When** gửi biểu mẫu đăng nhập, **Then** màn hình hiển thị thông báo lỗi tiếng Việt rõ ràng và không tiết lộ thông tin nhạy cảm của hệ thống.
3. **Given** người học chọn đăng nhập bằng tài khoản Google và hoàn tất xác nhận, **When** hệ thống xác thực thành công, **Then** người học vào thẳng Bảng điều khiển với tên và ảnh đại diện đồng bộ.
4. **Given** người học chưa đăng nhập cố truy cập trực tiếp đường dẫn Trang chủ, Khóa học, Ôn tập hoặc Hồ sơ cá nhân, **When** trang được mở, **Then** ứng dụng tự động chuyển hướng sang màn hình Đăng nhập và quay lại trang đích sau khi đăng nhập thành công.
5. **Given** người học đang đăng nhập bấm Đăng xuất và xác nhận trong hộp thoại, **When** thao tác hoàn tất, **Then** phiên hiện tại kết thúc ngay lập tức và mọi thông tin cá nhân trên màn hình phiên cũ được xóa sạch.

---

### User Story 2 - Bảng điều khiển Tổng quan và Lộ trình Học 2 Bước (Priority: P1)

Sau khi đăng nhập, người học xem tổng quan tiến độ tại Trang chủ (mục tiêu hằng ngày, số từ đã thuộc, chuỗi Streak, tổng XP, thẻ SRS đến hạn), chọn một chủ đề và cấp độ CEFR (`A1`–`B2`) trong mục Khóa học, hoàn tất **Bước 1 (Học nạp)** bằng cách mở xem đủ từng thẻ từ trong bài học 15–18 từ, sau đó chuyển sang **Bước 2 (Học áp dụng)** để làm bài tập và đạt $\ge 80\%$ nhằm mở khóa bài học kế tiếp.

**Why this priority**: Chu trình sư phạm 2 bước (Học nạp $\rightarrow$ Học áp dụng) kèm cổng mở khóa $\ge 80\%$ là giá trị cốt lõi và yêu cầu bắt buộc không thương lượng của đề tài.

**Independent Test**: Có thể kiểm thử độc lập bằng cách chọn Bài học 1 của một chủ đề, mở lần lượt toàn bộ thẻ flashcard trong Bước 1, xác nhận nút làm bài tập được mở khóa, hoàn thành bài tập đạt $\ge 80\%$ và kiểm tra Bài học 2 chuyển sang trạng thái đã mở khóa.

**Acceptance Scenarios**:

1. **Given** người học mở Trang chủ, **When** dữ liệu tải xong, **Then** màn hình hiển thị nhất quán số ngày chuỗi Streak, tổng điểm XP (khớp giữa thanh đầu trang, thẻ Trang chủ, Bảng xếp hạng và trang Hồ sơ), tiến độ mục tiêu ngày và số thẻ đến hạn ôn SM-2.
2. **Given** người học mới vào mục Khóa học, **When** chọn một cấp độ CEFR (`A1`–`B2`) và chủ đề, **Then** Bài học 1 của từng chủ đề ở trạng thái mở khóa sẵn, còn từ Bài học 2 trở đi hiển thị biểu tượng khóa cho tới khi bài liền trước đạt $\ge 80\%$.
3. **Given** người học đang ở Bước 1 (Học nạp) của một bài học có 16 từ nhưng mới mở 10/16 thẻ, **When** quan sát nút bắt đầu luyện tập, **Then** hệ thống hiển thị tiến độ `10/16` và thông báo cần mở đủ toàn bộ thẻ từ trong bài trước khi vào Bước 2.
4. **Given** người học mở thẻ từ vựng ở Bước 1, **When** lật thẻ và bấm nghe phát âm chuẩn hoặc nghe chậm (`0.7×`), **Then** thẻ hiển thị rõ từ tiếng Anh, loại từ, phiên âm IPA, nghĩa tiếng Việt, câu ví dụ song ngữ (từ mục tiêu được tô nổi) và phát âm thanh rõ ràng.
5. **Given** người học nộp bài thực hành Bước 2 đạt tỷ lệ chính xác $\ge 80\%$, **When** màn hình tổng kết hiển thị, **Then** bài học được đánh dấu hoàn thành, bài học kế tiếp được mở khóa, tổng XP và chuỗi Streak trong ngày được cập nhật ngay trên giao diện.
6. **Given** người học nộp bài thực hành Bước 2 đạt dưới $80\%$, **When** màn hình tổng kết hiển thị, **Then** bài học kế tiếp vẫn giữ trạng thái khóa, hệ thống liệt kê các từ làm sai và cung cấp nút làm lại ngay.

---

### User Story 3 - Luyện tập Phản xạ Đa chế độ và Ôn tập Ngắt quãng SM-2 (Priority: P1)

Người học có thể ôn tập các từ đến hạn hằng ngày theo lịch SuperMemo SM-2 kết hợp quan sát trực quan **5 Hộp thẻ Leitner** và luyện phản xạ qua 4 hình thức: Lật thẻ SM-2, Trắc nghiệm 4 đáp án, Gõ từ theo nghĩa (nhận phản hồi *"Gần đúng"* khi sai 1 ký tự hoặc đảo 2 chữ cái liền kề) và Nghe chép chính tả (nhận phản hồi *"Đúng âm sai chữ"* khi phát âm tương đồng).

**Why this priority**: Đây là tính năng luyện trí nhớ dài hạn và thể hiện rõ giá trị thuật toán sư phạm (SM-2, Levenshtein, Soundex, Fisher-Yates) trên trải nghiệm trực tiếp của người học.

**Independent Test**: Có thể kiểm thử độc lập bằng cách mở mục Ôn tập, hoàn thành 1 phiên luyện tập có đủ 3 trường hợp trả lời (đúng hoàn toàn, gõ sai 1 ký tự / đảo chữ cái, và gõ sai chính tả nhưng đồng âm ở chế độ Nghe chép) rồi kiểm tra phản hồi hiển thị và cập nhật 5 Hộp Leitner.

**Acceptance Scenarios**:

1. **Given** người học có các từ đến hạn ôn hôm nay và mở mục Ôn tập, **When** xem bảng tổng quan ôn tập, **Then** hệ thống hiển thị đúng số lượng từ đến hạn và phân bố số lượng thẻ hiện tại trong từng Hộp Leitner từ Hộp 1 đến Hộp 5.
2. **Given** người học đang làm câu hỏi Gõ từ cho đáp án dài $\ge 3$ ký tự là `peaceful`, **When** gõ `paeceful` (đảo 2 chữ cái liền kề) hoặc `peacful` (sai 1 ký tự), **Then** giao diện hiển thị phản hồi màu vàng/cam phân loại *"Gần đúng"* (`0,5` điểm, không đánh trượt hoàn toàn) kèm hướng dẫn sửa chính tả chính xác.
3. **Given** người học đang làm câu hỏi Gõ từ cho từ ngắn dưới 3 ký tự là `go` (hoặc `in`), **When** gõ sai 1 ký tự như `do` (hoặc `on`), **Then** giao diện hiển thị phản hồi màu đỏ phân loại *"Chưa đúng"* (`0,0` điểm) kèm đáp án chuẩn `go` và không gắn nhãn *"Gần đúng"*.
4. **Given** người học đang làm câu hỏi Nghe chép chính tả cho từ `phone`, **When** nghe phát âm và gõ `fone`, **Then** giao diện hiển thị phản hồi khuyến khích màu xanh dương *"Tai bạn nghe rất chuẩn! Nhưng chính tả đúng của từ này là: phone"*.
5. **Given** người học đang làm câu hỏi Trắc nghiệm, **When** câu hỏi xuất hiện, **Then** hiển thị đúng 4 phương án rõ ràng đã được xáo trộn, cho phép chọn bằng chuột hoặc phím tắt `1`–`4`, và hiển thị giải thích kèm ví dụ ngay sau khi chọn.
6. **Given** người học hoàn thành phiên ôn tập SM-2 hoặc Bài kiểm tra tổng hợp, **When** nộp bài, **Then** hệ thống cập nhật ngay phân bố 5 Hộp Leitner, tổng điểm XP, trạng thái hoàn thành Streak trong ngày và ghi nhận phiên vào Lịch sử học tập.

---

### User Story 4 - Tra cứu Từ điển Oxford 3000 (Priority: P2)

Người học có thể tra cứu nhanh toàn bộ kho từ vựng chuẩn Oxford 3000 (`A1`–`B2`) từ mục Tra từ hoặc ô tìm kiếm nhanh trên thanh đầu trang (hỗ trợ phím tắt `Ctrl/Cmd + K`), lọc theo cấp độ CEFR, loại từ và chủ đề, nghe phát âm hai tốc độ và xem chi tiết câu ví dụ ngữ cảnh.

**Why this priority**: Tra cứu từ vựng là thao tác hỗ trợ thường xuyên trong suốt quá trình học và ôn tập, giúp người học tự kiểm tra nghĩa, phiên âm và cách dùng ngay trong cùng một ứng dụng.

**Independent Test**: Có thể kiểm thử độc lập bằng cách gõ một từ tiếng Anh (VD: `peaceful`), một nghĩa tiếng Việt không dấu (VD: `moi truong`) và một từ gõ sai chính tả (VD: `enviroment`) rồi xác nhận kết quả hiển thị, bộ lọc và nút phát âm hoạt động đúng.

**Acceptance Scenarios**:

1. **Given** người học đang ở bất kỳ màn hình nào, **When** nhập từ khóa vào thanh tìm kiếm đầu trang và nhấn `Enter` (hoặc nhấn `Ctrl/Cmd + K`), **Then** ứng dụng chuyển sang màn hình Tra từ và hiển thị ngay danh sách kết quả khớp từ khóa.
2. **Given** người học mở mục Tra từ và nhập từ khóa tiếng Anh hoặc tiếng Việt (có dấu hoặc không dấu), **When** áp dụng thêm bộ lọc cấp độ (`A1`–`B2`), loại từ hoặc chủ đề, **Then** danh sách kết quả lọc chính xác theo đồng thời tất cả điều kiện và hiển thị tổng số từ khớp.
3. **Given** người học chọn một từ trong danh sách kết quả, **When** bảng chi tiết hiển thị, **Then** hiện đầy đủ từ vựng, cấp độ CEFR, loại từ, chủ đề, phiên âm IPA, nghĩa tiếng Việt, câu ví dụ song ngữ có tô nổi từ khóa, cùng nút nghe phát âm tốc độ thường và chậm (`0.7×`).
4. **Given** người học nhập từ tiếng Anh gõ sai nhẹ 1–2 ký tự không có kết quả khớp chính xác, **When** danh sách trống, **Then** hệ thống hiển thị gợi ý *"Có phải bạn muốn tìm: ..."* cho phép nhấn chọn trực tiếp.

---

### User Story 5 - Trang Lịch sử Học tập chi tiết, Hồ sơ Cá nhân và Thông báo (Priority: P2)

Người học có một trang **Lịch sử** tách biệt (đặt ngay trên mục Trang cá nhân ở thanh điều hướng) để xem lại toàn bộ bài học và phiên ôn tập đã hoàn thành kèm chi tiết từng từ đúng/sai trong khung cuộn gọn tối đa 10 phiên mới nhất, một trang **Hồ sơ cá nhân** để chỉnh sửa thông tin, đổi mật khẩu, cài đặt nhắc học và theo dõi biểu đồ tiến độ, cùng **Trung tâm Thông báo** tại nút chuông trên thanh đầu trang.

**Why this priority**: Tách trang Lịch sử giúp trang Ôn tập và Trang cá nhân luôn gọn gàng, cân đối khi học dài ngày; quản lý hồ sơ và cài đặt nhắc học là chức năng tài khoản thiết yếu.

**Independent Test**: Có thể kiểm thử độc lập bằng cách hoàn thành 1 phiên ôn tập, mở trang Lịch sử kiểm tra chi tiết từng từ đúng/sai và nút ôn lại nhanh; sau đó cập nhật hồ sơ, đổi mật khẩu và thao tác đánh dấu đã đọc trong Trung tâm Thông báo.

**Acceptance Scenarios**:

1. **Given** người học vừa hoàn thành một bài học hoặc phiên ôn tập, **When** mở mục Lịch sử trên thanh điều hướng, **Then** phiên mới nhất xuất hiện ngay trên cùng với loại hoạt động, tỷ lệ chính xác `%`, XP nhận được và thời gian làm bài.
2. **Given** người học nhấn vào một phiên trong trang Lịch sử, **When** khung chi tiết mở ra, **Then** hiển thị danh sách từng từ đã học/ôn trong phiên kèm trạng thái (*Đã nhớ* / *Cần ôn*), nút nghe phát âm, nút **Ôn lại phiên này** và nút **Ôn các từ sai** (nếu có từ sai).
3. **Given** người học có hơn 10 phiên trong Lịch sử, **When** xem danh sách phiên, **Then** khung danh sách giữ chiều cao cố định vừa 10 phiên mới nhất và xuất hiện thanh cuộn bên trong khung thay vì kéo dài toàn bộ trang.
4. **Given** người học mở Hồ sơ cá nhân và sửa họ tên, ảnh đại diện, trình độ mục tiêu CEFR hoặc bật/tắt tùy chọn email nhắc học lúc 20:00, **When** bấm Lưu thay đổi, **Then** thay đổi được lưu bền vững, hiển thị thông báo xác nhận và cập nhật ngay tên/ảnh đại diện trên thanh điều hướng.
5. **Given** người học mở form Đổi mật khẩu, **When** nhập mật khẩu hiện tại đúng và mật khẩu mới hợp lệ trùng khớp ô xác nhận, **Then** mật khẩu được cập nhật thành công và hệ thống yêu cầu đăng nhập lại an toàn khi phiên cũ bị thu hồi.
6. **Given** người học có thông báo chưa đọc, **When** nhấn biểu tượng chuông trên thanh đầu trang, **Then** bảng thông báo cho phép lọc *Tất cả / Chưa đọc*, đánh dấu đã đọc từng mục hoặc tất cả (ẩn chấm đỏ khi hết tin chưa đọc) và điều hướng thẳng tới màn hình tương ứng khi nhấn vào thông báo.

---

### User Story 6 - Bảng xếp hạng Tuần và Sổ từ đã lưu (Priority: P2)

Người học theo dõi vị trí thi đua của mình trong nhóm tại **Bảng xếp hạng tuần** trên Trang chủ (tự động nhảy thứ hạng ngay khi được cộng thêm XP, xem danh sách đầy đủ cả nhóm và xem nhanh hồ sơ học tập công khai của từng thành viên), đồng thời có thể đánh dấu lưu các từ khó vào **Sổ từ đã lưu** khi tra từ điển rồi chọn trực tiếp Sổ từ làm nguồn ôn tập.

**Why this priority**: Hai tiện ích này trực tiếp tăng động lực duy trì thói quen học (Gamification) và cá nhân hóa danh sách từ khó của từng người học, đã được kiểm chứng trên bản mẫu `font-end/Dashboard/`.

**Independent Test**: Có thể kiểm thử độc lập bằng cách hoàn thành 1 phiên ôn tập để tăng XP vượt thành viên xếp ngay trên và kiểm tra thứ hạng tự nhảy trên Bảng xếp hạng + thẻ Tổng điểm XP; sau đó lưu 3 từ bên Tra từ và mở mục Ôn tập chọn nguồn *Sổ từ đã lưu*.

**Acceptance Scenarios**:

1. **Given** người học đang đứng Hạng 3 (`2,450 XP`) sau thành viên Hạng 2 (`2,840 XP`), **When** tổng điểm XP tăng vượt `2,840 XP` sau khi học hoặc ôn tập, **Then** Bảng xếp hạng tuần tự động sắp xếp lại đưa dòng `(Bạn)` lên Hạng 2 và cập nhật đồng thời nhãn thứ hạng nhóm trên Trang chủ và Hồ sơ cá nhân mà không cần tải lại trang.
2. **Given** người học nhấn vào huy hiệu tên nhóm (VD: `Nhóm B2 Pro`) trên Bảng xếp hạng tuần, **When** hộp thoại danh sách nhóm mở ra, **Then** hiển thị trạng thái tải khung xương ngắn rồi liệt kê đầy đủ toàn bộ thành viên nhóm theo thứ tự XP giảm dần, tô nổi dòng `(Bạn)`.
3. **Given** người học nhấn vào một thành viên bất kỳ trên Bảng xếp hạng tuần, **When** hộp thoại Hồ sơ nhanh mở ra, **Then** chỉ hiển thị thông tin học tập công khai (tên, ảnh đại diện hoặc chữ cái đầu, cấp độ CEFR, thứ hạng, tổng XP, số từ tuần này, Streak, huy hiệu) và tuyệt đối không hiển thị email hay số điện thoại riêng tư.
4. **Given** người học nhấn biểu tượng lưu dấu trang ở 3 từ vựng trong mục Tra từ, **When** chuyển sang bộ lọc *Sổ từ đã lưu* hoặc mở mục Ôn tập chọn nguồn *Sổ từ đã lưu*, **Then** hệ thống hiển thị chính xác 3 từ vừa lưu, cho phép bắt đầu phiên **Luyện tập tự chọn** bằng cả 4 hình thức (có chú thích rõ phiên luyện tập tự chọn này không làm thay đổi lịch ôn SM-2 chính thức hay chuỗi Streak hằng ngày) và ghi nhận kết quả vào Lịch sử.
5. **Given** người học đóng trình duyệt rồi mở lại ứng dụng trên cùng thiết bị, **When** truy cập lại Sổ từ đã lưu và Bảng xếp hạng, **Then** danh sách từ đã lưu và điểm số/thứ hạng mới nhất vẫn được giữ nguyên.

---

### User Story 7 - Trợ lý AI (Bản v1) và Popup Hỗ trợ Quản trị viên (Priority: P3)

Người học có thể mở màn hình **Trợ lý AI** từ thanh điều hướng để hỏi nghĩa từ, phân biệt từ đồng nghĩa, xem câu ví dụ công sở hoặc xin tư vấn lộ trình học trong nhiều cuộc hội thoại độc lập; đồng thời ở bất kỳ trang nào đều có nút **Hỗ trợ** nổi ở góc phải dưới để liên hệ Quản trị viên, gửi góp ý/báo lỗi, xem tư vấn khóa học hoặc mở liên kết cộng đồng học tập.

**Why this priority**: Tách Trợ lý AI toàn màn hình khỏi Popup Hỗ trợ QTV giúp người học đọc nội dung tiếng Anh thoải mái, đồng thời giữ kênh hỗ trợ kỹ thuật luôn sẵn sàng ở mọi trang.

**Independent Test**: Có thể kiểm thử độc lập bằng cách mở mục Trợ lý AI, gửi 2 câu hỏi (phân biệt 2 từ tiếng Anh và hỏi nghĩa 1 từ trong Oxford 3000), tạo cuộc hội thoại mới và kiểm tra lịch sử được giữ lại; sau đó bấm nút Hỗ trợ góc phải dưới để thử mở Chat QTV và gửi biểu mẫu Góp ý/Báo lỗi.

**Acceptance Scenarios**:

1. **Given** người học mở mục Trợ lý AI trên thanh điều hướng ở bản v1 (khi dịch vụ AI phía máy chủ chưa kích hoạt), **When** nhập câu hỏi chứa từ tiếng Anh thuộc kho Oxford 3000 (VD: *"Phân biệt peaceful và calm?"* hoặc *"Cho 3 ví dụ với achieve"*), **Then** Trợ lý AI trả về câu trả lời có cấu trúc rõ ràng (nghĩa, IPA, ví dụ hoặc so sánh) kèm nút **Nghe phát âm** và **Mở trong Tra từ**.
2. **Given** người học gửi câu hỏi trong Trợ lý AI rồi tạo cuộc trò chuyện mới hoặc tải lại trang, **When** mở lại danh sách hội thoại bên cột trái, **Then** cuộc trò chuyện trước vẫn được lưu giữ nguyên vẹn và có thể chọn xem lại hoặc xóa.
3. **Given** người học nhấn nút Hỗ trợ nổi ở góc phải dưới màn hình, **When** hộp thoại *"HỖ TRỢ — Bạn cần hỗ trợ gì?"* xuất hiện, **Then** hiển thị đủ 4 kênh (*Chat với Quản trị viên*, *Góp ý/Báo lỗi*, *Tư vấn khóa học*, *Cộng đồng học tập*) và đóng lại khi nhấn nút `×`, nhấn ngoài khung hoặc phím `Esc`.
4. **Given** người học chọn kênh *Góp ý/Báo lỗi* trong Popup Hỗ trợ và gửi biểu mẫu hợp lệ, **When** gửi thành công, **Then** hiển thị thông báo xác nhận cho người học và đẩy một thông báo tiếp nhận mới vào Trung tâm Thông báo trên thanh đầu trang.

---

### User Story 8 - Khu vực Quản trị viên (Admin Portal) (Priority: P3)

Người dùng đăng nhập bằng tài khoản mang vai trò **Quản trị viên** có khu vực quản trị riêng để theo dõi thống kê tổng quan hệ thống, tìm kiếm và xem danh sách học viên phân trang, khóa hoặc mở khóa tài khoản học viên vi phạm có hộp thoại xác nhận, và tra cứu nhật ký kiểm toán hoạt động quản trị.

**Why this priority**: Tận dụng đầy đủ 4 nghiệp vụ quản trị đã đặc tả sẵn ở `002-backend-core`, hoàn thiện cả hai vai trò người dùng (Học viên và Quản trị viên) khi nghiệm thu đồ án.

**Independent Test**: Có thể kiểm thử độc lập bằng cách đăng nhập tài khoản Quản trị viên, kiểm tra số liệu thống kê, khóa rồi mở lại 1 tài khoản học viên và xác nhận bản ghi tương ứng xuất hiện trong bảng Nhật ký kiểm toán; sau đó đăng nhập bằng tài khoản Học viên để xác nhận khu vực Quản trị bị ẩn và chặn truy cập trực tiếp.

**Acceptance Scenarios**:

1. **Given** người dùng đăng nhập bằng tài khoản có vai trò Quản trị viên, **When** mở thanh điều hướng, **Then** xuất hiện mục **Quản trị hệ thống** dẫn tới trang tổng quan hiển thị số liệu học viên, hoạt động học tập và trạng thái hệ thống.
2. **Given** Quản trị viên mở danh sách học viên, **When** chuyển trang hoặc nhập từ khóa tìm kiếm theo tên/email, **Then** danh sách hiển thị đúng kết quả phân trang kèm trạng thái hoạt động (*Đang hoạt động* / *Đã khóa*).
3. **Given** Quản trị viên nhấn nút Khóa hoặc Mở khóa trên một tài khoản học viên và xác nhận trong hộp thoại, **When** thao tác hoàn tất, **Then** trạng thái tài khoản cập nhật ngay trên bảng, hiển thị thông báo xác nhận và ghi nhận hành động mới trong Nhật ký kiểm toán.
4. **Given** người dùng có vai trò Học viên nhập trực tiếp đường dẫn khu vực Quản trị trên trình duyệt, **When** trang được mở, **Then** hệ thống chặn truy cập và điều hướng an toàn về Trang chủ kèm thông báo không có quyền truy cập.

---

### Edge Cases

- **Mất kết nối mạng hoặc dịch vụ máy chủ trả lỗi:** Từng khu vực dữ liệu (bảng thống kê, danh sách bài học, kết quả tra từ, bảng quản trị) phải hiển thị trạng thái lỗi cục bộ kèm nút **"Thử lại"** thay vì làm trắng hoặc sập toàn bộ ứng dụng.
- **Trạng thái đang tải (Loading) và dữ liệu trống (Empty State):** Khi chờ tải dữ liệu phải hiển thị khung xương (skeleton) hoặc chỉ báo tải; khi người dùng mới chưa có từ đến hạn SM-2, chưa lưu từ nào trong Sổ từ hoặc chưa có lịch sử học tập phải hiển thị thông báo trống thân thiện kèm nút kêu gọi hành động dẫn tới bài học hoặc Tra từ.
- **Hết hạn phiên đăng nhập giữa lúc đang làm bài:** Nếu phiên hết hạn và tự động gia hạn thất bại khi người dùng bấm nộp bài, hệ thống thông báo rõ nguyên nhân và điều hướng đăng nhập lại mà không treo giao diện.
- **Trình duyệt không hỗ trợ phát âm hoặc tệp âm thanh bị lỗi tải:** Hiển thị thông báo nhẹ nhàng và dự phòng nguồn phát âm thay thế nếu khả dụng, không làm gián đoạn luồng học.
- **Tương thích đa kích thước màn hình (`320px` – `1440px+`):** Trên màn hình nhỏ (`320px` – `768px`), thanh menu bên trái tự động thu gọn thành ngăn kéo (drawer) đóng mở bằng nút menu; thẻ lật, nút đáp án trắc nghiệm, ô gõ từ và bảng quản trị không bị tràn ngang.
- **Từ vựng đa từ loại (Multi-POS) cùng mặt chữ:** Khi tra cứu hoặc học từ có nhiều từ loại (VD: `close` động từ và `close` tính từ), giao diện phải hiển thị rõ nhãn từ loại (`v.`, `adj.`) để người học không nhầm lẫn.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (Xác thực & Phiên):** Hệ thống MUST cung cấp giao diện Đăng ký, Đăng nhập bằng email/mật khẩu, Đăng nhập một chạm bằng tài khoản Google, Đổi mật khẩu và Đăng xuất có hộp thoại xác nhận; mọi biểu mẫu MUST kiểm tra tính hợp lệ đầu vào trước khi gửi.
- **FR-002 (Bảo vệ đường dẫn & Phân quyền):** Hệ thống MUST chặn truy cập các màn hình học tập khi chưa đăng nhập, tự động gia hạn phiên khi hết hạn, và ẩn/chặn mọi giao diện Quản trị viên đối với tài khoản có vai trò Học viên.
- **FR-003 (Đồng bộ thông số Toàn ứng dụng):** Hệ thống MUST hiển thị nhất quán Tên người dùng, Ảnh đại diện, Cấp độ mục tiêu CEFR, Chuỗi ngày học (Streak) và Tổng điểm XP trên mọi màn hình (thanh đầu trang, Trang chủ, Bảng xếp hạng tuần, Hồ sơ cá nhân), tự động cập nhật ngay sau khi hoàn thành bài học hoặc phiên ôn tập mà không cần tải lại trang.
- **FR-004 (Lộ trình Khóa học & Mở khóa tuần tự):** Hệ thống MUST hiển thị danh sách bài học theo 4 cấp độ CEFR (`A1`, `A2`, `B1`, `B2`) và chủ đề, mở khóa sẵn Bài học 1 của từng chủ đề, hiển thị trạng thái khóa/mở khóa và điểm cao nhất của từng bài, và chỉ mở khóa bài kế tiếp khi bài liền trước đạt $\ge 80\%$.
- **FR-005 (Chu trình học Bước 1 — Học nạp Flashcard):** Hệ thống MUST hiển thị đầy đủ 15–18 từ/bài (bài cuối tối đa 20 từ) dưới dạng thẻ lật 2 mặt (từ vựng sạch, nhãn từ loại, phiên âm IPA, nút nghe phát âm tốc độ chuẩn và chậm `0.7×`, nghĩa tiếng Việt, câu ví dụ song ngữ có tô nổi từ khóa), ghi nhận từng thẻ đã mở và yêu cầu mở đủ toàn bộ thẻ trong bài mới cho phép bắt đầu Bước 2.
- **FR-006 (Chu trình học Bước 2 — Luyện tập & Kiểm tra):** Hệ thống MUST hỗ trợ đầy đủ các dạng bài tập: Trắc nghiệm 4 phương án, Gõ từ theo nghĩa (có gợi ý chữ cái và câu ví dụ khuyết từ), Nghe chép chính tả (cho phép nghe lại không giới hạn tốc độ chuẩn/chậm), và Bài kiểm tra tổng hợp trên các chủ đề đã học.
- **FR-007 (Phản hồi chấm điểm thông minh):** Hệ thống MUST hiển thị trực quan phân biệt 4 trạng thái chấm điểm đồng nhất với `002-backend-core` và Hiến pháp: **Chính xác** (`1,0` điểm, xanh lá), **Gần đúng** (`0,5` điểm, vàng/cam — **chỉ áp dụng** khi sai lệch 1 ký tự hoặc đảo 2 chữ cái liền kề trên từ mục tiêu dài $\ge 3$ ký tự), **Đúng âm sai chữ** (`0,0` điểm, xanh dương khuyến khích kèm chính tả chuẩn ở bài Nghe chép), và **Chưa đúng** (`0,0` điểm, đỏ kèm đáp án đúng — bao gồm mọi lỗi sai chính tả trên từ ngắn dài $< 3$ ký tự).
- **FR-008 (Ôn tập Ngắt quãng SM-2 & 5 Hộp Leitner):** Hệ thống MUST hiển thị danh sách và số lượng từ đến hạn ôn tập trong ngày theo múi giờ Việt Nam (`UTC+7`), trực quan hóa số lượng thẻ trong 5 Hộp Leitner (`Hộp 1` $\rightarrow$ `Hộp 5`), và cập nhật ngay kết quả tổng kết phiên sau khi nộp bài.
- **FR-009 (Tra cứu Từ điển Oxford 3000):** Hệ thống MUST cho phép tra cứu từ vựng theo từ tiếng Anh hoặc nghĩa tiếng Việt (hỗ trợ không dấu), lọc đa tiêu chí (cấp độ CEFR, loại từ, chủ đề), gợi ý sửa lỗi chính tả khi không có kết quả khớp chính xác, phát âm thanh chuẩn/chậm và hỗ trợ mở nhanh từ ô tìm kiếm trên thanh đầu trang (`Ctrl/Cmd + K`).
- **FR-010 (Trang Lịch sử Học tập chi tiết tách biệt):** Hệ thống MUST tách toàn bộ danh sách lịch sử bài học và phiên ôn tập ra một trang riêng (đặt trên mục Trang cá nhân ở thanh điều hướng), tự động cập nhật ngay khi người học hoàn thành bài học hoặc phiên ôn tập, cho phép mở chi tiết danh sách từng từ đúng/sai trong mỗi phiên, lọc theo loại hoạt động và trạng thái đạt/chưa đạt, giới hạn chiều cao hiển thị gọn tối đa 10 phiên mới nhất có thanh cuộn trong khung và cung cấp nút ôn lại phiên hoặc ôn riêng các từ sai.
- **FR-011 (Hồ sơ Cá nhân & Cài đặt Nhắc học):** Hệ thống MUST cho phép người học cập nhật họ tên, ảnh đại diện, trình độ mục tiêu CEFR, mục tiêu từ vựng hằng ngày và bật/tắt tùy chọn nhận email nhắc học/cảnh báo mất chuỗi lúc 20:00; đồng thời hiển thị biểu đồ tiến độ, phân bổ từ vựng theo CEFR và lịch chuỗi ngày học.
- **FR-012 (Trung tâm Thông báo):** Hệ thống MUST cung cấp bảng thông báo tương tác tại nút chuông đầu trang với chấm báo chưa đọc, lọc *Tất cả / Chưa đọc*, đánh dấu đã đọc tất cả, xóa từng thông báo và điều hướng nhanh đến màn hình liên quan khi nhấp vào thông báo.
- **FR-013 (Trạng thái giao diện & Tương thích thiết bị):** Hệ thống MUST hiển thị trạng thái tải (khung xương / chỉ báo tải), trạng thái trống và thông báo lỗi thân thiện kèm nút thử lại trên mọi khu vực tải dữ liệu; đảm bảo hiển thị không tràn ngang trên toàn dải màn hình `320px` – `1440px+` và hỗ trợ phím tắt học tập cơ bản (`Space`, `Enter`, `1`–`4`, `Ctrl/Cmd + K`).
- **FR-014 (Trợ lý AI bản v1 & Popup Hỗ trợ QTV):** Hệ thống MUST cung cấp màn hình **Trợ lý AI** trên thanh điều hướng (quản lý nhiều cuộc hội thoại, gợi ý câu hỏi nhanh; ở bản v1 trả lời tra nghĩa, câu ví dụ và phân biệt từ dựa trên kho từ vựng Oxford 3000, lưu giữ hội thoại giữa các lần mở lại trang, kèm nút nghe phát âm và mở nhanh trong Tra từ) và **Popup Hỗ trợ** nổi góc phải dưới với 4 kênh (*Chat với Quản trị viên*, *Góp ý/Báo lỗi*, *Tư vấn khóa học*, *Cộng đồng học tập*).
- **FR-015 (Khu vực Quản trị viên):** Hệ thống MUST cung cấp khu vực **Quản trị viên** chỉ hiển thị với tài khoản có vai trò Quản trị viên, bao gồm: danh sách học viên phân trang kèm tìm kiếm, thao tác khóa/mở khóa tài khoản có hộp thoại xác nhận, màn hình thống kê tổng quan hệ thống và bảng xem nhật ký kiểm toán; tài khoản Học viên MUST bị ẩn mục menu và chặn truy cập trực tiếp.
- **FR-016 (Bảng xếp hạng Tuần & Sổ từ đã lưu):** Hệ thống MUST cung cấp **Bảng xếp hạng tuần** (tự động sắp xếp lại thứ hạng theo XP giảm dần ngay khi điểm XP thay đổi, đồng bộ tên/ảnh đại diện và nhãn thứ hạng nhóm, hộp thoại xem toàn bộ thành viên nhóm có trạng thái tải khung xương và hộp thoại xem nhanh hồ sơ học tập công khai ẩn email/SĐT) và **Sổ từ đã lưu** (đánh dấu lưu/bỏ lưu từ trong Tra từ, lọc xem riêng Sổ từ, giữ nguyên danh sách giữa các lần mở lại trang trên thiết bị và cho phép mở phiên **Luyện tập tự chọn** từ các từ đã lưu với nhãn phân biệt rõ không làm thay đổi lịch SM-2 và chuỗi Streak chính thức).

### Key Entities *(Các thực thể dữ liệu hiển thị ở phía người dùng)*

- **Tài khoản & Hồ sơ người dùng (`UserProfile`)**: Định danh, họ tên, email, ảnh đại diện, vai trò (Học viên / Quản trị viên), cấp độ mục tiêu CEFR, mục tiêu từ/ngày, trạng thái bật/tắt nhắc học qua email.
- **Bài học & Tiến độ (`LessonProgress`)**: Mã bài học, chủ đề, cấp độ CEFR, số thứ tự bài, danh sách 15–18 từ vựng, số thẻ đã mở ở Bước 1, trạng thái mở khóa, trạng thái hoàn thành và điểm cao nhất (`%`).
- **Mục từ điển & Sổ từ (`VocabularyItem`, `SavedWord`)**: Mã từ, chuỗi từ sạch, loại từ, cấp độ CEFR, chủ đề, phiên âm IPA, đường dẫn âm thanh (nếu có), nghĩa tiếng Việt, câu ví dụ tiếng Anh, bản dịch tiếng Việt và trạng thái đã lưu vào Sổ từ.
- **Phiên luyện tập / Ôn tập (`PracticeSession`)**: Loại bài (Học nạp, Thực hành bài học, Ôn tập SM-2, Kiểm tra tổng hợp), danh sách câu hỏi, câu trả lời người học, phản hồi chấm điểm từng câu, điểm tổng (`%`), đạt/chưa đạt chuẩn $\ge 80\%$, thời gian hoàn thành và XP thưởng.
- **Tổng quan Tiến độ, SM-2 & Xếp hạng (`LearningOverview`, `LeaderboardEntry`)**: Chuỗi ngày học hiện tại, kỷ lục chuỗi, trạng thái hoàn thành hôm nay, tổng điểm XP, phân bố 5 Hộp Leitner, số từ đến hạn ôn hôm nay, thống kê 7 ngày gần nhất và thông tin công khai từng thành viên trong nhóm thi đua tuần.
- **Mục Lịch sử, Thông báo & Hội thoại (`ActivityHistoryItem`, `NotificationItem`, `ChatConversation`)**: Nhật ký các bài học/phiên ôn tập kèm danh sách từng từ đúng/sai, thông báo nhắc nhở/thành tích có trạng thái đã đọc/chưa đọc, và danh sách hội thoại Trợ lý AI / Hỗ trợ QTV.
- **Bản ghi Quản trị (`AdminUserRow`, `AuditLogEntry`)**: Thông tin tóm tắt tài khoản học viên kèm trạng thái hoạt động/bị khóa và bản ghi nhật ký kiểm toán thao tác quản trị.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Người học mới có thể hoàn tất đăng ký tài khoản, vào Trang chủ và mở thẻ từ đầu tiên của Bài học 1 trong vòng **dưới 2 phút** mà không cần hướng dẫn ngoài ứng dụng.
- **SC-002**: 100% bài học trong ứng dụng tuân thủ đúng chu trình 2 bước (không cho phép vào Bước 2 khi chưa mở đủ thẻ ở Bước 1) và cổng mở khóa $\ge 80\%$ giữa các bài học liên tiếp.
- **SC-003**: Thao tác tìm kiếm từ điển trên tập 3.813 từ Oxford 3000 (theo tiếng Anh hoặc tiếng Việt không dấu) và lọc theo cấp độ/loại từ/chủ đề hiển thị kết quả trong **dưới 300 mili-giây** sau khi người dùng ngừng gõ *(đo trên dữ liệu đã nạp sẵn tại thiết bị hoặc trong điều kiện mạng chuẩn có độ trễ phản hồi máy chủ dưới 150 mili-giây)*.
- **SC-004**: 100% số liệu tổng quan trọng yếu (điểm XP, thứ hạng nhóm, chuỗi Streak, tên & ảnh đại diện người dùng) luôn đồng bộ nhất quán giữa thanh đầu trang, Trang chủ, Bảng xếp hạng tuần, Hồ sơ cá nhân và trang Lịch sử ngay sau khi người học hoàn tất một bài học hoặc phiên ôn tập mà không cần tải lại trang.
- **SC-005**: 100% lượt trả lời ở bài tập Gõ từ và Nghe chép chính tả hiển thị đúng 1 trong 4 nhãn phân loại phản hồi (*Chính xác*, *Gần đúng*, *Đúng âm sai chữ*, *Chưa đúng*) phân biệt rõ bằng cả màu sắc lẫn nội dung chữ tiếng Việt, giúp người học nhận biết ngay lỗi sai và đáp án chuẩn trong dưới 3 giây.
- **SC-006**: Giao diện hiển thị không vỡ bố cục, không tràn ngang và thao tác chạm/nhấp dễ dàng trên toàn dải kích thước màn hình mục tiêu: `320px` (điện thoại nhỏ), `768px` (máy tính bảng), `1280px` và `1440px+` (máy tính để bàn).
- **SC-007**: Khi kết nối mạng gián đoạn hoặc dịch vụ máy chủ phản hồi lỗi, 100% các màn hình chính hiển thị thông báo lỗi tiếng Việt dễ hiểu kèm nút thử lại, không phát sinh màn hình trắng.

---

## Assumptions

- **Bản mẫu trực quan tham chiếu**: Giao diện và bố cục các màn hình chính (Trang chủ, Khóa học, Thẻ học 3D, Ôn tập 4 chế độ, Tra từ, Trợ lý AI, Popup Hỗ trợ QTV, Lịch sử cuộn 10 phiên, Hồ sơ cá nhân, Thông báo) kế thừa ngôn ngữ thiết kế sạch, dịu mắt từ `font-end/Dashboard/` đã được nhóm duyệt.
- **Phụ thuộc dịch vụ phía máy chủ**: Các nghiệp vụ đăng nhập, dữ liệu từ vựng, bài học 2 bước, nộp bài chấm điểm SM-2, thống kê Streak/Leitner và quản trị tiêu thụ trực tiếp các đầu mối nghiệp vụ đã đặc tả tại `specs/001-vocabulary-data` và `specs/002-backend-core`.
- **Ngôn ngữ & Múi giờ**: Toàn bộ giao diện hướng tới sinh viên Việt Nam sử dụng tiếng Việt làm ngôn ngữ hiển thị chính và tính mốc ngày học (Streak, từ đến hạn ôn) theo múi giờ Việt Nam (`UTC+7`).
- **Môi trường trình duyệt**: Người học sử dụng các trình duyệt hiện đại (Chrome, Edge, Safari, Firefox phiên bản gần đây) có kết nối mạng ổn định; âm thanh phát âm ưu tiên nguồn chuẩn từ dữ liệu bài học và có dự phòng phát âm của trình duyệt khi chưa có tệp âm thanh tĩnh.
