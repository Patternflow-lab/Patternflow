# TASK — Besoiobiy 케이스를 리믹스 폴더로 정리

이 브랜치의 `incoming/besoiobiy-case/` 에 받은 그대로의 원본이 있다(`original/` 12개 파일, `AUTHOR_NOTES.md` 작성자 원문).
이것을 `CONTRIBUTING.md` 의 리믹스 규칙대로 **`hardware/case/remixes/besoiobiy-printed/`** 로 정리한다.

## 만들 것
1. **README.md (영어)** — `hardware/case/remixes/simonepda-lasercut/README.md` 와 같은 형식.
   - 머리 필드: Author(Besoiobiy, Patternflow Discord) · License: CC-BY-SA-4.0 · Based on · Fits(어느 보드·패널) · Material · Verified(작성자가 1주일 사용, 2026-10)
   - 파일 표, 변형(내부 브리지 유무 — USB 접근용, 라벨 유무 — 그림 3), 출력 방향(3MF에 놓인 방향 그대로가 재료가 가장 적게 든다)
   - 부품: M3×8×5 열압입 황동 인서트(그림 6 빨강), M3×10 접시머리(그림 6 주황), M3×25 접시머리(그림 7 — 인서트 없이 LED 패널에 직접 체결), 전원 단자 방향(그림 6 파랑)
   - 조립: 접착 순서(그림 5), 체결 위치(그림 6·7), 패널 케이블 높이 줄이는 법(그림 8), 노브 캡 변경
   - **주의:** 작성자 패널의 소켓 깊이 14.35 mm. 패널마다 두께가 달라서 확인이 필요하다
   - **Known issues / open improvements:** 작성자가 적은 3개(모서리 들뜸 그림 1, 패널-프레임 틈 그림 2, 홈 끼움 그림 4)
   - 작성자 원문은 요약하고, 원문 전체는 README 끝에 접어서(`<details>`) 넣는다
2. **파일 배치:** `stl/`, 3MF, `source/`(.blend), `images/`. 이미지는 직접 보고 내용에 맞는 이름으로 바꾼다(그림 번호도 함께). `image.png` 가 무엇인지도 보고 판단한다.
3. **.blend 는 LFS 포인터 그대로 옮기기만 한다.** 열거나 다시 저장하지 않는다(레포 `.gitattributes` 가 `*.blend` 를 LFS로 둔다).
4. **STL 점검:** `PatternBox.stl` 이 여러 부품을 담고 있으면 연결 요소별로 나눠서 부품별 STL로 저장한다(원본 통짜 STL도 남긴다). 부품별 크기(mm)·닫힌 메시 여부를 표로. 미리보기 PNG를 렌더해서 README에 넣는다(trimesh, matplotlib 등 설치해서 써도 된다).
5. 원래 레포의 리믹스 목록·안내 문서에 링크가 있으면 거기에도 한 줄 추가한다.

## PR
- **dev 기준 새 브랜치**에 `hardware/case/remixes/besoiobiy-printed/` 와 (있다면) 목록 링크 변경만 담는다. `incoming/` 과 `.claude/` 는 넣지 않는다.
- `patternflow-lab/Patternflow` 의 **dev 대상 draft PR**. 제목 앞 상태는 `[WIP]` → `[DONE]`.
- 원본에서 판단이 갈린 것(이미지 해석, 부품 분리 기준 등)은 PR 본문 「가정」에 적는다.
