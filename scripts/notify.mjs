import { fetchComplexPriceRecords } from "./kbland.mjs";
import { formatManwon, formatDate, pyeong } from "./format.mjs";

const {
  HOUSE_COMPLEX_ID,
  HOUSE_AREA_SN,
  HOUSE_LABEL = "우리집",
  CRON_EXPIRE_DATE,
  DISCORD_WEBHOOK_URL,
} = process.env;

function assertEnv() {
  const required = ["HOUSE_COMPLEX_ID", "HOUSE_AREA_SN", "CRON_EXPIRE_DATE", "DISCORD_WEBHOOK_URL"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`필수 환경변수 누락: ${missing.join(", ")}`);
  }
}

function isExpired() {
  const today = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }));
  const expire = new Date(CRON_EXPIRE_DATE);
  return today > expire;
}

function buildDiscordMessage(record) {
  const type = record["주택형타입내용"] || "-";
  const area = pyeong(record);
  const baseDate = formatDate(record["시세기준년월일"]);

  if (record["시세제공여부"] !== "1") {
    return [
      `🏠 **${HOUSE_LABEL}** KB시세 (${type}타입 / ${area}평)`,
      `시세 미제공: ${record["시세미제공사유상세"] || record["시세미제공사유"] || "사유 미상"}`,
    ].join("\n");
  }

  return [
    `🏠 **${HOUSE_LABEL}** KB시세 (${type}타입 / ${area}평, 기준일 ${baseDate})`,
    "",
    "**매매**",
    `- 일반가: ${formatManwon(record["매매일반거래가"])}`,
    `- 상위가: ${formatManwon(record["매매상한가"])}`,
    `- 하위가: ${formatManwon(record["매매하한가"])}`,
    `- 평균가: ${formatManwon(record["매매평균가"])}`,
    "",
    "**전세**",
    `- 일반가: ${formatManwon(record["전세일반거래가"])}`,
    `- 상위가: ${formatManwon(record["전세상한가"])}`,
    `- 하위가: ${formatManwon(record["전세하한가"])}`,
    `- 평균가: ${formatManwon(record["전세평균가"])}`,
  ].join("\n");
}

async function sendToDiscord(content) {
  const res = await fetch(DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    throw new Error(`Discord 전송 실패 (${res.status}): ${await res.text()}`);
  }
}

async function main() {
  assertEnv();

  if (isExpired()) {
    console.log(`CRON_EXPIRE_DATE(${CRON_EXPIRE_DATE})가 지나서 실행을 건너뜀.`);
    return;
  }

  const records = await fetchComplexPriceRecords(HOUSE_COMPLEX_ID);
  const record = records.find(
    (r) => String(r["면적일련번호"]) === String(HOUSE_AREA_SN) && r["매매일반거래가"] !== undefined
  );
  if (!record) {
    throw new Error(`면적일련번호(${HOUSE_AREA_SN})에 해당하는 완전한 레코드를 찾지 못했어.`);
  }

  const message = buildDiscordMessage(record);
  await sendToDiscord(message);
  console.log("Discord 전송 완료");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
