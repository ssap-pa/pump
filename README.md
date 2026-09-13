# 설비노트 (pump)

배관·설비 사업자를 위한 모바일 웹/PWA입니다.

서비스: https://pump.ssapclass.com

## 주요 기능
- 현장·견적·입금·작업일지 관리
- 현장 사진과 영수증 업로드, GPT-5 nano 영수증 인식
- Google 로그인과 사용자별 데이터 분리
- 무료 현장 10개, 이후 월 9,900원 구독 화면과 테스트 결제
- 홈 화면 설치용 PWA manifest와 아이콘

## 기술
React, TypeScript, Vinext, Tailwind CSS, Cloudflare Workers, D1, R2, Better Auth, Toss Payments.

## 개발 및 배포
Node.js 22.13 이상을 사용합니다.

1. `npm ci`
2. `.dev.vars.example`을 `.dev.vars`로 복사하고 본인의 개발용 값을 입력합니다.
3. 별도 환경에서는 `wrangler.jsonc`의 계정·D1·R2·도메인을 본인 리소스로 변경합니다.
4. `npx wrangler d1 migrations apply seolbinote-db --local`
5. `npm run dev`
6. `npx tsc --noEmit`
7. `npm run deploy` (인증된 Cloudflare 계정에 배포)

OAuth 복귀 주소와 서버 Secrets 설정은 [LAUNCH.md](LAUNCH.md)를 참고하세요.

## 현재 제한
- 결제는 테스트 키 전용이며 자동 갱신은 비활성화되어 있습니다. 실제 카드 결제 성공과 라이브 출시 검증은 별도입니다.
- Google OAuth는 테스트 운영 상태입니다.
- PWA 오프라인 저장은 구현되지 않았으며 실기기 설치·카메라·마이크는 별도 확인이 필요합니다.
- AdSense 사이트 등록 후 인증 대기 상태로 광고는 아직 게재하지 않습니다.

## 데이터와 비밀키
이 저장소에는 소스코드만 보관합니다. 운영 데이터는 D1, 첨부 파일은 R2, 서버 API 키는 Worker Secrets에 보관합니다. `.env*`, `.dev.vars`, 로컬 DB 및 빌드 산출물은 Git에서 제외합니다.
