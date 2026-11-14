# collab-kit

브랜드 협업 폴더(`incoming/collab-<brand>/`)가 같이 쓰는 도구예요. 폴더 하나는 `patterns/<slug>.js`, `sheet.json`, `README.md`, `shots/`, 그리고 `sheet.ts` 가 짓는 `reference.html` 이에요. 패턴은 패턴 연구의 `tools/lab.ts` 로 읽고 돌려요. Pattern Lab 이 코드에서 레이어를 만드는 길 그대로이고, 그리는 것은 Lab 미리보기의 엔진 `LabEngine` 이에요.

`web/` 에서 돌려요. `npm ci` 가 먼저예요.

```sh
npx tsx ../incoming/collab-kit/check.ts clio            # 머리 줄, 금지 이름, 240초 되풀이, 채움, 노브 반응
npx tsx ../incoming/collab-kit/check.ts clio --soak     # 그리고 900초
npx tsx ../incoming/collab-kit/shoot.ts clio            # shots/<slug>.png, .gif, -looks.png (GIF 는 ffmpeg)
npx tsx ../incoming/collab-kit/sheet.ts clio --png      # reference.html 과 그 화면 1440, 390
npx tsx ../incoming/collab-kit/lab-shot.ts clio         # npm run dev 를 켠 채로: 진짜 Pattern Lab 에서 연 화면
```

`check.ts` 의 잣대는 패턴 연구 `ROUND.md` 「창작자 방향」의 것이에요. recur 0.40 아래와 노브 반응 0.03 아래는 실패예요. 채움 두 값(dark 0.40, still 0.30)은 `!` 만 붙이고 실패로 세지 않아요. 브랜드 결에 따라 바닥이 어두운 그림을 고를 수 있어서예요. 그럴 땐 그 폴더 README 에 까닭을 적어요.

`reference.html` 은 파일 하나로 디스크에서 바로 열려요. 패널은 `play.ts` 가 Lab 엔진으로 돌리고, 펌웨어가 하는 채도 1.62배와 CIE1931 단계를 거쳐 LED 처럼 그려요(`led.ts`). 스크립트가 돌기 전에는 `shoot.ts` 의 정지 화면이 보여요.

`sheet.json` 의 `places[].kind` 는 `wall`(입구 벽에 선 패널 셋), `counter`(테스터 사이 카운터 위 한 대), `mirror`(거울 옆 조명), `reel`(9:16 영상 바탕), `window`(쇼윈도 넷) 가운데 하나예요. 장면은 회색 도형으로만 그리고, 로고나 제품 사진은 쓰지 않아요.
