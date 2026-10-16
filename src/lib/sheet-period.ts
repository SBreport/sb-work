import { cleanStr, parseCSV } from './csv-import';

export function buildCsvExportUrl(rawUrl: string): string {
  let url: URL;
  try { url = new URL(rawUrl); }
  catch { throw new Error('올바른 구글 시트 URL을 입력해주세요.'); }
  const id = url.pathname.match(/^\/spreadsheets\/d\/([\w-]+)(?:\/|$)/)?.[1];
  if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com' || !id) {
    throw new Error('올바른 구글 시트 URL을 입력해주세요.');
  }
  const queryGid = url.searchParams.get('gid');
  const hashGid = new URLSearchParams(url.hash.slice(1)).get('gid');
  if (queryGid && hashGid && queryGid !== hashGid) {
    throw new Error('링크의 탭 번호(gid)가 서로 다릅니다. 대상 탭의 주소를 다시 복사해주세요.');
  }
  const gid = queryGid ?? hashGid;
  if (!gid || !/^\d+$/.test(gid)) {
    throw new Error('대상 탭을 선택한 뒤 탭 번호(gid)가 포함된 링크를 복사해주세요.');
  }
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

export function detectSheetPeriod(csvText: string, disposition: string | null) {
  // Google's gid-specific CSV export filename ends in " - <actual tab name>.csv".
  const encoded = disposition?.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1];
  let filename: string;
  try {
    filename = encoded
      ? decodeURIComponent(encoded.trim())
      : disposition?.match(/filename\s*=\s*"([^"]+)"/i)?.[1] || '';
  } catch {
    throw new Error('시트 탭 이름을 확인하지 못했습니다. 갱신을 중단합니다.');
  }
  const match = filename.match(/-\s*((\d{4})[.-](\d{1,2}))\.csv$/i);
  if (!match || Number(match[2]) < 1 || Number(match[3]) < 1 || Number(match[3]) > 12) {
    throw new Error('시트 탭 이름을 확인하지 못했습니다. 탭 이름을 2027.10처럼 연도.월 형식으로 지정해주세요.');
  }
  const [, sheetName, year, monthNumber] = match;
  const month = `${year}-${monthNumber.padStart(2, '0')}`;
  let dataRows = 0;
  for (const [index, row] of parseCSV(csvText).entries()) {
    if (index === 0 || !cleanStr(row[0]) || !cleanStr(row[3])) continue;
    const cell = cleanStr(row[0]).match(/^(?:(\d{4})-)?(\d{1,2})(?:월)?$/);
    if (!cell || Number(cell[2]) !== Number(monthNumber) || (cell[1] && cell[1] !== year)) {
      throw new Error(`${index + 1}행: A열 갱신월이 시트 탭 '${sheetName}'과 일치하지 않습니다.`);
    }
    dataRows++;
  }
  if (!dataRows) throw new Error('시트에 가져올 배정 데이터가 없습니다.');
  return { month, monthLabel: `${year}년 ${Number(monthNumber)}월`, sheetName };
}
