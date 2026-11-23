# Vocabulary Data Requirements Checklist: Kho Oxford 3000 và phân bổ bài học

**Purpose**: Rà soát tính đầy đủ, rõ ràng, nhất quán và khả năng đo lường của yêu cầu cho feature dữ liệu từ vựng.
**Created**: 2026-11-23
**Feature**: [spec.md](../spec.md)

**Note**: Checklist tùy chỉnh này đánh giá chất lượng yêu cầu, không xác nhận việc triển khai đã hoàn tất.
**Review Ownership**: Người duyệt sở hữu checklist; chỉ đánh dấu `[x]` sau khi xác nhận tiêu chí chất lượng yêu cầu đã đạt.
**Marker Semantics**: `[x]` nghĩa là yêu cầu đã được người duyệt đánh giá đạt, không có nghĩa tính năng đã được triển khai.

## Requirement Completeness

- [x] CHK001 - Các yêu cầu phân biệt từng bản ghi từ vựng có bao quát đủ từ loại, cấp độ và nhiều nghĩa của cùng một từ không? [Completeness, Spec §FR-001–FR-003]
- [x] CHK002 - Yêu cầu định lượng bài học nêu rõ khoảng 15–18 từ, ngoại lệ bài cuối tối đa 20 từ và cấm bài dưới 15 từ không? [Completeness, Spec §FR-006]
- [x] CHK003 - Yêu cầu nạp dữ liệu xác định cách xử lý đầy đủ cho nhóm từ không thể chia thành bài hợp lệ không? [Coverage, Spec §FR-006, Edge Case]
- [x] CHK004 - Các trường hợp dữ liệu nguồn thiếu audio, có ký tự Unicode hoặc chứa biến thể từ ghép đã được nêu đủ để tránh cách hiểu khác nhau không? [Coverage, Spec §Edge Cases]

## Requirement Clarity and Consistency

- [x] CHK005 - Quy tắc đánh số `sense_number` theo file nguồn hiện tại và khi file thay đổi có nhất quán giữa yêu cầu, mô hình dữ liệu, kế hoạch và tác vụ không? [Consistency, Spec §FR-003]
- [x] CHK006 - Cách hiểu “bài cuối nhóm” được xác định đủ rõ để phân biệt theo cùng cặp cấp độ và chủ đề không? [Clarity, Spec §FR-006–FR-007]
- [x] CHK007 - Yêu cầu làm sạch `word` phân biệt rõ số homonym, chú thích trong ngoặc và khoảng trắng không ngắt, đồng thời tránh làm hỏng từ/cụm từ hợp lệ không? [Clarity, Spec §FR-002, Edge Cases]
- [x] CHK008 - Các trường bắt buộc của dữ liệu từ vựng có nhất quán giữa danh sách chín cột nguồn, các trường bổ sung và mô tả payload không? [Consistency, Spec §FR-001, User Story 3]

## Acceptance Criteria and Scenario Coverage

- [x] CHK009 - Tiêu chí thành công đo được cả điều kiện số từ tối thiểu 15 cho mọi bài và ngoại lệ tối đa 20 chỉ ở bài cuối không? [Measurability, Spec §SC-002]
- [x] CHK010 - Kịch bản nghiệm thu bao quát nhóm có nhiều cách phân hoạch hợp lệ và nêu rõ quy tắc chọn phương án không? [Coverage, Spec §US1-AS3–AS4, US1-AS6]
- [x] CHK011 - Kịch bản lỗi cho API phân biệt rõ dữ liệu rỗng, tham số không hợp lệ và tài nguyên không tồn tại không? [Coverage, Spec §US3-AS3, US4-AS3, FR-010–FR-014]
- [x] CHK012 - Tiêu chí hiệu năng ghi rõ tải, cỡ mẫu, môi trường đo và ngưỡng cho cả seeder lẫn API không? [Measurability, Spec §SC-004–SC-005]

## Dependencies and Requirement Boundaries

- [x] CHK013 - Phạm vi Feature 001 và phụ thuộc vào file Oxford chuẩn cùng các feature học tập/giao diện được mô tả nhất quán không? [Dependency, Spec §Scope, Assumptions]
- [x] CHK014 - Yêu cầu lưu URL audio và cấm lưu Blob/Base64 vào PostgreSQL được diễn đạt nhất quán giữa yêu cầu và thực thể dữ liệu không? [Consistency, Spec §FR-013, Key Entities]

## Notes

- Đánh dấu `[x]` chỉ sau khi người duyệt xác nhận chất lượng diễn đạt của yêu cầu.
- Checklist này không thay thế `requirements.md` và không đánh giá trạng thái triển khai.
- Mọi tiêu chí còn chưa đạt nên được xử lý trong tài liệu đặc tả liên quan trước khi triển khai.
