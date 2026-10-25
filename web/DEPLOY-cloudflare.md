# patternflow.work 를 Cloudflare Workers 로

patternflow.work 는 지금 Vercel 에서 돌아요. 같은 `web/` 이 Cloudflare Worker `patternflow-web` 으로도 빌드돼요. OpenNext(`@opennextjs/cloudflare` 1.20.12)가 `next build` 결과를 Worker 하나(`.open-next/worker.js`)와 정적 파일(`.open-next/assets`)로 바꾸고, wrangler 가 둘을 올려요. 설정은 `wrangler.jsonc` 와 `open-next.config.ts` 두 파일이에요.

커뮤니티(community.patternflow.work)는 그대로 파이에 있어요. 이 Worker 에는 `COMMUNITY_ENABLED` 가 없어서 `/api/community/*` 는 `src/proxy.ts` 가 404 로 닫고, `/community` 는 커뮤니티 주소로 넘기고, `/api/auth/*` 는 503 을 돌려줘요. Vercel 에서와 같아요.

## 명령

`web/` 에서 Node 22 로 돌려요. wrangler 4.151 이 22 를 요구해요.

| 명령 | 하는 일 |
| :--- | :--- |
| `npm run cf:build` | `scripts/cf-env-check.ts` → `opennextjs-cloudflare build`(그 안에서 `npm run build` 와 `scripts/cf-proxy-trace.ts`) → `scripts/cf-headers.ts` |
| `npm run cf:preview` | 빌드한 뒤 로컬 workerd 로 띄워요. http://localhost:8787 , R2 와 Images 는 로컬 흉내예요 |
| `npm run cf:deploy` | 빌드한 뒤 배포해요. R2 버킷 `patternflow-web-cache` 가 없으면 만들고, 미리 렌더한 항목 245개를 올린 다음 새 판을 켜요 |
| `npm run cf:upload` | 빌드한 뒤 새 판을 올리기만 하고 켜지 않아요. 판마다 미리보기 주소가 나와요 |

## PC 세션이 할 차례

### 1. workers.dev 에 올리기

1. 계정이 Workers 유료 판인지 봐요. Worker 가 gzip 4,969 KiB 라 무료 판의 3 MB 를 넘고, 유료 판의 10 MB 안에 들어요.
2. `cd web && npx wrangler login` 으로 창작자 계정에 들어가요.
3. Web Analytics 토큰을 받아요. 대시보드 → Analytics & Logs → Web Analytics → Add a site → 호스트 `patternflow.work` → 수동 설정(JS snippet)을 고르면 스니펫의 `token` 값이 나와요.
4. `web/.env.production.local` 을 만들어 `NEXT_PUBLIC_` 값만 넣어요. 아래 표에서 「빌드」라고 적힌 것들이고, Vercel 의 Production 값을 그대로 옮기고 3번 토큰을 더해요. `npx vercel env pull .env.production.local --environment=production` 으로 받아도 되는데, 받은 파일에 섞여 오는 `VERCEL_` 줄은 지워요. `NEXT_PUBLIC_` 이 아닌 이름이 하나라도 있으면 `cf:build` 가 멈춰요(아래 「환경 변수」).
5. `npm run cf:deploy`. 끝에 `https://patternflow-web.<계정 하위 도메인>.workers.dev` 가 찍혀요.
6. Vercel 에 `GITHUB_TOKEN` 이 있으면 `npx wrangler secret put GITHUB_TOKEN` 으로 같은 값을 넣어요. 없어도 사이트는 돌지만, 토큰 없는 GitHub API 는 주소마다 시간당 60번이고 Cloudflare 의 나가는 주소는 여럿이 나눠 써요. 이 세션의 빌드에서 GitHub 은 403 을 돌려줬고 로드맵은 빈 목록이었어요.

### 2. 창작자가 workers.dev 에서 볼 것

- `/`, `/pattern`(Live Editor 와 3D 미리보기), `/pattern-lab`, `/guide` 와 그 아래 넷, `/journal`, `/roadmap`, `/editions`, `/features`, `/update`, `/compliance`
- `/flash` 가 `/guide/play#flash` 로 넘어가는지
- `curl -sI https://patternflow-web.<…>.workers.dev/flash/manifest.json` 에 `Access-Control-Allow-Origin: *` 와 `Cache-Control: no-store, must-revalidate` 가 있는지
- 저널 글의 사진이 WebP 로 오는지(개발자 도구 Network 에서 `/_next/image` 의 Content-Type)
- `/roadmap` 에 이슈가 보이는지(1번의 6)

패널 콘솔의 「새 펌웨어」 띠와 무선 업데이트는 patternflow.work 를 읽어요. 그 둘은 도메인을 이은 뒤에 봐요.

### 3. patternflow.work 와 www 잇기

1. 대시보드 → patternflow.work → DNS → Records 에서 `patternflow.work` 와 `www` 레코드(Vercel 을 가리키는 A 와 CNAME)의 종류와 값을 적어 둬요. 되돌릴 때 그대로 다시 만들어요. 적은 뒤 두 레코드를 지워요. 같은 이름의 레코드가 있으면 Custom Domain 이 만들어지지 않아요.
2. `wrangler.jsonc` 의 `"preview_urls": true,` 아래에 이 줄을 넣고 `npm run cf:deploy` 해요. Cloudflare 가 DNS 레코드와 인증서를 만들어요. 1번과 2번 사이에는 사이트가 몇 분 열리지 않을 수 있어요.

   ```jsonc
   "routes": [
     { "pattern": "patternflow.work", "custom_domain": true },
     { "pattern": "www.patternflow.work", "custom_domain": true }
   ],
   ```

3. Vercel 이 www 를 patternflow.work 로 넘기고 있었다면 Rules → Redirect Rules 의 「Redirect from WWW to root」 템플릿으로 같은 넘김을 만들어요. 이 세션에서는 지금 www 가 어떻게 답하는지 볼 수 없었어요.
4. 도메인으로 2의 목록을 다시 보고, 패널이 있으면 콘솔의 Update 쪽에서 「새 펌웨어」 띠와 무선 업데이트를 해 봐요.
5. `wrangler.jsonc` 에 넣은 routes 는 PR 로 레포에 남겨요. 다음 배포가 도메인을 떼지 않게요.

### 4. Vercel 끄기

일주일쯤 두고 Worker 의 Observability 에 5xx 가 없으면 Vercel 프로젝트 → Settings → Git 에서 저장소 연결을 끊어 새 배포를 멈춰요. 프로젝트와 그 도메인 설정은 남겨 둬요. 남아 있어야 아래 한 줄로 돌아갈 수 있어요. `vercel.json` 과 ARCHITECTURE.md 의 Vercel 문단은 Vercel 을 지우는 날 따로 걷어요.

### 되돌리기

Worker 의 Custom Domain 둘을 지우고(Workers & Pages → `patternflow-web` → Settings → Domains & Routes) 3의 1번에 적어 둔 Vercel 레코드를 다시 만들면 patternflow.work 는 Vercel 이 다시 받아요.

## 환경 변수

코드가 `process.env` 로 읽는 이름 전부예요. 값은 레포에 적지 않아요. 「빌드」는 `next build` 가 페이지와 스크립트에 써 넣는 값이라 빌드하는 곳에 있어야 하고 `wrangler secret` 은 늦어요. 「비밀」은 `npx wrangler secret put NAME` 이에요.

| 이름 | 읽는 곳 | Workers 에서 |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_POSTHOG_KEY` · `NEXT_PUBLIC_POSTHOG_HOST` | `providers/PostHogProvider.tsx`, `lib/posthogEvents.ts` | 빌드. Vercel 값 그대로 |
| `NEXT_PUBLIC_CF_WEB_ANALYTICS_TOKEN` | `app/layout.tsx` | 빌드. 새 값(1의 3번) |
| `NEXT_PUBLIC_COMMUNITY_URL` | `lib/community/apiBase.ts`, `lib/community/server/db.ts` | 빌드. Vercel 값 그대로 |
| `NEXT_PUBLIC_BUILD_ENABLED` | `lib/community/apiBase.ts` | 빌드. Vercel 에 있을 때만 |
| `GITHUB_TOKEN` | `app/api/roadmap/route.ts` | 비밀. 선택(1의 6번) |
| `COMMUNITY_ENABLED` | `proxy.ts`, `lib/community/server/db.ts` | 두지 않아요. 두면 `/api/community` 가 열리고 SQLite 를 찾다 실패해요 |
| `BETTER_AUTH_SECRET` · `BETTER_AUTH_URL` · `COMMUNITY_DB_PATH` · `COMMUNITY_ALLOWED_ORIGINS` · `COMMUNITY_ADMIN_USERNAMES` | 커뮤니티 서버 | 두지 않아요. 파이 몫 |
| `BUILD_ENABLED` · `FIRMWARE_SRC_DIR` · `BUILD_WORK_DIR` · `BUILD_ARTIFACT_DIR` · `PF_XTENSA_BIN` · `PF_TARGET_ABI` · `PYTHON_PATH` · `WORKER_ID` · `BUILD_POLL_MS` | 모듈 빌드 서비스와 `scripts/build-worker.ts` | 두지 않아요. 파이 몫 |
| `VARIANT_BIN_DIR` | `app/api/variant-bin/[...path]/route.ts` | 두지 않아요. 없으면 404 이고, Vercel 에서도 그래요 |
| `NEXT_DEV_ORIGINS` | `next.config.ts` | 두지 않아요. `next dev` 몫 |
| `NODE_ENV` · `PATTERN_SANDBOX_VERSION` · `INIT_CWD` · `ARDUINO_DIRECTORIES_DATA` · `LOCALAPPDATA` · `PLATFORMIO_CORE_DIR` · `PF_DRIFT_STRICT` · `PF_LOCK_BASE` | Next.js 와 `next.config.ts`, 컴파일러 찾기, 검사 스크립트 | 배포가 정하지 않아요 |

OpenNext 는 `web/` 의 `.env`, `.env.local`, `.env.production(.local)` 값을 Worker 의 `process.env` 로 넣고, `.env.development(.local)` 과 `.env.test(.local)` 도 같은 묶음에 써 넣어요. 커뮤니티를 띄워 본 책상이라면 `.env.local` 에 `COMMUNITY_ENABLED=1` 과 `BETTER_AUTH_SECRET` 이 있을 텐데, 그대로 빌드하면 둘 다 Worker 에 실려요. 그래서 `cf:build` 는 이 파일들에 `NEXT_PUBLIC_` 이 아닌 이름이 있으면 이름만 찍고 멈춰요. 그 값은 잠깐 다른 파일로 옮겨요. 로컬 미리보기에서 서버 값이 필요하면 `.dev.vars` 에 넣어요(gitignore 됨).

## Vercel 과 다르게 도는 것

- `public/` 의 파일은 Workers Static Assets 가 Next.js 보다 먼저 답해서 `next.config.ts` 의 `headers()` 가 닿지 않아요. 로컬 미리보기에서 `/flash/manifest.json` 과 `/flash/bin/*` 가 `Access-Control-Allow-Origin` 없이 나왔어요. 패널 콘솔이 매니페스트를 읽고 무선 업데이트로 이미지를 받는 데 쓰는 헤더예요. `scripts/cf-headers.ts` 가 같은 `headers()` 를 읽어 `.open-next/assets/_headers` 로 써요. 규칙은 계속 `next.config.ts` 한 곳에서 고치면 되고, 다음 빌드가 따라가요. `/_next/static/*` 의 1년 immutable 은 Vercel 이 알아서 하던 것이라 그 파일에 한 줄 더했어요.
- `wrangler.jsonc` 의 `html_handling` 을 `"none"` 으로 뒀어요. 기본값은 `/pattern-sandbox.html?v=…` 를 `/pattern-sandbox` 로 307 넘기고, 가이드의 콘솔 창이 `knobs.html` 같은 이름으로 여는 페이지도 넘겨요. `"none"` 이면 Vercel 처럼 파일 이름 그대로 답해요. 다른 점은 손으로 친 `/guide/console-demo/` 하나로, 404 예요. 사이트는 그 주소를 쓰지 않아요.
- `proxy.ts` 는 Next.js 16 에서 Node 로만 돌아요. OpenNext 는 Node 미들웨어를 「실험」으로 지원하고 빌드 때 그렇게 경고해요. 묶다가 `@opentelemetry/api` 를 찾지 못해 멈춰서, `scripts/cf-proxy-trace.ts` 가 그 패키지를 proxy 의 trace 에서 빼요(까닭은 파일 머리). 미리보기에서 저널 `?lang=` 넘김과 쿠키, `/en/en` 접기, `/api/community` 404 가 모두 Vercel 과 같게 돌았어요. Next.js 나 OpenNext 를 올릴 때 이 부분이 먼저 깨질 수 있으니 `npm run cf:preview` 로 `/journal?lang=en` 을 봐요.
- `next/image` 는 Images 바인딩(`IMAGES`)으로 줄여요. 6.26 MiB 인 `journal/v1-30-days/first-pcb.jpg` 가 너비 640 에서 92 KB, 1200 에서 224 KB WebP 로 나왔어요. Cloudflare Images 는 한 달 고유 변환 5,000건까지 무료로 알고 있어요. 공식 가격 페이지는 이 세션에서 열지 못했어요 `?`. `public/` 의 `journal`, `builds`, `cases`, `guide` 사진이 217장이고 화면 폭마다 두세 너비가 쓰이니, 한 달 수백 건에서 천 건 안팎으로 봐요. 일주일 뒤 Images 대시보드의 변환 수를 봐요. 바인딩을 빼면 원본이 그대로 가서, 휴대폰이 6 MB 사진을 받아요.
- `public/` 의 사진을 줄인 응답에는 Cache-Control 이 붙지 않아요. OpenNext 는 원본이 immutable 일 때만 붙이고, `public/` 은 경로에 판이 없어 immutable 로 두지 않았어요. 그래서 같은 사진도 볼 때마다 Worker 요청 하나와 변환 하나가 돌아요. 고유 변환으로 센다면 값은 늘지 않아요.
- `/api/roadmap`(`revalidate = 600`)은 R2 캐시와 메모리 큐로 10분마다 다시 읽어요. 미리보기에서 빌드 10분 뒤 첫 요청이 `x-nextjs-cache: STALE`, 8초 뒤 요청이 `HIT` 이고 `s-maxage=592` 였어요. 새 항목이 R2 에 써진 거예요. 읽기만 하는 Static Assets 캐시였다면 다음 배포까지 빌드 때 목록에 머물러요.
- `/feed.xml` 과 저널 글의 OG 카드 37장은 빌드 때 만들어요. 요청 때 만들면 `content/journal` 을 읽는데, 그 폴더는 Worker 안에 없어요. Vercel 에도 같이 바뀌어요.
- Vercel Analytics 와 Speed Insights 를 걷고 Cloudflare Web Analytics 비컨을 넣었어요. 방문과 Core Web Vitals 를 쿠키 없이 세요. Vercel 에 쌓인 기록은 옮겨지지 않아요. 토큰이 없으면 비컨도 없어요.
- 크기: Worker 22,486 KiB, gzip 4,969 KiB(`wrangler deploy --dry-run`, 10월 25일). 정적 파일 492개 가운데 가장 큰 것이 6.26 MiB 저널 사진이고 플래셔 이미지는 1.42 MiB(`performance-v0.4.0`)가 가장 커요. 파일 하나 한도 25 MiB 에 한참 못 미쳐요.
- `preview_urls` 를 켜 두었어요. `cf:upload` 한 판마다 미리보기 주소가 생기고, 같은 R2 캐시와 같은 비밀(`GITHUB_TOKEN` 하나)을 써요. 도메인을 이은 뒤 workers.dev 주소를 닫고 싶으면 `"workers_dev": false` 로 바꿔 배포해요.

## Workers Builds 로 잇는다면

대시보드 → Workers & Pages → `patternflow-web` → Settings → Builds 에 GitHub 저장소를 이을 수 있어요. Root directory 는 `web`, Build command 는 `npm run cf:build`, Deploy command 는 `npx opennextjs-cloudflare deploy` 예요. 빌드 변수에 위 표의 「빌드」 값을 넣고 Node 를 22 로 맞춰요. 비밀은 빌드 변수에 넣지 않아요.
