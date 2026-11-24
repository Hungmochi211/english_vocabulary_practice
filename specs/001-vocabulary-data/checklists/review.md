# Requirements Review Checklist: Kho từ vựng Oxford 3000 và Bài học

**Purpose**: Đánh giá độ đầy đủ, rõ ràng, nhất quán và khả năng đo lường của yêu cầu dữ liệu, phân bổ bài học, tra cứu và trải nghiệm học.
**Created**: 2026-11-17
**Feature**: [spec.md](../spec.md)
**Scope / Depth**: Tổng thể (lựa chọn A), mức tiêu chuẩn.
**Actor / Timing**: Người duyệt tài liệu, trước triển khai.
**User must-have**: Không cho phép bài học dưới 15 từ trong bất kỳ trường hợp nào.

**Note**: Checklist tùy chỉnh được tạo bằng `/speckit-checklist` từ spec, plan và tasks hiện có.
**Review Ownership**: Checklist thuộc người duyệt chất lượng yêu cầu. Chỉ người duyệt quyết định tiêu chí nào được đánh dấu `[x]`; agent chỉ hỗ trợ đánh giá khi được yêu cầu rõ ràng.
**Marker Semantics**: `[x]` nghĩa là tiêu chí chất lượng yêu cầu đã được duyệt đạt, không có nghĩa công việc triển khai hoàn tất. Các câu hỏi dưới đây chưa được đánh giá đạt/không đạt.

## Requirement Completeness

- [x] CHK001 Chín trường dữ liệu chuẩn, quy tắc bắt buộc và quan hệ với trường âm thanh bổ sung đã được mô tả đầy đủ mà không đổi tên cột nguồn chưa? [Completeness, Spec §FR-001, Spec §FR-013]
- [x] CHK002 Yêu cầu tách đa từ loại đã xác định nghĩa và ví dụ riêng cho mỗi bản ghi, cùng cách phân biệt các nghĩa trùng bộ định danh chưa? [Completeness, Spec §FR-003, Spec §Key Entities, Spec §Edge Cases 1]
- [x] CHK003 Yêu cầu nạp dữ liệu đã bao quát thiếu tệp, thiếu trường, giá trị không hợp lệ và báo cáo bản ghi bị từ chối chưa? [Completeness, Gap, Spec §FR-008]
- [x] CHK004 Phạm vi giao diện lộ trình, thẻ từ vựng và trạng thái khóa bài đã được xác định rõ là thuộc feature này hay feature tiếp theo chưa? [Completeness, Spec §User Story 2, Spec §User Story 3, Spec §Assumptions]

## Requirement Clarity

- [x] CHK005 Quy định tối thiểu 15 từ đã nêu rõ áp dụng cho mọi bài học, kể cả nhóm độc lập và phần dư, đồng thời giới hạn 19–20 từ chỉ dành cho bài cuối nhóm chưa? [Clarity, Spec §FR-006, Spec §SC-002]
- [x] CHK006 Khái niệm “tìm kiếm theo từ khóa” đã xác định khớp toàn từ hay khớp một phần, thứ tự và giới hạn kết quả chưa? [Clarity, Gap, Spec §FR-012, Spec §User Story 4]
- [x] CHK007 Quy tắc định danh tám chủ đề đã đủ rõ để ví dụ “Travel & Transportation” với topicId=2 không phụ thuộc suy đoán từ thứ tự danh sách chưa? [Clarity, Spec §FR-005, Spec §User Story 2 — AS2]
- [x] CHK008 Quy định nghĩa tiếng Việt “dưới 100 ký tự” và cụm “dấu phẩy `;`” đã xác định rõ cách đếm và dấu phân tách chưa? [Clarity, Ambiguity, Spec §Edge Cases 11]

## Requirement Consistency

- [x] CHK009 Quy định không có bài dưới 15 từ đã được đồng bộ với kỳ vọng nhóm 14 từ trong tasks T014 và phương án chấp nhận bài ngắn trong research R3 chưa? [Consistency, Conflict, Spec §FR-006, Spec §SC-002]
- [x] CHK010 Giới hạn tối đa 20 từ trong spec có nhất quán với chú thích cho phép gộp đến 22 trong research R3 chưa? [Consistency, Conflict, Spec §FR-006]
- [x] CHK011 Mô tả số từ trong lộ trình và chi tiết bài học đã nhất quán với ngoại lệ 19–20 từ ở bài cuối nhóm chưa? [Consistency, Spec §User Story 2, Spec §User Story 3, Spec §SC-002]
- [x] CHK012 Tên tiêu chí lọc cấp độ đã thống nhất giữa FR-010 dùng `cefr_level` và các kịch bản dùng `level` chưa? [Consistency, Spec §FR-010, Spec §User Story 2]
- [x] CHK013 Yêu cầu định dạng phản hồi thành công và thất bại đã nhất quán với trường hợp không có kết quả và bài học không tồn tại chưa? [Consistency, Spec §FR-014, Spec §User Story 3 — AS3, Spec §User Story 4 — AS3]

## Acceptance Criteria Quality

- [x] CHK014 Mốc ít nhất 3.500 bản ghi đã có căn cứ đối chiếu nguồn chuẩn và cách tính sau tách đa từ loại, loại trùng chưa? [Measurability, Spec §SC-001, Spec §FR-003]
- [x] CHK015 Tiêu chí nạp dưới 15 giây đã xác định môi trường, trạng thái dữ liệu ban đầu và điểm bắt đầu/kết thúc phép đo chưa? [Measurability, Spec §SC-004]
- [x] CHK016 Tiêu chí 95% phản hồi dưới 50ms đã xác định tập truy vấn, tải đồng thời, cỡ mẫu và điều kiện đo chưa? [Measurability, Spec §SC-005]
- [x] CHK017 Mỗi kịch bản nghiệm thu đã có định danh truy vết và yêu cầu kiểm chứng tự động tương ứng, bao gồm thông tin bài học trong US2-AS3, chưa? [Traceability, Spec §User Scenarios & Testing, Gap]

## Scenario Coverage

- [x] CHK018 Yêu cầu cho luồng chính đã bao quát từ dữ liệu nguồn đến chủ đề, bài học, chi tiết từ và tra cứu chưa? [Coverage, Spec §User Stories 1–4]
- [x] CHK019 Các trường hợp không chọn bộ lọc, kết hợp bộ lọc, dữ liệu rỗng và bộ lọc không hợp lệ đã được đặc tả chưa? [Coverage, Gap, Spec §FR-009, Spec §FR-010]
- [x] CHK020 Yêu cầu cho dữ liệu nguồn thay đổi giữa hai lần nạp đã xác định phạm vi cập nhật và tính ổn định của định danh, thứ tự, liên kết bài học chưa? [Coverage, Gap, Spec §FR-008, Spec §SC-006]
- [x] CHK021 Yêu cầu phục hồi khi nạp hoặc thay đổi cấu trúc dữ liệu bị gián đoạn đã xác định trạng thái được giữ lại, phạm vi hoàn tác và điều kiện thử lại chưa? [Coverage, Recovery, Gap, Spec §FR-008]

## Edge Case Coverage

- [x] CHK022 Yêu cầu đã xác định cách xử lý nhóm không thể phân bổ hợp lệ, như 1–14 hoặc 21–29 từ, mà vẫn giữ quy định cùng cấp độ/chủ đề và cấm bài dưới 15 từ chưa? [Coverage, Gap, Spec §Edge Cases 4, Spec §FR-006, Spec §FR-007]
- [x] CHK023 Yêu cầu làm sạch từ đã phân biệt ký tự cần loại bỏ với dấu cách hợp lệ trong cụm từ, đồng thời bảo toàn IPA và tiếng Việt chưa? [Coverage, Spec §FR-002, Spec §FR-004, Spec §Edge Cases 3–7]
- [x] CHK024 Yêu cầu khi thiếu hoặc không dùng được âm thanh đã mô tả rõ thông tin phản hồi cho người học và sự khác biệt giữa giá trị rỗng với không có giá trị chưa? [Coverage, Gap, Spec §Edge Cases 8, Spec §User Story 3]
- [x] CHK025 Yêu cầu tra cứu đã bao quát từ khóa rỗng sau chuẩn hóa, quá dài, ký tự đặc biệt và định danh từ không tồn tại chưa? [Coverage, Gap, Spec §FR-012, Spec §Edge Cases 10]

## Non-Functional Requirements

- [x] CHK026 Yêu cầu bảo vệ dữ liệu và quyền truy cập đã phân biệt tra cứu công khai với quyền nạp dữ liệu, đồng thời nêu giới hạn đầu vào và bảo vệ thông tin bí mật chưa? [Completeness, Gap, Spec §Assumptions, Spec §Edge Cases 10]
- [x] CHK027 Yêu cầu lưu âm thanh đã nhất quán với hiến pháp về URL tĩnh dài tối đa 500 ký tự và cấm dữ liệu âm thanh nhị phân trong cơ sở dữ liệu chưa? [Consistency, Spec §FR-013, Spec §Clarifications]
- [x] CHK028 Nếu giao diện thuộc phạm vi feature, yêu cầu bàn phím, khả năng đọc nội dung thẻ và lựa chọn giảm chuyển động đã được định nghĩa; nếu không, ranh giới loại trừ đã được ghi rõ chưa? [Coverage, Gap, Spec §User Story 3]

## Dependencies & Assumptions

- [x] CHK029 Giả định dữ liệu nguồn có đủ thông tin bắt buộc và đủ từ theo từng nhóm cấp độ/chủ đề đã có căn cứ hoặc tiêu chí xử lý khi không thỏa chưa? [Assumption, Spec §SC-001, Spec §FR-006, Spec §FR-007]
- [x] CHK030 Ranh giới phụ thuộc với tiến độ học, ôn tập và chatbot đã rõ để không đưa hành vi của feature sau vào điều kiện nghiệm thu hiện tại chưa? [Clarity, Spec §Assumptions, Spec §User Story 4]

## Ambiguities & Conflicts

- [x] CHK031 Tuyên bố phân bổ toàn bộ từ đã được giải quyết nhất quán với cấm bài ngắn và cấm trộn cấp độ/chủ đề khi nhóm không thể chia hợp lệ chưa? [Conflict, Spec §FR-006, Spec §FR-007, Spec §Edge Cases 4]
- [x] CHK032 Các tuyên bố tuân thủ trong plan đã có căn cứ tài liệu tương ứng, đặc biệt yêu cầu kiểm chứng trước triển khai so với thứ tự công việc trong tasks, chưa? [Consistency, Gap, Spec §User Scenarios & Testing]

## Notes

- Chỉ đánh dấu `[x]` sau khi người duyệt xác định tiêu chí chất lượng yêu cầu đã được đáp ứng.
- Giữ `[ ]` với mục còn cần làm rõ, sửa tài liệu hoặc chưa được đánh giá.
- `/speckit-implement` đọc trạng thái checklist làm cổng kiểm tra và không được sửa các dấu đánh giá.
- `checklists/requirements.md` có vòng đời riêng do `/speckit-specify` và `/speckit-clarify` quản lý.
- Ghi nhận xét và dẫn chứng ngay dưới mục tương ứng; mã CHK được đánh liên tục.
- Quyết định cấm bài dưới 15 từ đã được ghi vào spec trong lượt này. Cách xử lý nhóm không thể phân bổ vẫn cần được làm rõ; checklist không tự chọn cách xử lý hay tự sửa thiết kế.

## Bổ sung ngày 2026-11-17 — Requirement Consistency

**Scope / Depth**: Tiếp tục phạm vi tổng thể, mức tiêu chuẩn; người duyệt tài liệu sử dụng trước triển khai. Giữ yêu cầu tuyệt đối không có bài dưới 15 từ.
**Context**: Spec hiện tại đã bổ sung chính sách giữ từ trong kho, bỏ qua tạo bài và cảnh báo với nhóm không đủ điều kiện. Research R3 và tasks T014 đã được chỉnh so với lượt tạo checklist trước. Các nhận xét lịch sử ở CHK009, CHK010 và Notes được giữ nguyên theo quy tắc chỉ bổ sung; chúng không phải kết luận về phiên bản tài liệu hiện tại. Không thay đổi trạng thái đánh giá của mục cũ.

- [x] CHK033 Phạm vi áp dụng yêu cầu “phân bổ toàn bộ từ” đã được giới hạn hoặc nêu ngoại lệ rõ ràng để nhất quán với chính sách giữ từ nhưng không tạo bài cho nhóm không đủ điều kiện chưa? [Consistency, Conflict, Spec §FR-006, Spec §Clarifications, Spec §Edge Cases 4]
- [x] CHK034 Khái niệm phân bổ “cân bằng” đã có tiêu chí đo lường về chênh lệch số từ giữa các bài và thứ tự ưu tiên giữa cân bằng, khoảng 15–18 và ngoại lệ 19–20 chỉ ở bài cuối chưa? [Clarity, Ambiguity, Spec §Clarifications, Spec §FR-006]

## Bổ sung — Scenario & Edge Case Coverage

- [x] CHK035 Yêu cầu cảnh báo nhóm bị bỏ qua đã xác định thông tin tối thiểu để người quản trị nhận biết nhóm, số từ, nguyên nhân và kết quả chung của lần nạp chưa? [Completeness, Gap, Spec §Clarifications, Spec §Edge Cases 4]
- [x] CHK036 Yêu cầu sau khi bổ sung đủ từ cho nhóm từng bị bỏ qua đã xác định điều kiện đưa nhóm trở lại lộ trình và quan hệ với giả định phân bổ một lần lúc nạp chưa? [Coverage, Recovery, Gap, Spec §Edge Cases 4, Spec §Assumptions]
- [x] CHK037 Yêu cầu tra cứu từ chưa được gán vào bài học và cách tính số bài của chủ đề chứa nhóm bị bỏ qua đã được mô tả rõ chưa? [Coverage, Gap, Spec §FR-009, Spec §FR-012, Spec §Edge Cases 4]
- [x] CHK038 Tập trường hợp biên được đặc tả đã bao quát nhóm rỗng và các nhóm từ 30 trở lên vẫn không thể thỏa giới hạn chỉ bài cuối được vượt 18 từ, chẳng hạn 39–44 từ, chưa? [Coverage, Gap, Spec §FR-006, Spec §Edge Cases 4]

## Bổ sung — Dependencies & Acceptance Criteria Quality

- [x] CHK039 Tuyên bố 32 nhóm có 90–151 từ đã dẫn tới bằng chứng gắn với phiên bản dữ liệu nguồn và quy tắc đếm sau chuẩn hóa, để xác định khi nào giả định này cần được xem xét lại, chưa? [Traceability, Assumption, Spec §Clarifications, Spec §SC-001]
- [x] CHK040 Chính sách bỏ qua nhóm không hợp lệ đã có tiêu chí nghiệm thu phân biệt rõ nạp đủ từ vào kho với xuất bản đủ bài học, đồng thời thể hiện yêu cầu không có bài dưới 15 từ chưa? [Measurability, Gap, Spec §User Story 1, Spec §SC-001, Spec §SC-002, Spec §Edge Cases 4]
