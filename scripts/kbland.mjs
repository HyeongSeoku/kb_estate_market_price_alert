const BASE_URL = "https://kbland.kr";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Referer: `${BASE_URL}/`,
  Accept: "text/html",
};

// KB부동산 단지 상세 페이지는 서버사이드 렌더링되며, 평형별 시세 레코드가
// `{"단지기본일련번호":...}` 형태의 JSON으로 HTML 안에 그대로 박혀 있다.
// 별도 API 없이 이 HTML을 파싱해서 레코드를 뽑아낸다.
function extractPriceRecords(html) {
  const marker = '{\\"단지기본일련번호\\":';
  const records = [];
  let cursor = 0;

  while (true) {
    const start = html.indexOf(marker, cursor);
    if (start === -1) break;

    let depth = 0;
    let end = start;
    while (end < html.length) {
      if (html[end] === "{") depth++;
      else if (html[end] === "}") {
        depth--;
        if (depth === 0) {
          end++;
          break;
        }
      }
      end++;
    }

    const rawObject = html.slice(start, end).replace(/\\"/g, '"');
    try {
      records.push(JSON.parse(rawObject));
    } catch {
      // KB가 마크업을 바꿔서 파싱이 깨진 구간은 건너뛴다
    }
    cursor = end;
  }

  return records;
}

export async function fetchComplexPriceRecords(complexId) {
  const url = `${BASE_URL}/se/c/${complexId}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`KB부동산 요청 실패 (${res.status}): ${url}`);
  }
  const html = await res.text();
  const records = extractPriceRecords(html);
  if (records.length === 0) {
    throw new Error(
      "시세 레코드를 찾지 못했어. complexId가 맞는지, KB부동산 페이지 구조가 바뀌지 않았는지 확인해줘."
    );
  }
  return records;
}
