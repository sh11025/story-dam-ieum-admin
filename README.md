# Story Dam Ieum 관리자 화면

사용자 사이트(Render)에 보일 **공지를 쓰고 고치는 화면**입니다. 깃허브 페이지에 올리고, 공지는 이 저장소의 `data/notices.json` 파일에 저장됩니다. 서버나 저장소(데이터베이스)가 따로 필요 없습니다.

## 어떻게 동작하나요

1. 관리자가 깃허브 페이지 주소로 들어와 **깃허브 출입 키(토큰)** 로 로그인합니다.
2. 공지를 쓰고 **깃허브에 저장**을 누르면 `data/notices.json`이 바로 바뀝니다(깃허브에 기록이 남아 언제든 되돌릴 수 있어요).
3. 사용자 사이트는 이 파일을 읽어 공지를 보여 줍니다. 저장 후 몇 분 안에 반영됩니다.

출입 키가 곧 "열쇠"입니다. 코드에는 들어가지 않고, 관리자가 로그인할 때만 입력합니다. 키는 이 화면 메모리에만 있고 깃허브 외에는 어디에도 보내지 않습니다.

## 처음 설정하기

0. **먼저 할 일**: 이 폴더의 `deploy.yml` 파일을 `.github\workflows\` 폴더를 만들어 그 안으로 옮기세요. (보안상 이 폴더는 원격으로 만들 수 없어 바깥에 두었습니다.)
1. 이 폴더를 **공개(Public)** 깃허브 저장소로 올립니다. 예: `story-dam-ieum-admin`
   - 사용자 사이트가 공지 파일을 읽으려면 공개여야 합니다. 공지는 원래 모두에게 보이는 내용이라 괜찮습니다.
2. 저장소 → **Settings** → **Pages** → Source를 **GitHub Actions**로 바꿉니다.
3. **Actions** 탭에서 "Deploy admin to GitHub Pages"가 끝나면 `https://(아이디).github.io/story-dam-ieum-admin/` 로 접속할 수 있습니다.
4. 출입 키 만들기
   - 깃허브 → 프로필 → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**
   - Repository access: **Only select repositories** → 이 관리자 저장소만 선택
   - Permissions → **Contents: Read and write**
   - 만료일을 정해 만들고, 나온 키를 관리자 화면 로그인 칸에 붙여넣습니다.
5. 로그인 후 아래쪽 **사용자 사이트 연결**의 주소를 복사해, Render 사용자 사이트의 `NOTICES_URL`에 넣습니다.

## 관리 화면 탭 (2026-10-15)

- **공지**: 공지 쓰기·고치기·삭제. 보이기 시작하는 날·마지막 날을 정하면 그 기간에만 사용자 화면에 보여요. `**굵게**`와 `https://` 링크를 쓸 수 있고, 아래 미리보기로 확인해요.
- **자주 묻는 질문**: 사용자 사이트의 "자주 묻는 질문"을 고쳐요. 손대지 않으면 기본 질문 2개가 보여요.
- **수정 기록**: 깃허브에 저장된 최근 20번의 기록을 보고, 원하는 때의 상태로 되돌려요(되돌린 뒤 "깃허브에 저장").
- **연결 상태**: 사용자 사이트(Render) 주소를 넣으면 서버가 켜져 있는지, 공지가 연결됐는지, AI가 켜져 있는지 확인해요. 출입 키 만료일도 보여 주고 7일 전부터 경고해요. 깃허브가 만료일을 알려 주지 않으면 직접 적어 둘 수 있어요.

## 주의할 점

- 출입 키는 비밀번호처럼 다뤄 주세요. 유출이 의심되면 깃허브 같은 화면에서 바로 삭제(Revoke)하면 됩니다.
- 관리자 화면 주소는 누구나 열 수 있지만, 출입 키 없이는 아무것도 바꿀 수 없습니다.
- 공지 파일만 바뀐 경우에는 관리자 화면을 다시 만들지 않습니다(`.github/workflows/deploy.yml`의 `paths-ignore`).

## 내 컴퓨터에서 실행하기

```powershell
npm install
npm run dev     # http://127.0.0.1:5174
npm run build   # 배포용 파일(dist/) 만들기
npx playwright test   # 자동 테스트 (깃허브를 흉내 내서 확인)
```

내 컴퓨터에서 열면 저장소 주인·이름을 자동으로 알 수 없으니, 로그인 화면의 "공지 파일 위치"에 직접 입력하세요.

## 파일 구조

```text
src/App.tsx       로그인·공지 목록·편집 화면
src/github.ts     깃허브에서 공지 파일 읽기·저장
src/styles.css    디자인 (사용자 사이트와 같은 색)
data/notices.json 공지 파일 (관리자 화면이 고치는 파일)
.github/workflows/deploy.yml  깃허브 페이지 자동 배포
tests/            자동 테스트
```

## 공지 파일 형식

```json
{
  "version": 1,
  "updatedAt": "2026-10-14T00:00:00.000Z",
  "notices": [
    { "id": "welcome", "title": "제목", "body": "내용", "urgent": false, "publishedAt": "2026-10-14T00:00:00.000Z" }
  ]
}
```

`urgent`가 `true`면 사용자 화면 맨 위에 "중요"로 펼쳐져 보입니다.
