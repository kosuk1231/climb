import { SolapiMessageService } from "solapi";

export function onlyDigits(v) {
  return (v || "").toString().replace(/[^0-9]/g, "");
}

/**
 * 신규 참가자에게 알림톡을 일괄 발송합니다.
 * @param {Array<{name:string, phone:string}>} recipients
 * @return {Promise<{requested:number, result:object|null, error:string|null}>}
 */
export async function sendAlimtalk(recipients) {
  const list = (recipients || []).filter((r) => r.name && onlyDigits(r.phone));
  if (list.length === 0) {
    return { requested: 0, result: null, error: null };
  }

  const service = new SolapiMessageService(
    process.env.SOLAPI_API_KEY,
    process.env.SOLAPI_API_SECRET
  );

  const messages = list.map((r) => ({
    to: onlyDigits(r.phone),
    from: onlyDigits(process.env.SOLAPI_SENDER),
    kakaoOptions: {
      pfId: process.env.SOLAPI_PF_ID,
      templateId: process.env.SOLAPI_TEMPLATE_ID,
      // key, value 모두 문자열이어야 합니다.
      variables: { "#{성함}": String(r.name) },
    },
  }));

  try {
    const result = await service.send(messages);
    return { requested: list.length, result, error: null };
  } catch (e) {
    // 시트 저장은 이미 끝났으므로, 발송 실패는 에러로 되돌리지 않고 상태만 반환합니다.
    console.error("Alimtalk send error:", e);
    return { requested: list.length, result: null, error: e.message || "발송 실패" };
  }
}
