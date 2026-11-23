# Specification Quality Checklist: Kho từ vựng Oxford 3000 và Bài học

**Purpose**: Đánh giá chất lượng đặc tả feature 001 trước khi tiếp tục thiết kế và triển khai.
**Created**: 2026-11-23
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] Nhu cầu nạp dữ liệu, chia bài học và tra cứu được mô tả theo giá trị người dùng.
- [x] Phạm vi backend và các tính năng chuyển sang feature sau được nêu rõ.
- [x] Các mục bắt buộc về kịch bản, yêu cầu và tiêu chí thành công đều có nội dung.

## Requirement Completeness

- [x] Không còn dấu `[NEEDS CLARIFICATION]` trong spec.
- [x] Quy tắc giữ nguyên chín cột nguồn và các trường bổ sung được nêu rõ.
- [x] Cách đánh `sense_number` cho nhiều nghĩa cùng từ, cấp độ và từ loại được nêu rõ.
- [x] Quy tắc bài học 15–18 từ, ngoại lệ bài cuối tối đa 20 từ và cấm bài dưới 15 từ được nêu rõ.
- [x] Các nhóm không thể chia hợp lệ có cách xử lý được nêu rõ.
- [x] Bốn user story có các kịch bản Given/When/Then và mã truy vết.
- [x] Các trường hợp biên về từ sạch, IPA, âm thanh thiếu, nạp lại và tìm kiếm được nêu rõ.
- [x] Các phụ thuộc vào dữ liệu Oxford 3000 và các feature sau được ghi nhận.

## Feature Readiness

- [x] Các tiêu chí thành công có ngưỡng đo hoặc điều kiện kiểm tra cụ thể.
- [x] Ví dụ và quy tắc định danh `sense_number` đã thống nhất với data-model, plan và tasks hiện có.
- [x] Quy tắc `sense_number` khi thứ tự hoặc nội dung file nguồn thay đổi đã được xác định để tránh gắn nhầm nghĩa vào bản ghi cũ.
- [x] Các kịch bản nghiệm thu mới hoặc thay đổi có tác vụ test tự động tương ứng theo hiến pháp.

## Notes

- `[x]` nghĩa là mục chất lượng yêu cầu được đánh giá đạt; không có nghĩa đã triển khai xong.
- Các mục chưa đạt cần đồng bộ tài liệu và quy tắc dữ liệu trước khi bắt đầu code liên quan.
- Checklist này khác `review.md`, là checklist tùy chỉnh thuộc người duyệt.
