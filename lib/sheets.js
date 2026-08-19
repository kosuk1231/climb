import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SUMMARY_SHEET = process.env.SHEET_NAME || "명단"; // 통합(총괄) 시트

// 통합 시트 컬럼 (기관명 포함)
export const SUMMARY_HEADER = ["연번", "기관명", "성함", "직급", "연락처", "비고", "신청일시", "생년월일", "개인정보동의"];
// 기관별 탭 컬럼 (탭 자체가 기관이므로 기관명 제외)
export const ORG_HEADER = ["연번", "성함", "직급", "연락처", "비고", "신청일시", "생년월일", "개인정보동의"];
// 개인 탭용 (4번째 열을 '소속'으로)
export const ORG_HEADER_PERSONAL = ["연번", "성함", "직급", "연락처", "소속", "신청일시", "생년월일", "개인정보동의"];

function getCredentials() {
  // 방법 1 (권장): 서비스 계정 JSON 전체를 Base64로 인코딩한 값
  const b64 = process.env.GOOGLE_CREDENTIALS_BASE64;
  if (b64) {
    const json = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    return { client_email: json.client_email, private_key: json.private_key };
  }
  // 방법 2 (하위호환): 이메일 + 프라이빗 키 개별 지정
  return {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  };
}

let _sheetsClient = null;
function getSheetsClient() {
  if (_sheetsClient) return _sheetsClient;
  const auth = new google.auth.GoogleAuth({
    credentials: getCredentials(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  _sheetsClient = google.sheets({ version: "v4", auth });
  return _sheetsClient;
}

// A1 표기용 탭 이름 (따옴표 처리)
function rangeName(title, a1) {
  const safe = String(title).replace(/'/g, "''");
  return `'${safe}'!${a1}`;
}

// 시트 탭 제목으로 쓸 수 없는 문자 정리 (구글 시트 제한)
export function tabTitle(org) {
  return String(org)
    .replace(/[\[\]\*\?\/\\:]/g, " ")
    .slice(0, 90)
    .trim() || "기관";
}

// 헤더 마지막 열 문자 (6 -> F, 7 -> G)
function endCol(len) {
  return String.fromCharCode(64 + len);
}

async function getSheetTitles(sheets) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
    fields: "sheets.properties.title",
  });
  return (meta.data.sheets || []).map((s) => s.properties.title);
}

// 탭이 없으면 생성하고, 헤더가 없으면 넣어 둡니다.
async function ensureTab(sheets, title, header) {
  const titles = await getSheetTitles(sheets);
  if (!titles.includes(title)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    });
  }
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: rangeName(title, `A1:${endCol(header.length)}1`),
  });
  const cur = (res.data.values && res.data.values[0]) || [];
  // 헤더가 없거나, 예전(짧은) 형태면 새 헤더로 맞춥니다.
  // 앞쪽 열 순서는 그대로이므로 기존 데이터는 영향을 받지 않습니다.
  const same =
    cur.length === header.length && header.every((h, i) => cur[i] === h);
  if (!same) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: rangeName(title, "A1"),
      valueInputOption: "RAW",
      requestBody: { values: [header] },
    });
  }
}

// ---- 기관별 탭 ----
export async function getOrgRows(orgTab, header = ORG_HEADER) {
  const sheets = getSheetsClient();
  await ensureTab(sheets, orgTab, header);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: rangeName(orgTab, "A2:H"),
  });
  return res.data.values || [];
}

export async function appendOrgRows(orgTab, rows) {
  if (!rows.length) return;
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: rangeName(orgTab, "A1"),
    valueInputOption: "RAW", // 번호를 텍스트로 저장 (앞자리 0 보존)
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });
}

// ---- 통합(총괄) 시트 ----
export async function getSummaryCount() {
  const sheets = getSheetsClient();
  await ensureTab(sheets, SUMMARY_SHEET, SUMMARY_HEADER);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: rangeName(SUMMARY_SHEET, "A2:A"),
  });
  return (res.data.values || []).length;
}

export async function appendSummaryRows(rows) {
  if (!rows.length) return;
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: rangeName(SUMMARY_SHEET, "A1"),
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });
}
