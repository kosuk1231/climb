import { NextResponse } from "next/server";
import {
  getOrgRows,
  appendOrgRows,
  getSummaryCount,
  appendSummaryRows,
  tabTitle,
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
    const recipients = [];
    const summaryRows = [];
    let sumSeq = await getSummaryCount(); // 총괄 기존 인원 수
    let added = 0;

    if (type === "group") {
      // 단체: 단체명으로 탭 하나에 누적
      const orgTab = tabTitle(org);
      const existing = await getOrgRows(orgTab);
      const seen = new Set();
      existing.forEach((r) => {
        const k = keyOf(r[1], r[3]); // 성함, 연락처
        if (k) seen.add(k);
      });

      const orgRows = [];
      let orgSeq = existing.length;
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
        summaryRows.push([sumSeq, org, name, rank, phone, note, ts]);
        recipients.push({ name, phone });
      }
      await appendOrgRows(orgTab, orgRows);
      added = orgRows.length;
    } else {
      // 개인: 신청자 성함으로 각각 탭 생성/누적
      for (const p of named) {
        const name = (p.name || "").trim();
        const tab = tabTitle(name);
        const existing = await getOrgRows(tab); // 해당 이름 탭 읽기(없으면 생성)
        const seen = new Set();
        existing.forEach((r) => {
          const k = keyOf(r[1], r[3]);
          if (k) seen.add(k);
        });
        const k = keyOf(name, p.phone);
        if (!k || seen.has(k)) continue; // 이미 등록된 사람

        const rank = (p.rank || "").trim();
        const phone = (p.phone || "").trim();
        const note = (p.note || "").trim();
        const orgSeq = existing.length + 1;
        await appendOrgRows(tab, [[orgSeq, name, rank, phone, note, ts]]);

        sumSeq += 1;
        summaryRows.push([sumSeq, "개인", name, rank, phone, note, ts]);
        recipients.push({ name, phone });
        added += 1;
      }
    }

    // 통합(총괄) 시트에 누적
    await appendSummaryRows(summaryRows);

    // 신규 참가자에게만 알림톡 발송
    const alimtalk = await sendAlimtalk(recipients);

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
