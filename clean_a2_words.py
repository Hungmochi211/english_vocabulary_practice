import pandas as pd
import re
import urllib.request
import urllib.parse
import json

df = pd.read_excel('oxford_3000_A2_vocabularies.xlsx')

def fetch_phonetic(word):
    clean_w = word.strip().lower()
    url = f'https://api.dictionaryapi.dev/api/v2/entries/en/{urllib.parse.quote(clean_w)}'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            phonetic = data[0].get('phonetic', '')
            if not phonetic:
                for ph in data[0].get('phonetics', []):
                    if ph.get('text'):
                        return ph['text']
            return phonetic
    except Exception:
        return ''

# Custom accurate fixes for disambiguated / numbered words
MANUAL_FIXES = {
    75: {
        'word': 'bear',
        'phonetic': '/beə(r)/',
        'vietnamese_meaning': 'con gấu',
        'example_en': 'We saw a black bear in the forest.',
        'example_vi': 'Chúng tôi đã nhìn thấy một con gấu đen trong rừng.'
    },
    113: {
        'word': 'can',
        'phonetic': '/kæn/',
        'vietnamese_meaning': 'lon, hộp kim loại',
        'example_en': 'He opened a can of soda.',
        'example_vi': 'Anh ấy đã mở một lon nước ngọt.'
    },
    145: {
        'word': 'close',
        'phonetic': '/kloʊs/',
        'vietnamese_meaning': 'gần gũi, sát bên',
        'example_en': 'Our new house is close to the school.',
        'example_vi': 'Ngôi nhà mới của chúng tôi ở gần trường học.'
    },
    434: {
        'word': 'last',
        'phonetic': '/lɑːst/',
        'vietnamese_meaning': 'cuối cùng, sau cùng',
        'example_en': 'He was the last person to leave the room.',
        'example_vi': 'Anh ấy là người cuối cùng rời khỏi phòng.'
    },
    435: {
        'word': 'last',
        'phonetic': '/lɑːst/',
        'vietnamese_meaning': 'kéo dài (thời gian)',
        'example_en': 'The English lesson lasts for 45 minutes.',
        'example_vi': 'Tiết học tiếng Anh kéo dài 45 phút.'
    },
    441: {
        'word': 'lead',
        'phonetic': '/liːd/',
        'vietnamese_meaning': 'dẫn dắt, chỉ đường',
        'example_en': 'She will lead the team to success.',
        'example_vi': 'Cô ấy sẽ dẫn dắt cả đội đến thành công.'
    },
    452: {
        'word': 'light',
        'phonetic': '/laɪt/',
        'vietnamese_meaning': 'thắp sáng, đốt đèn',
        'example_en': 'Can you light the candle for dinner?',
        'example_vi': 'Bạn có thể thắp nến cho bữa tối được không?'
    },
    453: {
        'word': 'light',
        'phonetic': '/laɪt/',
        'vietnamese_meaning': 'nhẹ (không nặng)',
        'example_en': 'This bag is surprisingly light and easy to carry.',
        'example_vi': 'Chiếc túi này nhẹ đến bất ngờ và rất dễ mang theo.'
    },
    491: {
        'word': 'mine',
        'phonetic': '/maɪn/',
        'vietnamese_meaning': 'của tôi',
        'example_en': 'This book is not yours, it is mine.',
        'example_vi': 'Cuốn sách này không phải của bạn, nó là của tôi.'
    },
    555: {
        'word': 'percent',
        'part_of_speech': 'n., adj./adv.',
        'phonetic': '/pəˈsent/',
        'vietnamese_meaning': 'phần trăm',
        'example_en': 'More than sixty percent of students passed the exam.',
        'example_vi': 'Hơn sáu mươi phần trăm học sinh đã vượt qua kỳ thi.'
    },
    614: {
        'word': 'race',
        'phonetic': '/reɪs/',
        'vietnamese_meaning': 'cuộc đua; thi đua',
        'example_en': 'He won first place in the 100-meter race.',
        'example_vi': 'Anh ấy đã giành giải nhất trong cuộc đua 100 mét.'
    },
    634: {
        'word': 'refuse',
        'phonetic': '/rɪˈfjuːz/',
        'vietnamese_meaning': 'từ chối',
        'example_en': 'They offered him the job, but he decided to refuse.',
        'example_vi': 'Họ mời anh ấy làm công việc đó nhưng anh quyết định từ chối.'
    },
    649: {
        'word': 'rest',
        'phonetic': '/rest/',
        'vietnamese_meaning': 'phần còn lại',
        'example_en': 'Take what you need, and leave the rest for others.',
        'example_vi': 'Hãy lấy những gì bạn cần, và để lại phần còn lại cho người khác.'
    },
    650: {
        'word': 'rest',
        'phonetic': '/rest/',
        'vietnamese_meaning': 'nghỉ ngơi, sự nghỉ ngơi',
        'example_en': 'You look tired, you should sit down and rest.',
        'example_vi': 'Bạn trông có vẻ mệt mỏi, bạn nên ngồi xuống và nghỉ ngơi.'
    },
    653: {
        'word': 'ring',
        'phonetic': '/rɪŋ/',
        'vietnamese_meaning': 'chiếc nhẫn',
        'example_en': 'She wears a beautiful gold ring on her finger.',
        'example_vi': 'Cô ấy đeo một chiếc nhẫn vàng rất đẹp trên ngón tay.'
    },
    654: {
        'word': 'ring',
        'phonetic': '/rɪŋ/',
        'vietnamese_meaning': 'rung chuông, reo (chuông)',
        'example_en': 'I heard the phone ring three times.',
        'example_vi': 'Tôi nghe thấy tiếng chuông điện thoại reo ba lần.'
    },
    656: {
        'word': 'rock',
        'phonetic': '/rɒk/',
        'vietnamese_meaning': 'tảng đá, hòn đá',
        'example_en': 'The boat hit a large rock near the shore.',
        'example_vi': 'Con thuyền va phải một tảng đá lớn gần bờ.'
    },
    657: {
        'word': 'rock',
        'phonetic': '/rɒk/',
        'vietnamese_meaning': 'nhạc rock',
        'example_en': 'He loves listening to classic rock music.',
        'example_vi': 'Anh ấy rất thích nghe nhạc rock cổ điển.'
    },
    684: {
        'word': 'second',
        'phonetic': '/ˈsekənd/',
        'vietnamese_meaning': 'thứ hai, ở vị trí thứ hai',
        'example_en': 'She finished second in the running competition.',
        'example_vi': 'Cô ấy về đích ở vị trí thứ hai trong cuộc thi chạy.'
    },
    859: {
        'word': 'wind',
        'phonetic': '/wɪnd/',
        'vietnamese_meaning': 'cơn gió',
        'example_en': 'A strong wind blew the leaves off the trees.',
        'example_vi': 'Một cơn gió mạnh đã thổi bay lá khỏi cành cây.'
    }
}

# Apply manual fixes
for idx, fixes in MANUAL_FIXES.items():
    for col, val in fixes.items():
        df.loc[df['id'] == idx, col] = val

# Also, check if there's any remaining row with numbers or parentheses in the word column
for idx, row in df.iterrows():
    w = str(row['word'])
    clean_w = re.sub(r'[\d\(\)]', '', w).strip()
    if clean_w != w:
        df.at[idx, 'word'] = clean_w

# Save cleaned Excel
output_file = 'oxford_3000_A2_vocabularies_v2.xlsx'
df.to_excel(output_file, index=False)
print("Updated and cleaned Excel file successfully!")
