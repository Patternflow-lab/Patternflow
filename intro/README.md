# intro

Patternflow를 한 장으로 소개하는 임시 페이지입니다. 빌드가 없습니다. `index.html`을 브라우저로 끌어다 놓으면 열리고, 패널과 노브도 그대로 돕니다.

마이크는 브라우저가 `https`나 `localhost`에서만 엽니다. 마이크까지 보려면 이 폴더에서 `python3 -m http.server 8000`을 띄우고 `http://localhost:8000`을 엽니다.

파일은 다섯 가지입니다. `index.html`이 글 전부이고, `style.css`가 모양, `intro.js`가 패널과 노브와 마이크와 영상입니다. `patterns.js`는 [`web/src/lib/presets/`](../web/src/lib/presets/)의 Origin, 0629-2, 0524-2, 0629를 그대로 옮긴 코드이고, 그 폴더가 원본입니다. `media/`의 두 사진은 [`docs/media/`](../docs/media/)의 `product_v2.jpg`와 `community-builds.jpg`를 1600px로 줄인 것입니다.

영상은 YouTube의 소개 영상(`1tkV8-AgdpA`)입니다. 누르기 전까지는 `media/poster.jpg`만 보이고 YouTube는 불리지 않습니다. 다른 영상으로 바꾸려면 `index.html`의 `data-film` 값과 아래 링크 두 곳의 주소를 바꿉니다.

「세계에서」의 기록은 루트 [README](../README.md)의 *Story so far*에 있는 것만 옮겼습니다. 더 넣을 기록은 같은 꼴의 `<li>` 한 줄로 더합니다.

본 사이트와 원래 레포에는 아직 잇지 않았습니다.
