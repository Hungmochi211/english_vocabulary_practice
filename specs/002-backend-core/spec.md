# Feature Specification: Xác thực Người dùng, Động cơ Học tập Tương tác, Ôn tập Ngắt quãng SM-2 và Chuỗi Ngày học (Streak)

**Feature Branch**: `002-backend-core`

**Created**: 2026-11-18 | **Last Updated**: 2026-11-18

**Status**: Draft (Ready for User Approval)

**Input**: Đề cương Thực tập Chuyên ngành FITA - VNUA (Nội dung 2 & 3): Xây dựng phân hệ Quản lý & Xác thực tài khoản, Chu trình học 2 bước (Học nạp Flashcard → Học áp dụng qua bài tập Trắc nghiệm, Gõ từ, Nghe chép chính tả), Chấm điểm sai lệch chính tả & âm vị học (Levenshtein, Damerau-Levenshtein, Soundex/Double Metaphone), Lặp lại ngắt quãng SuperMemo SM-2 đồng bộ 5 Hộp Leitner, và Gamification chuỗi ngày học (Streak) kèm nhắc nhở email tự động lúc 20:00.

---

## Scope & System Boundary *(Ranh giới hệ thống)*

- **Thuộc phạm vi Feature 002**:
  - Đăng ký, đăng nhập (email/mật khẩu và đăng nhập qua tài khoản Google), làm mới phiên đăng nhập, đăng xuất, quản lý hồ sơ cá nhân và phân quyền người dùng (**Học viên** / **Quản trị viên**).
  - Quản lý tiến độ bài học theo chu trình sư phạm 2 bước bắt buộc (**Học nạp** $\rightarrow$ **Học áp dụng**) và cổng mở khóa bài học kế tiếp khi đạt độ chính xác $\ge 80\%$.
  - Động cơ sinh bài tập thực hành (Trắc nghiệm 4 đáp án với đáp án nhiễu cùng từ loại & chủ đề, Gõ từ theo nghĩa, Nghe chép chính tả, và Bài kiểm tra tổng hợp lấy mẫu phân tầng) kèm chấm điểm thông minh và quy đổi điểm nhớ tự động.
  - Động cơ tính toán lịch ôn tập ngắt quãng **SuperMemo SM-2** đồng bộ trạng thái trực quan **5 Hộp thẻ Leitner** cho từng cặp `(người học, từ vựng)`.
  - Ghi nhận lịch sử học tập theo ngày, tính chuỗi ngày học liên tục (**Streak**) và tác vụ tự động quét gửi email cảnh báo mất chuỗi lúc **20:00 hằng ngày** (giờ Việt Nam).
- **Ngoài phạm vi Feature 002**:
  - Lưu trữ kho từ vựng chuẩn Oxford 3000 và chia sẵn bài học 15–18 từ (bài cuối tối đa 20 từ): kế thừa trực tiếp từ **Feature `001-vocabulary-data`**.
  - Trợ lý ảo Chatbot AI hỏi đáp ngữ cảnh (3 công cụ tra cứu từ, xem tiến độ, tạo quiz nhanh): tách riêng sang **Feature `003-ai-chatbot`**.
  - Giao diện màn hình người dùng trên trình duyệt (trang Đăng nhập, Bảng điều khiển, hiệu ứng lật thẻ, giao diện làm bài tập): tách riêng sang **Feature `004-frontend-webapp`**.

---

## Clarifications

### Session 2026-11-18

- Q: Trợ lý ảo Chatbot AI gộp chung vào Feature 002 hay tách riêng, và khi nào người học được tính `+1` ngày học vào chuỗi Streak? → A: Tách riêng Trợ lý ảo Chatbot AI sang **Feature `003-ai-chatbot`**. Chuỗi ngày học (`Streak`) được tính hoàn thành trong ngày khi người học hoàn tất **ít nhất 1 bài tập thực hành của bài học** HOẶC hoàn tất **1 phiên ôn tập SM-2 với tối thiểu 10 từ đến hạn** (nếu tổng số từ đến hạn trong ngày của người học ít hơn 10 nhưng $\ge 1$, hoàn tất toàn bộ số từ đến hạn đó cũng được ghi nhận).
- Q: Khi học viên mới tạo tài khoản, các bài học đầu tiên trong lộ trình được mở khóa như thế nào? → A: Mở khóa sẵn **Bài học 1 (`order_index = 1`)** của tất cả các chủ đề thuộc từng cấp độ CEFR (`A1`–`B2`, 8 chủ đề/cấp độ trong tổng 16 chủ đề chuẩn hóa) để sinh viên tự chọn cấp độ/chủ đề phù hợp năng lực; từ Bài học 2 trở đi trong từng nhóm `(cấp độ, chủ đề)` mở khóa tuần tự khi bài liền trước đạt $\ge 80\%$.
- Q: Câu trả lời *"Gần đúng"* được tính điểm như thế nào vào ngưỡng qua bài $\ge 80\%$, và điểm chất lượng nhớ $q \in \{0..5\}$ của SM-2 được xác định ra sao? → A: Câu *"Gần đúng"* (khoảng cách Damerau-Levenshtein $= 1$ trên từ dài $\ge 3$ ký tự) được tính **`0,5` điểm** (câu Chính xác tính `1,0` điểm; câu Đúng âm sai chữ và câu Sai tính `0,0` điểm). Điểm chất lượng nhớ $q \in \{0..5\}$ của SM-2 được hệ thống **tự động suy ra** từ phân loại kết quả chấm điểm và thời gian phản hồi của từng câu hỏi (không bắt người học tự bấm chọn thủ công).

### Session 2026-11-23

- Q: Người học cần làm gì trong bước Học nạp để hệ thống ghi nhận bài học đã hoàn tất bước này? → A: Người học phải mở từng thẻ từ trong bài ít nhất một lần.
- Q: Bài tập thực hành không đạt ngưỡng hoàn thành bài học có vẫn cập nhật lịch ôn SM-2 cho các từ đã trả lời không? → A: Có; sau khi nộp bài, cập nhật SM-2 cho các câu đã trả lời dù bài đạt hay không đạt ngưỡng.
- Q: Câu bị bỏ trống hoặc hết giờ (`q = 0`) có nên cập nhật hồ sơ SM-2 của từ đó sau khi nộp bài không? → A: Có; câu bỏ trống hoặc hết giờ cập nhật SM-2 với `q = 0`.
- Q: Nếu cùng một người học nộp gần như đồng thời nhiều câu trả lời cho cùng một từ, hệ thống nên áp dụng các cập nhật SM-2 theo quy tắc nào? → A: Áp dụng mỗi kết quả đã nộp đúng một lần, tuần tự theo thứ tự máy chủ nhận.
- Q: Khi người học dùng mã làm mới phiên, hệ thống nên xử lý mã đó thế nào? → A: Mỗi lần làm mới, cấp mã mới và vô hiệu hóa mã cũ; nếu phát hiện mã cũ bị dùng lại, thu hồi phiên liên quan.
- Q: Sau khi người học đăng xuất, access token đã cấp còn được chấp nhận cho tới khi hết hạn 15 phút không? → A: Có; access token còn hiệu lực tối đa 15 phút, còn refresh token bị thu hồi ngay khi đăng xuất.
- Q: Khi người học đổi mật khẩu, hệ thống nên xử lý các phiên đang hoạt động trên những thiết bị khác như thế nào? → A: Kết thúc mọi phiên trên mọi thiết bị ngay lập tức, gồm access token và refresh token.
- Q: Luồng đổi mật khẩu có thuộc phạm vi feature này không, và người dùng cần xác thực thế nào? → A: Hỗ trợ đổi mật khẩu cho tài khoản email/mật khẩu; yêu cầu mật khẩu hiện tại và mật khẩu mới đạt FR-002.
- Q: Hệ thống nên giới hạn các lần đăng nhập thất bại để giảm nguy cơ dò mật khẩu như thế nào? → A: Giới hạn theo cả tài khoản và địa chỉ IP, dùng ngưỡng cấu hình được và tạm hoãn yêu cầu đăng nhập khi vượt ngưỡng.
- Q: Nếu Google trả về email chưa được xác thực, hệ thống nên xử lý đăng nhập thế nào? → A: Từ chối đăng nhập và yêu cầu người dùng xác thực email Google trước khi thử lại.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Đăng ký, đăng nhập và quản lý hồ sơ học viên (Priority: P1)

Người học mới tạo tài khoản bằng email và mật khẩu (hoặc đăng nhập nhanh bằng tài khoản Google) để hệ thống lưu trữ tiến độ học tập cá nhân, lịch ôn tập từ vựng và chuỗi ngày học trên nhiều thiết bị. Người học có thể xem, cập nhật thông tin hồ sơ cá nhân (họ tên, ảnh đại diện, mục tiêu cấp độ, bật/tắt email nhắc học), đổi mật khẩu cho tài khoản email/mật khẩu bằng cách xác thực mật khẩu hiện tại, và đăng xuất an toàn.

**Why this priority**: Mọi tiến độ bài học, tham số ghi nhớ SM-2 và chuỗi ngày học đều gắn chặt với định danh từng cá nhân; không có tài khoản thì không thể cá nhân hóa lộ trình học.

**Independent Test**: Tạo một tài khoản mới bằng email, đăng nhập lấy phiên làm việc, truy cập hồ sơ cá nhân, sửa họ tên, đăng xuất, kiểm tra refresh token bị thu hồi ngay lập tức và access token đã cấp vẫn được chấp nhận tối đa 15 phút kể từ lúc cấp.

**Acceptance Scenarios**:

1. **Given** email `sv01@vnua.edu.vn` chưa từng đăng ký, **When** người dùng gửi thông tin đăng ký hợp lệ (họ tên, email, mật khẩu đủ độ mạnh), **Then** hệ thống tạo tài khoản với vai trò **Học viên**, khởi tạo chuỗi ngày học bằng `0`, mặc định bật nhận email nhắc học và trả về phiên đăng nhập hợp lệ. (Mã: `US1-AS1`)
2. **Given** email `sv01@vnua.edu.vn` đã tồn tại trong hệ thống, **When** người dùng đăng ký lại bằng email này (kể cả viết hoa `SV01@vnua.edu.vn` hoặc có khoảng trắng đầu/cuối), **Then** hệ thống từ chối và thông báo rõ email đã được sử dụng. (Mã: `US1-AS2`)
3. **Given** tài khoản đã đăng ký bằng email và mật khẩu, **When** người dùng đăng nhập đúng thông tin, **Then** hệ thống cấp phiên truy cập ngắn hạn kèm mã làm mới phiên; **When** nhập sai mật khẩu hoặc email không tồn tại, **Then** hệ thống từ chối với thông báo chung *"Email hoặc mật khẩu không chính xác"* (không tiết lộ tài khoản có tồn tại hay không). (Mã: `US1-AS3`)
4. **Given** người dùng chọn đăng nhập bằng Google với email trùng với tài khoản đã đăng ký trước đó, **When** xác thực Google thành công, **Then** hệ thống liên kết vào cùng tài khoản hiện có (không tạo tài khoản trùng lặp) và bảo toàn nguyên vẹn tiến độ học tập. (Mã: `US1-AS4`)
5. **Given** Học viên A đang đăng nhập, **When** cố truy cập hoặc sửa đổi tiến độ học tập/hồ sơ của Học viên B, **Then** hệ thống từ chối quyền truy cập. (Mã: `US1-AS5`)
6. **Given** người dùng đang có phiên đăng nhập hoạt động, **When** thực hiện đăng xuất, **Then** refresh token của phiên bị thu hồi ngay lập tức và không thể dùng để xin cấp access token mới; access token đã cấp vẫn được chấp nhận cho tới khi hết hạn, tối đa 15 phút kể từ lúc cấp. (Mã: `US1-AS6`)
7. **Given** phiên đăng nhập đang hoạt động với mã làm mới `R1`, **When** người dùng làm mới phiên thành công, **Then** hệ thống cấp mã mới `R2` và vô hiệu hóa `R1`; nếu `R1` được dùng lại, hệ thống thu hồi toàn bộ access token và refresh token thuộc phiên đó, đồng thời từ chối cấp phiên mới. (Mã: `US1-AS7`)
8. **Given** người dùng đang đăng nhập trên nhiều thiết bị, **When** đổi mật khẩu thành công, **Then** hệ thống thu hồi ngay tất cả access token và refresh token của người dùng trên mọi thiết bị, buộc người dùng đăng nhập lại. (Mã: `US1-AS8`)
9. **Given** người dùng đang đăng nhập bằng tài khoản email/mật khẩu, **When** gửi yêu cầu đổi mật khẩu với mật khẩu hiện tại không chính xác, **Then** hệ thống từ chối, không thay đổi mật khẩu và giữ nguyên các phiên đang hoạt động. (Mã: `US1-AS9`)
10. **Given** người dùng đang đăng nhập bằng tài khoản email/mật khẩu, **When** gửi mật khẩu hiện tại chính xác cùng mật khẩu mới đáp ứng FR-002, **Then** hệ thống đổi mật khẩu thành công và thu hồi mọi phiên trên mọi thiết bị theo US1-AS8. (Mã: `US1-AS10`)
11. **Given** tài khoản hoặc địa chỉ IP đã vượt ngưỡng đăng nhập thất bại được cấu hình, **When** có thêm yêu cầu đăng nhập trong thời gian chờ tạm thời, **Then** hệ thống từ chối yêu cầu mà không tiết lộ tài khoản có tồn tại hay không; sau khi hết thời gian chờ, người dùng có thể thử lại.
12. **Given** Google trả về email chưa được xác thực, **When** người dùng thử đăng nhập bằng Google, **Then** hệ thống từ chối đăng nhập và yêu cầu xác thực email trước khi thử lại.

---

### User Story 2 - Học bài theo chu trình 2 bước và mở khóa bài học kế tiếp (Priority: P1)

Người học xem lộ trình học tập với **Bài học 1 (`order_index = 1`)** của mọi chủ đề và cấp độ được mở sẵn. Khi chọn một bài học đã mở khóa, hệ thống bắt buộc người học đi qua **Bước 1 — Học nạp (Acquisition)**: mở từng thẻ từ vựng trong bài (15–18 từ, bài cuối nhóm tối đa 20 từ) ít nhất một lần. Hệ thống ghi nhận các thẻ đã mở và chỉ đánh dấu Bước 1 hoàn tất khi mọi thẻ trong bài đã được mở. Chỉ sau đó hệ thống mới cho phép bắt đầu **Bước 2 — Học áp dụng (Application)**: làm bài tập thực hành cho toàn bộ từ trong bài. Khi nộp bài đạt tổng điểm tỷ lệ **$\ge 80,00\%$** (câu đúng tính `1,0` điểm, câu gần đúng tính `0,5` điểm), bài học được đánh dấu hoàn thành, các từ vựng được cập nhật vào lịch ôn tập SM-2, và bài học kế tiếp trong cùng chủ đề & cấp độ được mở khóa.

**Why this priority**: Đảm bảo kỷ luật sư phạm cốt lõi của đề tài — chống học vẹt hoặc nhảy cóc làm bài trắc nghiệm may rủi khi chưa tiếp thu ngữ cảnh từ vựng.

**Independent Test**: Tạo tài khoản mới, kiểm tra Bài 1 của mọi chủ đề mở sẵn còn Bài 2 đang khóa; kiểm tra bị chặn nếu làm bài tập Bài 1 khi chưa mở từng thẻ từ ít nhất một lần; mở hết các thẻ Học nạp, nộp Bài 1 (16 từ) đạt `75%` (chưa mở Bài 2), sau đó làm lại đạt `81,25%` (12 câu đúng + 2 câu gần đúng) và kiểm tra Bài 2 được mở khóa.

**Acceptance Scenarios**:

1. **Given** tài khoản học viên mới tạo, **When** xem lộ trình ở bất kỳ cấp độ nào (`A1`–`B2`), **Then** toàn bộ các bài học có `order_index = 1` của cả 8 chủ đề đều ở trạng thái *"Đã mở khóa"*, còn các bài có `order_index >= 2` đều ở trạng thái *"Đang khóa"*. (Mã: `US2-AS1`)
2. **Given** Bài học 1 đang mở nhưng người học chưa mở từng thẻ từ của Bài học 1 ít nhất một lần, **When** người học yêu cầu khởi tạo hoặc nộp bài tập thực hành của Bài học 1, **Then** hệ thống từ chối và yêu cầu mở hết thẻ từ trước. (Mã: `US2-AS2`)
3. **Given** Bài học 2 trong cùng chủ đề & cấp độ đang ở trạng thái khóa (vì Bài học 1 chưa đạt $\ge 80\%$), **When** người học yêu cầu học hoặc làm bài tập của Bài học 2 (ở chế độ vận hành chuẩn), **Then** hệ thống từ chối và báo cần hoàn thành Bài học 1 với kết quả tối thiểu `80%`. (Mã: `US2-AS3`)
4. **Given** Bài học 1 có 16 từ và người học đã hoàn tất bước Học nạp, **When** người học nộp bài tập đạt 12 câu đúng và 4 câu sai ($12 / 16 = 75,00\% < 80\%$), **Then** hệ thống lưu lịch sử lần làm bài với tỷ lệ `75,00%`, cập nhật lịch SM-2 cho 16 từ theo kết quả từng câu, trạng thái Bài học 1 vẫn là *"Chưa hoàn thành"*, Bài học 2 vẫn khóa, và cho phép làm lại bài tập mà không bắt thực hiện lại bước Học nạp. (Mã: `US2-AS4`)
5. **Given** cùng Bài học 1 (16 từ), **When** người học nộp bài tập gồm 12 câu Chính xác (`12 × 1,0`), 2 câu Gần đúng (`2 × 0,5`) và 2 câu Sai (`0,0`) đạt tổng điểm $13,0 / 16 = 81,25\% \ge 80\%$, **Then** Bài học 1 chuyển sang *"Đã hoàn thành"*, lưu điểm cao nhất `81,25%`, mở khóa Bài học 2 của cùng chủ đề & cấp độ, và cập nhật hồ sơ ôn tập SM-2 cho cả 16 từ. (Mã: `US2-AS5`)
6. **Given** môi trường kiểm thử/phát triển bật cờ bỏ qua khóa bài (`bypass unlock gate`), **When** người kiểm thử truy cập thẳng Bài học 5 chưa mở khóa, **Then** hệ thống cho phép truy cập để phục vụ kiểm thử độc lập. (Mã: `US2-AS6`)

---

### User Story 3 - Làm bài tập phản xạ và nhận phản hồi chấm điểm thông minh (Priority: P1)

Trong giai đoạn Học áp dụng, Ôn tập hoặc Kiểm tra tổng hợp, người học thực hiện 3 dạng bài tập phản xạ:
1. **Trắc nghiệm 4 đáp án (Multiple Choice)**: Hiển thị từ tiếng Anh (hoặc nghĩa tiếng Việt) cùng 4 phương án A, B, C, D gồm 1 đáp án đúng và 3 đáp án nhiễu cùng loại từ & cùng chủ đề, xáo trộn ngẫu nhiên đồng đều.
2. **Gõ từ theo nghĩa (Typing)**: Nhìn nghĩa tiếng Việt, từ loại và câu ví dụ khuyết từ để gõ lại từ tiếng Anh; nhận diện lỗi đánh máy nhẹ hoặc đảo 2 ký tự liền kề để phản hồi *"Gần đúng"* (`0,5` điểm).
3. **Nghe chép chính tả (Dictation)**: Nghe phát âm mẫu và gõ lại từ tiếng Anh; nếu viết sai mặt chữ quá 1 ký tự nhưng phát âm tương đương từ gốc, hệ thống chỉ rõ *"Bạn nghe đúng phát âm nhưng viết sai chính tả!"*.

**Why this priority**: Rèn luyện phản xạ chủ động đa giác quan (nhìn - nghe - gõ) và phản hồi sư phạm tức thì thay vì chỉ chấm Đúng/Sai đơn điệu.

**Independent Test**: Sinh đề trắc nghiệm và kiểm tra 100% đáp án nhiễu hợp lệ; gửi lần lượt các câu trả lời đúng tuyệt đối, sai 1 ký tự, đảo 2 ký tự liền kề, đồng âm sai chữ và sai trên từ ngắn $< 3$ ký tự để kiểm tra phân loại và số điểm trả về.

**Acceptance Scenarios**:

1. **Given** từ mục tiêu `abandon` (`v.`, cấp độ B2, chủ đề `Society & Law`), **When** hệ thống sinh câu hỏi trắc nghiệm, **Then** kết quả có đúng 4 phương án không trùng từ và không trùng nghĩa tiếng Việt (1 đáp án đúng + 3 đáp án nhiễu đều là động từ `v.` thuộc cùng chủ đề và cấp độ), vị trí đáp án đúng được xáo trộn bằng Fisher-Yates Shuffle. (Mã: `US3-AS1`)
2. **Given** bài tập Gõ từ với đáp án mục tiêu `abandon`, **When** người học nhập `"  ABANDON  "`, **Then** hệ thống chuẩn hóa chuỗi, phân loại **Chính xác** (khoảng cách chỉnh sửa $= 0$) và tính `1,0` điểm. (Mã: `US3-AS2`)
3. **Given** bài tập Gõ từ với đáp án mục tiêu `people` (độ dài $\ge 3$), **When** người học gõ đảo 2 ký tự liền kề `"peopel"` hoặc thiếu 1 ký tự `"peple"` (khoảng cách Damerau-Levenshtein $= 1$), **Then** hệ thống phân loại **Gần đúng**, tính `0,5` điểm và hiển thị mặt chữ chuẩn `people` để người học ghi nhớ. (Mã: `US3-AS3`)
4. **Given** bài tập Nghe chép chính tả với đáp án mục tiêu `phone`, **When** người học gõ `"fone"` (khoảng cách chỉnh sửa $= 2$ nhưng trùng mã âm vị học Soundex/Double Metaphone), **Then** hệ thống phân loại **Đúng âm vị - Sai chính tả**, tính `0,0` điểm và hiển thị thông điệp *"Bạn nghe đúng phát âm nhưng viết sai chính tả! Từ đúng là: phone"*. (Mã: `US3-AS4`)
5. **Given** bài tập Gõ từ với từ ngắn `in` (độ dài $< 3$), **When** người học gõ `"on"` (sai 1 ký tự nhưng làm đổi hoàn toàn từ ngắn), **Then** hệ thống phân loại **Chưa chính xác** và tính `0,0` điểm (không áp dụng "Gần đúng" cho từ dưới 3 ký tự). (Mã: `US3-AS5`)
6. **Given** người học yêu cầu tạo một bài Kiểm tra tổng hợp 20 câu trên 4 chủ đề đã học, **When** hệ thống rút trích câu hỏi theo phương pháp lấy mẫu phân tầng (Stratified Sampling), **Then** mỗi chủ đề đóng góp đúng 5 câu hỏi đại diện, không bị lệch dồn vào một chủ đề duy nhất. (Mã: `US3-AS6`)

---

### User Story 4 - Ôn tập từ vựng dài hạn theo thuật toán SuperMemo SM-2 và 5 Hộp Leitner (Priority: P1)

Hằng ngày, người học mở mục **Ôn tập hôm nay** và nhận danh sách các từ vựng đã đến hạn ôn tập (`next_review_date <= hôm nay`). Sau mỗi câu trả lời, hệ thống tự động suy ra điểm chất lượng nhớ $q \in \{0..5\}$ dựa trên độ chính xác và thời gian phản hồi, tính toán lại hệ số độ dễ ($EF'$), số lần nhớ liên tiếp ($n'$), khoảng cách ngày ôn tiếp theo ($I'$) theo công thức SuperMemo SM-2, đồng thời luân chuyển từ vựng giữa **5 Hộp thẻ Leitner (Box 1 $\rightarrow$ Box 5)**.

**Why this priority**: Chống lại đường cong quên lãng Ebbinghaus — đây là thuật toán khoa học trọng tâm của đề cương thực tập chuyên ngành.

**Independent Test**: Thực hiện chuỗi trả lời với các mức kết quả & thời gian phản hồi khác nhau để kiểm tra tự động quy đổi ra $q \in \{0..5\}$, sau đó đối chiếu từng tham số $EF', n', I'$, ngày ôn kế tiếp và số Hộp Leitner với kết quả tính tay.

**Acceptance Scenarios**:

1. **Given** từ vựng ôn lần đầu vào ngày `D` ($EF = 2.50, n = 0, I = 0$), **When** người học trả lời **Chính xác** trong `8.000 ms` (suy ra $q = 4$), **Then** $EF' = 2.50$, $n' = 1$, $I' = 1$ ngày, ngày ôn kế tiếp là `D + 1`, từ vựng nằm ở **Hộp Leitner 2**. (Mã: `US4-AS1`)
2. **Given** từ vựng đang có $EF = 2.50, n = 1, I = 1$ tại ngày `D + 1`, **When** người học trả lời **Chính xác** trong `3.200 ms` (phản xạ nhanh $\le 5.000\text{ ms} \Rightarrow q = 5$), **Then** $EF' = 2.60$, $n' = 2$, $I' = 6$ ngày, ngày ôn kế tiếp là `D + 7`, từ vựng thăng lên **Hộp Leitner 3**. (Mã: `US4-AS2`)
3. **Given** từ vựng đang có $EF = 2.60, n = 2, I = 6$ tại ngày `D + 7`, **When** người học gõ **Gần đúng** sai 1 ký tự (hoặc trả lời Chính xác chậm `15.000 ms` $\Rightarrow q = 3$), **Then** $EF' = 2.46$, $n' = 3$, $I' = \text{round}(6 \times 2.46) = 15$ ngày, ngày ôn kế tiếp là `D + 22`, từ vựng thăng lên **Hộp Leitner 4**. (Mã: `US4-AS3`)
4. **Given** từ vựng đang ở Hộp Leitner 4 ($EF = 2.46, n = 3, I = 15$), **When** người học trả lời **Chưa chính xác** ($q = 1 < 3$), **Then** $EF' = 1.92$, số lần nhớ liên tiếp đặt lại $n' = 0$, chu kỳ đặt lại $I' = 1$ ngày, và từ vựng bị hạ thẳng về **Hộp Leitner 1**. (Mã: `US4-AS4`)
5. **Given** từ vựng đang có $EF = 1.50$, **When** người học bỏ qua câu hỏi / nhấn *"Không nhớ"* ($q = 0$, công thức tính ra $1.50 - 0.80 = 0.70$), **Then** hệ thống giữ ngưỡng sàn $EF' = 1.30$ (không bao giờ giảm dưới $1.30$), $n' = 0, I' = 1$ ngày, ở **Hộp Leitner 1**. (Mã: `US4-AS5`)
6. **Given** người học có 25 từ có `next_review_date <= hôm nay` và 40 từ có `next_review_date > hôm nay`, **When** mở danh sách cần ôn tập hôm nay (với giới hạn mặc định 20 từ/phiên), **Then** hệ thống trả về 20 từ đến hạn đầu tiên được sắp xếp theo Hộp Leitner tăng dần (Hộp 1 trước) và ngày đến hạn cũ nhất trước, kèm tổng số từ còn tồn đọng (`total_due = 25`). (Mã: `US4-AS6`)
7. **Given** hồ sơ SM-2 của một từ đang ở trạng thái ban đầu ($EF = 2.50, n = 0, I = 0$), **When** cùng người học gửi gần như đồng thời hai kết quả cho từ đó, kết quả thứ nhất có $q = 4$ và kết quả thứ hai có $q = 5$, **Then** hệ thống áp dụng mỗi kết quả đúng một lần theo thứ tự nhận, trạng thái cuối là $EF = 2.60, n = 2, I = 6$ ngày và Hộp Leitner 3. (Mã: `US4-AS7`)

---

### User Story 5 - Theo dõi chuỗi ngày học liên tục (Streak), thống kê tiến độ và nhận email nhắc nhở lúc 20:00 (Priority: P2)

Người học xem bảng thống kê cá nhân gồm: số ngày học liên tục hiện tại (`current_streak`), kỷ lục chuỗi dài nhất (`longest_streak`), phân bố số lượng từ vựng trong 5 Hộp Leitner, và biểu đồ số từ đã học/ôn trong 7 ngày gần nhất. Hằng ngày vào đúng **20:00 (giờ Việt Nam)**, nếu người học đang có chuỗi ngày học $\ge 1$ nhưng từ `00:00` đến `20:00` hôm đó chưa hoàn thành hoạt động học tập đủ điều kiện, hệ thống tự động gửi email nhắc nhở để người học kịp vào học trước nửa đêm.

**Why this priority**: Cơ chế Gamification tạo thói quen kỷ luật hằng ngày, giảm tỷ lệ bỏ cuộc giữa chừng của sinh viên tự học.

**Independent Test**: Giả lập hoàn thành bài tập/phiên ôn ở các ngày liên tiếp `D`, cùng ngày `D`, ngày kế tiếp `D + 1`, và bỏ cách ngày `D + 3` để kiểm tra bộ đếm chuỗi; kích hoạt tác vụ quét lúc 20:00 và kiểm tra đúng những người có nguy cơ mất chuỗi nhận tối đa 1 email nhắc nhở/ngày.

**Acceptance Scenarios**:

1. **Given** người học đang có `current_streak = 3`, `longest_streak = 5` và ngày học gần nhất là hôm qua (`D - 1`), **When** trong hôm nay (`D`, theo `UTC+7`) người học hoàn thành 1 bài tập bài học (hoặc 1 phiên ôn tập SM-2 đủ 10 từ đến hạn), **Then** `current_streak` tăng lên `4`, `longest_streak` vẫn là `5`; **When** người học học thêm bài thứ hai cũng trong ngày `D`, **Then** `current_streak` giữ nguyên là `4`. (Mã: `US5-AS1`)
2. **Given** người học chỉ có tổng cộng 4 từ đến hạn ôn tập SM-2 trong ngày `D` (`0 < total_due < 10`), **When** người học hoàn thành ôn tập hết cả 4 từ đến hạn đó, **Then** hệ thống vẫn ghi nhận hoàn thành mục tiêu ngày `D` và cộng `+1` vào `current_streak`. (Mã: `US5-AS2`)
3. **Given** người học đang có `current_streak = 6`, `longest_streak = 6` và ngày học gần nhất là `D - 2` (đã bỏ lỡ ngày `D - 1`), **When** người học quay lại hoàn thành bài học vào ngày `D`, **Then** chuỗi hiện tại đặt lại `current_streak = 1`, trong khi kỷ lục `longest_streak = 6` vẫn được bảo toàn. (Mã: `US5-AS3`)
4. **Given** thời điểm hệ thống là `20:00` ngày `D` (`UTC+7`), Học viên A có `current_streak = 5` (lần học cuối là `D - 1`, bật nhận email), Học viên B có `current_streak = 5` (đã hoàn thành bài học lúc `09:00` sáng ngày `D`), Học viên C có `current_streak = 0`, Học viên D có `current_streak = 3` nhưng tắt nhận email, **When** tác vụ quét nhắc nhở chạy, **Then** chỉ duy nhất Học viên A được đưa vào hàng đợi gửi email cảnh báo mất chuỗi. (Mã: `US5-AS4`)
5. **Given** Học viên A đã được tạo lệnh gửi email nhắc nhở trong ngày `D`, **When** tác vụ quét lúc 20:00 được kích hoạt lại lần thứ hai trong cùng ngày `D`, **Then** hệ thống nhận diện đã gửi trong ngày và không gửi email trùng lặp lần hai. (Mã: `US5-AS5`)

---

### Edge Cases

1. **Ranh giới nửa đêm theo múi giờ Việt Nam (`UTC+7`)**: Người học bắt đầu bài tập lúc `23:55` ngày `D` và nộp bài hoàn thành lúc `00:03` ngày `D + 1` — ngày học được ghi nhận theo thời điểm hoàn thành nộp bài (`D + 1`); nếu ngày `D` chưa có hoạt động hoàn thành nào khác thì ngày `D` bị tính là bỏ lỡ.
2. **Truy vấn trạng thái Streak khi người học đã nghỉ quá hạn chưa học lại**: Nếu hôm nay là `D` mà `last_study_date <= D - 2` (người học đã đứt chuỗi từ hôm qua nhưng hôm nay chưa làm bài nào), khi người học xem trang cá nhân thì `current_streak` hiển thị ngay giá trị thực tế là `0` (không hiển thị con số cũ gây hiểu lầm).
3. **Từ loại hiếm không đủ 3 đáp án nhiễu trong cùng chủ đề**: Ví dụ từ cảm thán (`exclam.`) hoặc động từ khuyết thiếu (`modal v.`) trong một chủ đề chỉ có 1–2 từ — hệ thống tự động mở rộng sang cùng cấp độ & cùng từ loại ở chủ đề khác, rồi đến cùng từ loại trên toàn kho từ để luôn đảm bảo đủ 4 phương án A, B, C, D không trùng từ và không trùng nghĩa tiếng Việt.
4. **Từ đa từ loại hoặc từ đồng nghĩa trong câu trắc nghiệm**: Khi sinh đáp án nhiễu cho từ `close` (`adj.` — gần gũi), hệ thống loại trừ mọi bản ghi có cùng mặt chữ `close` hoặc trùng nghĩa tiếng Việt để không sinh câu hỏi có 2 đáp án đúng.
5. **Cụm từ ghép có khoảng trắng trong bài Gõ từ**: Các mục từ như `ice cream`, `next to`, `all right` — khi người học gõ dư khoảng trắng ở giữa (`"ice   cream"`), hệ thống chuẩn hóa gộp khoảng trắng thừa thành 1 dấu cách đơn trước khi tính khoảng cách chỉnh sửa.
6. **Từ ngắn dưới 3 ký tự trong bài Gõ từ / Nghe chép chính tả**: Các từ 1–2 ký tự (`a`, `I`, `in`, `to`, `do`, `be`) nếu sai 1 ký tự (như gõ `on` thay vì `in`) sẽ bị phân loại **Chưa chính xác** (`0,0` điểm, $q = 1$), không áp dụng chế độ *"Gần đúng"*.
7. **Làm lại bài học đã từng hoàn thành trước đó**: Khi người học làm lại bài tập của một bài đã đạt $\ge 80\%$ (ví dụ trước đó đạt `85,00%`, lần làm lại chỉ đạt `60,00%`), trạng thái *"Đã hoàn thành"*, quyền mở khóa bài kế tiếp và kỷ lục `best_score = 85,00%` **được giữ nguyên không bao giờ bị thu hồi**, nhưng kết quả từng câu của lần làm mới vẫn cập nhật vào SM-2 để phản ánh đúng trí nhớ hiện tại.
8. **Từ vựng chưa có đường dẫn âm thanh (`audio_url = null` hoặc rỗng)**: Khi sinh đề bài tập cho từ thiếu âm thanh, hệ thống tự động chuyển câu hỏi của từ đó sang dạng Trắc nghiệm hoặc Gõ từ theo nghĩa, tuyệt đối không sinh câu hỏi Nghe chép chính tả bị câm tiếng.
9. **Dịch vụ gửi email bên ngoài tạm thời lỗi hoặc chậm**: Tác vụ gửi email nhắc Streak chạy bất đồng bộ qua hàng đợi với cơ chế thử lại tối đa 3 lần (giãn cách tăng dần); sự cố dịch vụ email không làm ảnh hưởng đến luồng học tập của người dùng.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống MUST phân tách 2 vai trò người dùng: **Học viên** (tự đăng ký, học bài, làm bài tập, ôn tập SM-2, xem thống kê cá nhân của chính mình) và **Quản trị viên** (quản trị người dùng, xem thống kê tổng thể hệ thống). Học viên MUST NOT xem hoặc tác động được vào dữ liệu của học viên khác.
- **FR-002**: Hệ thống MUST hỗ trợ đăng ký/đăng nhập bằng **Email + Mật khẩu** (email chuẩn hóa chữ thường, cắt khoảng trắng, tối đa 255 ký tự; họ tên 1–100 ký tự; mật khẩu 8–72 ký tự gồm ít nhất 1 chữ cái và 1 chữ số, băm một chiều an toàn), đổi mật khẩu cho tài khoản email/mật khẩu khi người dùng cung cấp đúng mật khẩu hiện tại và mật khẩu mới đáp ứng cùng quy tắc độ mạnh, và đăng nhập qua **Google OAuth 2.0** (tự động hợp nhất tài khoản theo email đã xác thực; MUST từ chối đăng nhập nếu Google trả về email chưa được xác thực). Hệ thống MUST giới hạn đăng nhập thất bại theo cả tài khoản và địa chỉ IP bằng ngưỡng và thời gian chờ tạm thời có thể cấu hình; phản hồi khi bị giới hạn MUST không tiết lộ tài khoản có tồn tại hay không.
- **FR-003**: Hệ thống MUST quản lý phiên đăng nhập bằng cơ chế access token ngắn hạn (hiệu lực 15 phút) và refresh token dài hạn (hiệu lực 7 ngày, lưu trữ bản băm). Mỗi lần làm mới thành công MUST cấp refresh token mới và vô hiệu hóa mã cũ; nếu mã cũ đã bị thay thế được dùng lại, hệ thống MUST thu hồi mọi access token và refresh token thuộc cùng phiên đăng nhập và từ chối cấp phiên mới. Khi người dùng đăng xuất, refresh token của phiên hiện tại MUST bị thu hồi ngay lập tức; access token đã cấp vẫn được chấp nhận tới khi hết hạn, tối đa 15 phút kể từ lúc cấp. Khi người dùng đổi mật khẩu thành công, hệ thống MUST thu hồi ngay tất cả access token và refresh token thuộc mọi phiên trên mọi thiết bị, buộc đăng nhập lại.
- **FR-004**: Hệ thống MUST thực thi nghiêm ngặt chu trình sư phạm 2 bước cho mọi bài học: người học bắt buộc mở từng thẻ từ trong bài ít nhất một lần để hoàn tất ghi nhận **Bước 1 — Học nạp (Acquisition)** trước khi được phép khởi tạo hoặc nộp **Bước 2 — Học áp dụng (Application)**. Hệ thống MUST ghi nhận các từ đã mở theo từng bài học và chỉ đánh dấu Acquisition hoàn tất khi mọi từ của bài học đã được mở. Các lần làm lại bài tập của cùng bài học đó không bắt buộc phải chạy lại Bước 1.
- **FR-005**: Quy tắc mở khóa lộ trình bài học:
  - Ngay khi khởi tạo tài khoản, tất cả các bài học đầu tiên (`order_index = 1`) của mọi chủ đề trong từng cấp độ (`A1`, `A2`, `B1`, `B2`, tổng 16 chủ đề chuẩn hóa) đều ở trạng thái **Đã mở khóa**.
  - Trong cùng một nhóm `(cefr_level, topic_id)`, bài học có `order_index = k` ($k \ge 2$) chỉ được mở khóa khi bài học `order_index = k - 1` đã được hoàn thành với tỷ lệ điểm bài tập thực hành **$\ge 80,00\%$**.
  - Trạng thái đã hoàn thành, quyền mở khóa bài kế tiếp và điểm cao nhất (`best_score`) được bảo lưu vĩnh viễn dù các lần luyện lại sau có điểm thấp hơn.
  - Hệ thống MUST hỗ trợ cờ cấu hình môi trường cho phép bỏ qua điều kiện khóa bài trong môi trường phát triển và kiểm thử tự động.
- **FR-006**: Hệ thống MUST sinh được 3 dạng câu hỏi bài tập cho bài học (và chế độ Kiểm tra tổng hợp rút trích câu hỏi theo phương pháp lấy mẫu phân tầng **Stratified Sampling** phân bổ đều giữa các chủ đề đã học):
  1. **Trắc nghiệm 4 phương án (Multiple Choice)**: 1 đáp án đúng + 3 đáp án nhiễu không trùng mặt chữ `word` và không trùng `vietnamese_meaning`, chọn theo thứ tự ưu tiên: (1) cùng cấp độ + cùng chủ đề + cùng từ loại $\rightarrow$ (2) cùng cấp độ + cùng từ loại ở chủ đề khác $\rightarrow$ (3) cùng từ loại trên toàn kho từ; sau đó xáo trộn vị trí 4 phương án bằng thuật toán **Fisher-Yates Shuffle**.
  2. **Gõ từ theo nghĩa (Typing)**: Cung cấp nghĩa tiếng Việt, từ loại và câu ví dụ đã che từ cần điền để người học nhập từ tiếng Anh.
  3. **Nghe chép chính tả (Dictation)**: Cung cấp đường dẫn âm thanh phát âm mẫu (`audio_url`) để người học gõ lại từ tiếng Anh (chỉ áp dụng cho từ có `audio_url` hợp lệ; nếu từ thiếu `audio_url` thì tự động chuyển sang Trắc nghiệm hoặc Gõ từ).
- **FR-007**: Hệ thống MUST chuẩn hóa chuỗi nhập liệu tự luận của người học (cắt khoảng trắng hai đầu, gộp nhiều khoảng trắng liên tiếp ở giữa thành 1 dấu cách đơn, chuyển về chữ thường, độ dài tối đa 100 ký tự) và phân loại kết quả chấm điểm như sau:
  - **Chính xác** (`1,0` điểm): Chọn đúng phương án trắc nghiệm, hoặc chuỗi nhập sau chuẩn hóa khớp tuyệt đối với từ mục tiêu (khoảng cách chỉnh sửa $= 0$).
  - **Gần đúng** (`0,5` điểm): Trong bài Gõ từ hoặc Nghe chép chính tả, từ mục tiêu có độ dài **$\ge 3$ ký tự** và khoảng cách **Damerau-Levenshtein $= 1$** (thêm 1 ký tự, thiếu 1 ký tự, thay 1 ký tự, hoặc hoán vị 2 ký tự liền kề).
  - **Đúng âm vị - Sai chính tả** (`0,0` điểm, kèm gợi ý phát âm): Trong bài Nghe chép chính tả, khoảng cách Damerau-Levenshtein $\ge 2$ nhưng mã **Soundex** hoặc **Double Metaphone** của chuỗi nhập khớp với từ mục tiêu.
  - **Chưa chính xác** (`0,0` điểm): Mọi trường hợp trả lời sai còn lại (bao gồm lỗi sai 1 ký tự trên từ ngắn $< 3$ ký tự) hoặc bỏ trống câu trả lời.
- **FR-008**: Hệ thống MUST tính tỷ lệ điểm bài tập (%) theo công thức $\big(\sum \text{Điểm từng câu} / \text{Tổng số câu}\big) \times 100$ (làm tròn 2 chữ số thập phân) và **tự động quy đổi** mỗi câu trả lời kèm thời gian phản hồi hợp lệ (`0 <= response_time_ms <= 300.000`) sang điểm chất lượng nhớ $q \in \{0, 1, 2, 3, 4, 5\}$ của SM-2 như sau:
  - **$q = 5$**: Kết quả **Chính xác** và thời gian phản hồi nhanh (`response_time_ms <= 5.000`).
  - **$q = 4$**: Kết quả **Chính xác** và thời gian phản hồi trung bình (`5.000 < response_time_ms <= 12.000`).
  - **$q = 3$**: Kết quả **Chính xác** nhưng thời gian phản hồi chậm (`response_time_ms > 12.000`), HOẶC kết quả **Gần đúng** (`0,5` điểm).
  - **$q = 2$**: Kết quả **Đúng âm vị - Sai chính tả** trong bài Nghe chép chính tả.
  - **$q = 1$**: Kết quả **Chưa chính xác** (người học có chọn hoặc gõ câu trả lời nhưng sai).
  - **$q = 0$**: Người học bỏ trống / nhấn *"Không nhớ"* / hết thời gian trả lời.
- **FR-009**: Sau mỗi lần nộp bài tập thực hành hoặc phiên ôn tập, hệ thống MUST tính toán và lưu trữ lịch ôn tập ngắt quãng theo công thức **SuperMemo SM-2** cho từng cặp `(người học, từ vựng)` có kết quả câu hỏi, bất kể bài tập thực hành đạt ngưỡng hoàn thành bài học hay không; câu bỏ trống hoặc hết giờ MUST được tính là $q = 0$ và vẫn cập nhật SM-2. Nếu nhiều kết quả cho cùng `(người học, từ vựng)` được nộp gần như đồng thời, hệ thống MUST áp dụng từng kết quả đúng một lần và tuần tự theo thứ tự máy chủ nhận. Tham số khởi tạo trước lần chấm đầu tiên là $EF = 2.50, n = 0, I = 0$:
  - Cập nhật hệ số độ dễ: $EF' = \max\big(1.30,\; EF + (0.1 - (5 - q) \times (0.08 + (5 - q) \times 0.02))\big)$, làm tròn chính xác đến 2 chữ số thập phân.
  - Nếu $q < 3$: đặt lại số lần nhớ liên tiếp $n' = 0$ và chu kỳ ôn tập $I' = 1$ ngày.
  - Nếu $q \ge 3$: tăng $n' = n + 1$; với $n' = 1 \Rightarrow I' = 1$ ngày; với $n' = 2 \Rightarrow I' = 6$ ngày; với $n' \ge 3 \Rightarrow I' = \text{round}(I \times EF')$ ngày (làm tròn half-up đến số nguyên ngày).
  - Ngày ôn tập kế tiếp: `next_review_date` = Ngày hiện tại theo `UTC+7` $+ I'$ ngày.
- **FR-010**: Hệ thống MUST đồng bộ trạng thái trực quan **5 Hộp thẻ Leitner** theo số lần nhớ liên tiếp $n'$ sau mỗi lượt cập nhật SM-2:
  - $n' = 0 \rightarrow$ **Hộp 1**
  - $n' = 1 \rightarrow$ **Hộp 2**
  - $n' = 2 \rightarrow$ **Hộp 3**
  - $n' \in \{3, 4\} \rightarrow$ **Hộp 4**
  - $n' \ge 5 \rightarrow$ **Hộp 5**
- **FR-011**: Hệ thống MUST cung cấp danh sách từ cần ôn tập hằng ngày gồm các thẻ nhớ của người học có `next_review_date <= ngày hiện tại (UTC+7)`, sắp xếp theo `leitner_box ASC, next_review_date ASC, id ASC`, cho phép truyền giới hạn phiên ôn `limit` ($1 \le \text{limit} \le 50$, mặc định 20) và trả kèm tổng số từ đến hạn (`total_due`).
- **FR-012**: Hệ thống MUST ghi nhận nhật ký hoạt động học tập hằng ngày theo múi giờ `UTC+7` và cập nhật chuỗi ngày học (`current_streak`, `longest_streak`) khi người học đạt điều kiện hoàn thành mục tiêu ngày — cụ thể là hoàn tất **ít nhất 1 bài tập thực hành bài học** HOẶC hoàn tất **1 phiên ôn tập SM-2 với tối thiểu 10 từ đến hạn** (hoặc toàn bộ số từ đến hạn trong ngày nếu người học có $1 \le \text{total\_due} < 10$). Khi người học truy vấn hồ sơ mà `last_study_date <= hôm nay - 2 ngày`, giá trị `current_streak` trả về MUST phản ánh đúng bằng `0`.
- **FR-013**: Vào đúng **20:00 hằng ngày (`UTC+7`)**, tác vụ tự động chạy nền MUST quét danh sách học viên đang bật nhận email nhắc học, có `current_streak >= 1` và `last_study_date = hôm qua` (tức hôm nay chưa đạt mục tiêu ngày), đẩy tác vụ gửi email cảnh báo mất chuỗi vào hàng đợi bất đồng bộ với cam kết **tối đa 1 email nhắc nhở/người/ngày** và thử lại tối đa 3 lần khi lỗi mạng.
- **FR-014**: Toàn bộ thao tác quan trọng (đăng ký, đăng nhập thành công/thất bại, thu hồi phiên, mở khóa bài học, chạy quét nhắc streak) MUST được ghi nhật ký kiểm toán (người thực hiện, hành động, thời điểm, kết quả) và tuyệt đối không chứa mật khẩu, mã xác thực hay khóa bí mật ở dạng rõ.

---

### Key Entities

- **Người dùng (User)**: Định danh học viên/quản trị viên, email duy nhất, mật khẩu băm (nếu đăng ký mật khẩu), mã định danh Google (nếu liên kết Google), họ tên, ảnh đại diện, mục tiêu cấp độ CEFR, vai trò (`learner` / `admin`), cờ bật nhận email nhắc học, chuỗi ngày học hiện tại (`current_streak`), kỷ lục chuỗi (`longest_streak`), ngày hoàn thành mục tiêu gần nhất (`last_study_date`).
- **Phiên làm mới (Refresh Session)**: Liên kết tới Người dùng, định danh nhóm phiên đăng nhập (`session_family_id`), bản băm mã làm mới hiện tại, thời điểm hết hạn, thời điểm thu hồi hoặc bị thay thế, và thông tin trình duyệt/thiết bị cơ bản. Đăng xuất thu hồi refresh token nhưng không vô hiệu hóa access token đã cấp; khi thu hồi nhóm phiên do phát hiện dùng lại mã cũ hoặc đổi mật khẩu, mọi access token và refresh token thuộc phạm vi thu hồi đều mất hiệu lực.
- **Tiến độ Bài học (User Lesson Progress)**: Liên kết duy nhất `(Người dùng, Bài học)`, tập ID từ vựng đã mở trong bước Học nạp, cờ hoàn thành bước Học nạp (`acquisition_completed`, chỉ bật khi mọi từ của bài học đã được mở), trạng thái hoàn thành bài học (`is_completed`), tỷ lệ điểm cao nhất (`best_score`), số lần làm bài tập (`attempts_count`), thời điểm hoàn thành lần đầu.
- **Lượt làm bài tập (Quiz Attempt & Answer)**: Lưu thông tin đề bài tập đã sinh cho người học (loại bài: bài học / ôn tập SM-2 / kiểm tra tổng hợp), danh sách từng câu hỏi kèm phương án/đáp án mục tiêu, câu trả lời người học gửi lên, thời gian phản hồi từng câu (`response_time_ms`), kết quả phân loại chấm điểm, điểm số từng câu (`1,0` / `0,5` / `0,0`), điểm nhớ $q$ suy ra và tổng tỷ lệ phần trăm toàn bài.
- **Hồ sơ Ôn tập Thẻ nhớ (User SM-2 Review)**: Liên kết duy nhất `(Người dùng, Từ vựng)`, hệ số độ dễ `easiness_factor` ($1,30 \dots$, khởi tạo $2,50$), số lần nhớ liên tiếp `repetitions` ($n$), khoảng cách ngày `interval_days` ($I$), ngày đến hạn ôn kế tiếp `next_review_date`, số hộp `leitner_box` ($1 \dots 5$), điểm $q$ lần ôn gần nhất và thời điểm ôn gần nhất.
- **Nhật ký Học tập theo ngày (Daily Study Log)**: Liên kết duy nhất `(Người dùng, Ngày học UTC+7)`, số bài học đã hoàn thành trong ngày, số lượt từ SM-2 đã ôn trong ngày, cờ đánh dấu đã đạt mục tiêu Streak trong ngày (`streak_qualified`), và cờ đã gửi/xếp hàng email nhắc nhở 20:00 trong ngày (`reminder_sent`).
- **Nhật ký Hệ thống (Audit Log)**: Người thực hiện (hoặc khách ẩn danh khi đăng nhập thất bại), mã hành động, đối tượng tác động, thời điểm, kết quả thành công/thất bại.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Người dùng mới hoàn tất đăng ký tài khoản và bắt đầu xem thẻ từ đầu tiên của Bài học 1 trong **dưới 1 phút**.
- **SC-002**: **100%** kết quả quy đổi điểm $q \in \{0..5\}$ và tính toán tham số ôn tập ($EF', n', I'$, ngày ôn kế tiếp, Hộp Leitner 1–5) khớp tuyệt đối với kết quả tính tay theo công thức chuẩn SuperMemo SM-2 trên toàn bộ kịch bản kiểm thử (bao gồm biên thời gian `5.000 ms`, `12.000 ms`, câu Gần đúng `0,5` điểm và sàn $EF_{min} = 1,30$).
- **SC-003**: **100%** câu hỏi trắc nghiệm sinh ra có đúng 4 phương án không trùng từ và không trùng nghĩa tiếng Việt, đúng từ loại mục tiêu, và phân phối vị trí đáp án đúng A/B/C/D qua 1.000 lần sinh ngẫu nhiên nằm trong biên độ cân bằng $25\% \pm 3\%$.
- **SC-004**: **100%** trường hợp gõ sai 1 ký tự hoặc hoán vị 2 ký tự liền kề trên từ dài $\ge 3$ ký tự được chấm chính xác `0,5` điểm (*"Gần đúng"*), từ ngắn $< 3$ ký tự sai 1 ký tự chấm `0,0` điểm, và các cặp đồng âm khác chữ tiêu biểu (`fone`/`phone`, `nite`/`night`, `rite`/`write`) trong bài Nghe chép chính tả nhận đúng phản hồi âm vị học.
- **SC-005**: **0%** trường hợp học viên ở chế độ chuẩn có thể nộp bài tập khi chưa hoàn thành bước Học nạp hoặc mở khóa bài kế tiếp trong chủ đề khi tổng điểm đạt dưới `80,00%`.
- **SC-006**: 95% thao tác hoàn thành Học nạp, sinh đề bài tập 15–20 câu, chấm điểm nộp bài và tải danh sách ôn tập SM-2 phản hồi kết quả trong **dưới 200 mili-giây** (với tải kiểm thử đồng thời 100 người học hoạt động).
- **SC-007**: Tác vụ quét nhắc nhở lúc 20:00 phân loại xong 10.000 hồ sơ người học và xếp hàng thông báo trong **dưới 30 giây**, đảm bảo **0%** trường hợp một học viên bị gửi quá 1 email nhắc nhở trong cùng một ngày.

---

## Assumptions

- Kho từ vựng chuẩn hóa và danh sách bài học 15–18 từ (bài cuối nhóm tối đa 20 từ) đã được khởi tạo sẵn từ **Feature `001-vocabulary-data`**.
- Toàn bộ phép tính ranh giới ngày học, ngày đến hạn ôn tập SM-2 và lịch quét nhắc nhở 20:00 được chuẩn hóa thống nhất theo **múi giờ Việt Nam (`Asia/Ho_Chi_Minh`, `UTC+7`)**.
- Trong giai đoạn v1, đăng ký bằng email và mật khẩu cho phép kích hoạt học ngay để tối ưu trải nghiệm bắt đầu nhanh cho sinh viên; luồng đặt lại mật khẩu qua OTP email có thể bổ sung ở phiên bản mở rộng.
- Tài khoản Quản trị viên ban đầu được cấp qua công cụ khởi tạo dữ liệu hệ thống, không mở đăng ký công khai cho vai trò Quản trị viên.
