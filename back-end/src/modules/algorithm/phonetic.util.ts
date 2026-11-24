/**
 * American Soundex + Double Metaphone (focused English phonetic encoder)
 * Hỗ trợ nhận diện các cặp đồng âm tiêu biểu: phone/fone, night/nite, write/rite, know/no, etc.
 */
export function soundex(raw: string): string {
  const s = raw.toUpperCase().replace(/[^A-Z]/g, '');
  if (!s) return '';

  const map: Record<string, string> = {
    B: '1', F: '1', P: '1', V: '1',
    C: '2', G: '2', J: '2', K: '2', Q: '2', S: '2', X: '2', Z: '2',
    D: '3', T: '3',
    L: '4',
    M: '5', N: '5',
    R: '6',
  };

  let out = s[0];
  let prev = map[s[0]] || '';

  for (let i = 1; i < s.length && out.length < 4; i++) {
    const ch = s[i];
    const code = map[ch] || '';
    if (ch === 'H' || ch === 'W') {
      continue;
    }
    if (code && code !== prev) {
      out += code;
    }
    prev = code;
  }

  return out.padEnd(4, '0');
}

export function doubleMetaphone(raw: string): [string, string] {
  let w = raw.toUpperCase().replace(/[^A-Z]/g, '');
  if (!w) return ['', ''];

  // Chuẩn hóa các tổ hợp âm tiếng Anh phổ biến trước khi mã hóa
  w = w
    .replace(/^KN/, 'N')
    .replace(/^GN/, 'N')
    .replace(/^PN/, 'N')
    .replace(/^WR/, 'R')
    .replace(/^PS/, 'S')
    .replace(/^WH/, 'W')
    .replace(/^X/, 'S')
    .replace(/PH/g, 'F')
    .replace(/GH(?=[T\b]|$)/g, '')
    .replace(/([AEIOU])GH/g, '$1')
    .replace(/CK/g, 'K')
    .replace(/TCH/g, 'X')
    .replace(/SH|CH|SIO|SIA/g, 'X')
    .replace(/TH/g, '0')
    .replace(/C(?=[IEY])/g, 'S')
    .replace(/C/g, 'K')
    .replace(/Q/g, 'K')
    .replace(/V/g, 'F')
    .replace(/Z/g, 'S')
    .replace(/DG(?=[IEY])/g, 'J')
    .replace(/D/g, 'T')
    .replace(/G(?=[IEY])/g, 'J')
    .replace(/G/g, 'K')
    .replace(/MB$/g, 'M');

  let primary = '';
  let prev = '';
  for (let i = 0; i < w.length; i++) {
    const ch = w[i];
    if ('AEIOUYHW'.includes(ch)) {
      if (i === 0 && 'AEIOU'.includes(ch)) {
        primary += 'A';
        prev = 'A';
      }
      continue;
    }
    if (ch !== prev) {
      primary += ch;
      prev = ch;
    }
  }

  const code = primary.slice(0, 6);
  return [code, code];
}

export function isPhoneticMatch(userAnswer: string, targetWord: string): boolean {
  const uTokens = userAnswer.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const tTokens = targetWord.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (uTokens.length === 0 || uTokens.length !== tTokens.length) return false;

  for (let i = 0; i < uTokens.length; i++) {
    const u = uTokens[i];
    const t = tTokens[i];
    if (u === t) continue;

    const sdxMatch = soundex(u) !== '' && soundex(u) === soundex(t);
    const [dmU1, dmU2] = doubleMetaphone(u);
    const [dmT1, dmT2] = doubleMetaphone(t);
    const dmMatch =
      dmU1 !== '' &&
      (dmU1 === dmT1 || dmU1 === dmT2 || (dmU2 !== '' && (dmU2 === dmT1 || dmU2 === dmT2)));

    if (!sdxMatch && !dmMatch) {
      return false;
    }
  }
  return true;
}
