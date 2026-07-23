import { createInterface } from "node:readline/promises";
import { writeFile } from "node:fs/promises";
import { fetchComplexPriceRecords } from "./kbland.mjs";
import { formatManwon, pyeong } from "./format.mjs";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => rl.question(q);

function dedupeByAreaSn(records) {
  const seen = new Map();
  for (const r of records) {
    if (r["면적일련번호"] == null) continue;
    const existing = seen.get(r["면적일련번호"]);
    const isFuller = !existing || (existing["매매일반거래가"] === undefined && r["매매일반거래가"] !== undefined);
    if (isFuller) seen.set(r["면적일련번호"], r);
  }
  return [...seen.values()];
}

async function main() {
  console.log("https://kbland.kr 에서 대상 아파트를 검색한 뒤,");
  console.log("단지 상세 페이지 URL (kbland.kr/se/c/12345) 에서 숫자(complexId)를 복사해 입력해줘.\n");

  const complexId = (await ask("complexId: ")).trim();
  const records = await fetchComplexPriceRecords(complexId);
  const candidates = dedupeByAreaSn(records);

  console.log(`\n평형 목록 (${candidates.length}개):`);
  candidates.forEach((r, i) => {
    const type = r["주택형타입내용"] || "-";
    const area = pyeong(r);
    const areaM2 = r["공급면적"] != null ? `${r["공급면적"]}㎡` : "-";
    const general = formatManwon(r["매매일반거래가"]);
    console.log(`  [${i}] ${type}타입 / ${area}평(${areaM2}) / 매매일반가 ${general} (면적일련번호=${r["면적일련번호"]})`);
  });

  const idxRaw = (await ask("\n조회할 평형 번호를 선택해줘: ")).trim();
  const selected = candidates[Number(idxRaw)];
  if (!selected) {
    console.log("잘못된 선택이야.");
    rl.close();
    return;
  }

  const label = (await ask("\nDiscord 메시지에 표시할 주택 이름을 입력해줘 (예: 우리집): ")).trim();
  const expireDate = (await ask("cron 만료 날짜 (YYYY-MM-DD): ")).trim();

  const envBlock = [
    `HOUSE_COMPLEX_ID=${complexId}`,
    `HOUSE_AREA_SN=${selected["면적일련번호"]}`,
    `HOUSE_LABEL=${label}`,
    `CRON_EXPIRE_DATE=${expireDate}`,
    `DISCORD_WEBHOOK_URL=`,
  ].join("\n");

  await writeFile(new URL("../.env", import.meta.url), envBlock + "\n");
  console.log("\n.env 파일을 생성했어 (git에는 커밋되지 않음).");
  console.log("DISCORD_WEBHOOK_URL 값만 채우고 `node --env-file=.env scripts/notify.mjs`로 테스트해봐.");
  console.log("\nGitHub Actions에는 아래 값을 Settings > Secrets and variables > Actions 에 등록해줘:\n");
  console.log(envBlock.replace("DISCORD_WEBHOOK_URL=", "DISCORD_WEBHOOK_URL=<discord webhook url>"));

  rl.close();
}

main().catch((err) => {
  console.error(err);
  rl.close();
  process.exit(1);
});
