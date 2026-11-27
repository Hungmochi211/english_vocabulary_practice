"""
Áp dụng và kiểm định bộ nhãn ngữ nghĩa 16 chủ đề chuẩn hóa (topic_semantic_map.json)
lên tập dữ liệu nguồn oxford_3000_vocabulary.xlsx, đồng thời xác minh 100% các cụm
(cefr_level, topic) có từ đều chia được thành bài học 15-18 từ (bài cuối <= 20 từ).
"""

import json
import math
import os
from collections import Counter, defaultdict
import openpyxl

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
EXCEL_PATH = os.path.join(BASE_DIR, 'oxford_3000_vocabulary.xlsx')
MAP_PATH = os.path.join(BASE_DIR, 'topic_semantic_map.json')

STANDARD_TOPICS = {
    'Academic & Education',
    'Business & Workplace',
    'Health & Environment',
    'Media & Culture',
    'Personal & Social Psychology',
    'Science & Technology',
    'Society & Law',
    'Travel & Global Issues',
    'Daily Life & Routines',
    'Travel & Transportation',
    'People & Relationships',
    'Education & Work',
    'Food & Health',
    'Home & Environment',
    'Entertainment & Media',
    'Communication & Feelings',
}


def calculate_lesson_partition(n: int):
    if n == 0:
        return [], True
    if n < 15:
        return [], False
    min_k = max(1, math.ceil((n - 2) / 18))
    max_k = n // 15
    for k in range(min_k, max_k + 1):
        if k == 1:
            if 15 <= n <= 20:
                return [n], True
            continue
        base = n // k
        rem = n % k
        if base >= 15 and base + (1 if rem > 0 else 0) <= 18:
            return [base] * (k - rem) + [base + 1] * rem, True
        for last in range(15, 21):
            rem_n = n - last
            if (k - 1) * 15 <= rem_n <= (k - 1) * 18:
                b = rem_n // (k - 1)
                r = rem_n % (k - 1)
                return [b] * (k - 1 - r) + [b + 1] * r + [last], True
    return [], False


def main():
    with open(MAP_PATH, encoding='utf-8') as f:
        semantic_map = json.load(f)

    wb = openpyxl.load_workbook(EXCEL_PATH)
    counts = defaultdict(Counter)
    total_rows = 0

    for sheet in ['A1', 'A2', 'B1', 'B2']:
        ws = wb[sheet]
        for r_idx in range(2, ws.max_row + 1):
            vals = [ws.cell(r_idx, col).value for col in range(1, 10)]
            if all(x is None for x in vals):
                continue
            rid, word, _, pos = vals[0], str(vals[1]).strip(), vals[2], str(vals[3]).strip()
            if pos == 'article':
                pos = 'article.'
                ws.cell(r_idx, 4).value = 'article.'
            lookup_key = f'{sheet}|{rid}|{word}|{pos}'
            alt_lookup = f'{sheet}|{rid}|{word}|article'
            topic = semantic_map.get(lookup_key) or semantic_map.get(alt_lookup)
            if not topic or topic not in STANDARD_TOPICS:
                raise ValueError(f'Không tìm thấy chủ đề hợp lệ cho {lookup_key}')
            ws.cell(r_idx, 9).value = topic
            counts[topic][sheet] += 1
            total_rows += 1

    for topic, lvl_counts in counts.items():
        for lvl in ['A1', 'A2', 'B1', 'B2']:
            _, ok = calculate_lesson_partition(lvl_counts[lvl])
            if not ok:
                raise ValueError(f'Cụm ({lvl}, {topic}) có {lvl_counts[lvl]} từ không thỏa phân hoạch 15-20!')

    wb.save(EXCEL_PATH)
    print(f'Đã đồng bộ & kiểm chứng thành công {total_rows} bản ghi trên 16 chủ đề chuẩn.')


if __name__ == '__main__':
    main()
