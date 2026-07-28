import { NextResponse } from "next/server";
import {
  getOrgRows,
  appendOrgRows,
  getSummaryCount,
  appendSummaryRows,
  tabTitle,
  ORG_HEADER,
  ORG_HEADER_PERSONAL,
} from "@/lib/sheets";
import { sendAlimtalk, onlyDigits } from "@/lib/solapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 중복 판별 key: 연락처(숫자) 우선, 없으면 성함
function keyOf(name, phone) {
  const p = onlyDigits(phone);
  if (p) return "p:" + p;
  const n = (name || "").trim();
  return n ? "n:" + n : "";
}

function nowKST() {
  return new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

export async function POST(req) {
  try {
    const body = await req.json();
    const type = body.type === "group" ? "group" : "single";
    const org = (body.organizationName || "").trim();
    const participants = Array.isArray(body.participants) ? body.participants : [];

    if (type === "group" && !org) {
      return NextResponse.json(
        { ok: false, error: "기관 또는 단체명을 입력해주세요." },
        { status: 400 }
      );
    }
    const named = participants.filter((p) => (p.name || "").trim());
    if (named.length === 0) {
      return NextResponse.json({ ok: false, error: "참가자 정보가 없습니다." }, { status: 400 });
    }

    const ts = nowKST();
    // 단체 → 단체명 탭 / 개인 → "개인" 탭 하나에 누적
    const targetTab = type === "group" ? tabTitle(org) : "개인";
    const summaryLabel = type === "group" ? org : "개인";
    const targetHeader = type === "group" ? ORG_HEADER : ORG_HEADER_PERSONAL;

    // [읽기] 총괄 인원수 + 대상 탭 기존 명단을 병렬로 조회
    const [summaryStart, existing] = await Promise.all([
      getSummaryCount(),
      getOrgRows(targetTab, targetHeader),
    ]);

    // 기존 등록자 수집(중복 판별)
    const seen = new Set();
    existing.forEach((r) => {
      const k = keyOf(r[1], r[3]); // 성함, 연락처
      if (k) seen.add(k);
    });

    // 신규만 추출
    const orgRows = [];
    const summaryRows = [];
    const recipients = [];
    let orgSeq = existing.length;
    let sumSeq = summaryStart;
    for (const p of named) {
      const name = (p.name || "").trim();
      const k = keyOf(name, p.phone);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      orgSeq += 1;
      sumSeq += 1;
      const rank = (p.rank || "").trim();
      const phone = (p.phone || "").trim();
      const note = (p.note || "").trim();
      orgRows.push([orgSeq, name, rank, phone, note, ts]);
      summaryRows.push([sumSeq, summaryLabel, name, rank, phone, note, ts]);
      recipients.push({ name, phone });
    }

    // [쓰기+발송] 대상 탭 저장 · 총괄 저장 · 알림톡 발송을 병렬로 처리
    const [, , alimtalk] = await Promise.all([
      appendOrgRows(targetTab, orgRows),
      appendSummaryRows(summaryRows),
      sendAlimtalk(recipients),
    ]);

    const added = orgRows.length;
    const skipped = Math.max(named.length - added, 0);
    return NextResponse.json({
      ok: true,
      added,
      skipped,
      alimtalkRequested: alimtalk.requested,
      alimtalkError: alimtalk.error,
    });
  } catch (e) {
    console.error("submit error:", e);
    return NextResponse.json(
      { ok: false, error: "처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 }
    );
  }
}
