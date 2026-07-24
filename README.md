# kb-sise-notifier

매주 금요일 정오(KST)에 지정한 아파트의 KB시세를 Discord로 전달하는 스크립트.
공식 API가 없어 [kbland.kr](https://kbland.kr) 단지 상세 페이지가 서버사이드 렌더링할 때
HTML 안에 그대로 박아 넣는 평형별 시세 JSON을 파싱해서 사용한다.
개인 소유 주택 1건을 주 1회 조회하는 저빈도 용도로 설계했다.

## 사용법 요약

```bash
node scripts/setup.mjs                       # 1) 단지/평형 선택 → .env 생성
# .env에 DISCORD_WEBHOOK_URL 채우기
node --env-file=.env scripts/notify.mjs       # 2) 로컬 테스트 전송
# 정상 확인되면 GitHub repo에 push + secrets 등록 → 매주 금요일 자동 실행
```

## 1. complexId 찾기 (최초 1회, 수동)

1. [kbland.kr](https://kbland.kr)에서 대상 아파트를 검색한다.
2. 단지 상세 페이지 URL(`kbland.kr/se/c/15891`)에서 숫자를 복사한다. 이게 `complexId`.

## 2. 평형/시세 설정

```bash
node scripts/setup.mjs
```

- complexId를 입력하면 해당 단지의 평형(면적) 목록과 현재 매매일반가를 보여준다.
- 조회할 평형을 선택한다.
- Discord에 표시할 이름과 cron 만료일을 입력받아 `.env` 파일을 생성한다 (git에 커밋되지 않음).

## 3. .env 직접 설정하기

`setup.mjs`를 안 쓰고 직접 만들어도 된다. `.env.example`을 복사해서 채우면 된다:

```bash
cp .env.example .env
```

| 변수 | 설명 | 예시 |
| --- | --- | --- |
| `HOUSE_COMPLEX_ID` | kbland.kr 단지 상세 URL(`kbland.kr/se/c/{id}`)의 숫자 | `42397` |
| `HOUSE_AREA_SN` | 조회할 평형의 면적일련번호. `setup.mjs` 실행 시 후보 목록과 함께 출력됨 | `168210` |
| `HOUSE_LABEL` | Discord 메시지 제목에 표시할 이름 (자유 텍스트) | `은계파크자이` |
| `CRON_EXPIRE_DATE` | 이 날짜(`YYYY-MM-DD`)가 지나면 알림을 보내지 않고 조용히 skip | `2026-10-17` |
| `DISCORD_WEBHOOK_URL` | 알림 받을 디스코드 채널의 웹후크 URL. 채널 설정 → 연동(Integrations) → 웹후크 → 새 웹후크 생성 → URL 복사 | `https://discord.com/api/webhooks/...` |

`.env`는 `.gitignore`에 포함돼 있어 절대 커밋되지 않는다. `DISCORD_WEBHOOK_URL`은 특히 외부에 노출되면 누구나 그 채널에 메시지를 보낼 수 있으니 커밋/공유하지 않는다.

## 4. 로컬 테스트

```bash
node --env-file=.env scripts/notify.mjs
```

- `CRON_EXPIRE_DATE`가 지나지 않았으면 KB시세를 조회해 매매/전세 일반가·상위가·하위가·평균가가 담긴 메시지를 Discord로 전송한다.
- 성공하면 `Discord 전송 완료`가 출력된다.
- `CRON_EXPIRE_DATE`가 지났으면 아무것도 보내지 않고 스킵 로그만 남긴다.

## 5. GitHub Actions 등록 (매주 자동 실행)

1. 새 GitHub 레포로 push한다.
2. `Settings > Secrets and variables > Actions`에 위 `.env` 표에 있는 5개 값을 각각 Secret으로 등록한다:
   `HOUSE_COMPLEX_ID`, `HOUSE_AREA_SN`, `HOUSE_LABEL`, `CRON_EXPIRE_DATE`, `DISCORD_WEBHOOK_URL`
3. `Actions` 탭에서 `KB 시세 알림` 워크플로우를 `workflow_dispatch`로 한 번 수동 실행해 정상 동작을 확인한다.
4. 이후 매주 금요일 12:00 KST(`.github/workflows/notify.yml`의 `cron: "0 3 * * 5"`)에 자동 실행된다.
   `CRON_EXPIRE_DATE`가 지나면 알림 없이 스킵만 하고 워크플로우 자체는 계속 남아있다 (필요 시 레포에서 직접 비활성화).
5. Actions 탭 실행 기록의 트리거가 `Schedule`로 뜨면 cron이 실제로 자동 실행된 것이다 (`workflow_dispatch`는 수동 실행).

### 60일 비활성 저장소 자동 비활성화 대응

GitHub은 60일간 커밋이 없는 저장소의 scheduled workflow를 자동으로 꺼버린다. 이 워크플로우는
매 실행마다 `.last-run` 파일에 타임스탬프를 기록해 커밋하는 스텝을 포함하고 있어, 정상적으로
매주 실행되는 한 저장소가 계속 "활성" 상태로 유지되어 이 문제를 피할 수 있다.

## 동작 원리 / 리스크

- `scripts/kbland.mjs`가 `kbland.kr/se/c/{complexId}` HTML을 받아 그 안에 임베드된
  `{"단지기본일련번호":...}` JSON 레코드들을 정규식/괄호매칭으로 추출한다. 공식 API가 아니라
  KB가 페이지 마크업을 바꾸면 파싱이 깨질 수 있다.
- 이 경우 `node scripts/setup.mjs`를 다시 실행해 데이터가 정상적으로 뽑히는지 확인하고,
  필요하면 `extractPriceRecords`(kbland.mjs) 또는 필드명(notify.mjs `buildDiscordMessage`)을 조정한다.
- 검증된 실제 필드: `매매일반거래가`, `매매상한가`, `매매하한가`, `매매평균가`,
  `전세일반거래가`, `전세상한가`, `전세하한가`, `전세평균가`, `시세기준년월일`, `시세제공여부` 등
  (2026-07-23 반포자이 단지 / 은계파크자이 단지로 라이브 검증).

## 향후 개선 아이디어: 주소 자동 검색

다른 사람이 이 프로젝트를 쓰려면 지금은 `.env`에 5개 값을 채워야 하는데, 그중
`HOUSE_COMPLEX_ID`/`HOUSE_AREA_SN`을 알아내려면 kbland.kr에서 직접 검색해 URL의
숫자를 복사하는 수동 1회 작업이 필요하다. "주소만 입력하면 자동으로 단지를 찾아준다"는
아이디어를 검토했던 기록:

- kbland.kr의 레거시 프론트엔드 번들(`pc.js`)을 뜯어본 결과, 실제로 **"주소로 찾기"
  기능(`SearchByAddress` Vue 컴포넌트, 라우트 `/v2/search`)이 존재**한다는 것까지는 확인했다.
- 하지만 이 컴포넌트가 호출하는 실제 API 엔드포인트는 별도로 lazy-load되는 청크
  안에 있어서 추가로 더 파야 했고, 그 시점에서 조사를 멈췄다.
- **보류한 이유**: 이미 시세 파싱 자체가 비공식 HTML 구조에 의존하는 상황에서, 주소 검색까지
  비공식 API로 자동화하면 "깨질 수 있는 지점"이 하나 더 늘어난다. `complexId` 찾기는 1회성
  30초짜리 수동 작업이라 자동화 대비 얻는 이득이 크지 않다고 판단했다.
- 대신 손쉽게 줄일 수 있는 나머지 두 값:
  - `HOUSE_LABEL`: kbland.kr 단지 페이지의 `<title>`/`og:title`에 단지명이 이미 있어서
    (예: `'반포동 반포자이' | KB부동산`) 이 값을 파싱해 자동으로 채울 수 있다. 아직 구현 안 됨.
  - `CRON_EXPIRE_DATE`: 기본값(예: 설정일로부터 1년 후)을 두고 원할 때만 override하게
    바꿀 수 있다. 아직 구현 안 됨.
  - 이렇게 하면 필수 입력을 5개 → `HOUSE_COMPLEX_ID`, `HOUSE_AREA_SN`,
    `DISCORD_WEBHOOK_URL` 3개로 줄일 수 있다.
- 주소 검색 자동화를 다시 시도한다면, `pc.js`에서 `/v2/search` 라우트가 물고 있는
  webpack 청크(`a9db` 등 lazy import id)를 추적해 실제 XHR 호출부를 찾는 것부터
  시작하면 된다.
