# Cloudflare 배포 안내

## 현재 서비스
- Worker: seolbinote
- 도메인: https://pump.ssapclass.com
- 데이터베이스: seolbinote-db (D1)
- 파일 저장소: seolbinote-files (R2)
- 소스 저장소: https://github.com/ssap-pa/pump

`wrangler.jsonc`는 현재 운영 리소스를 가리킵니다. 별도 설치 시 본인 리소스로 변경하세요. 메인 도메인 ssapclass.com의 기존 사이트와 DNS는 변경하지 않습니다.

## 서버 Secrets
`.dev.vars.example`에는 필요한 변수명만 들어 있습니다. 로컬에서는 `.dev.vars`, 운영에서는 `npx wrangler secret put 변수명`으로 설정합니다.

Google OAuth 웹 클라이언트 origin은 https://pump.ssapclass.com, 복귀 주소는 https://pump.ssapclass.com/api/auth/callback/google 입니다.

BILLING_ENCRYPTION_KEY는 무작위 32바이트를 64자리 hex로 표현한 키입니다. 기존 키를 교체하면 저장된 빌링 키를 복호화할 수 없으므로 보존해야 합니다.

## 배포
1. `npx wrangler login`
2. `npx wrangler whoami`로 대상 계정 확인
3. 신규 환경이라면 D1/R2 생성 및 wrangler 설정 갱신
4. `npx wrangler d1 migrations apply seolbinote-db --remote` (대상 확인 후 필요한 경우)
5. `npx tsc --noEmit`
6. `node --test --test-isolation=none tests/billing.test.mjs tests/site-quota.test.mjs`
7. `npm run deploy`

main에 push하면 Cloudflare Workers Builds가 검증 후 자동 배포합니다.

## 출시 전 남은 사항
- 결제 테스트 모드. 자동 갱신 BILLING_RENEWALS_ENABLED=false. 라이브 키는 코드에서 차단합니다.
- Google OAuth 테스트 상태의 공개 운영 전환 필요.
- AdSense ssapclass.com 소유권 인증 및 심사 미완료, 광고 게재 미구현.
- 기존 Sites 데이터/파일은 아직 이전하지 않았습니다. 사용자 ID 매핑과 소유권 검증 없이 합치지 않습니다.
- PWA는 설치 메타데이터를 제공하며 오프라인 쓰기는 미구현입니다.

## 자동 배포 연결
Cloudflare Worker Settings > Builds에서 기존 seolbinote를 다음 설정으로 연결합니다.
- 저장소: ssap-pa/pump
- Production branch: main
- Root directory: /
- Build command: npm run ci:check
- Deploy command: npm run deploy
- Node 버전: 24
- 비운영 브랜치 자동 배포: 비활성화

npm run deploy가 빌드를 포함합니다. API 키는 기존 Worker Secrets를 유지하며 GitHub 소스에 추가하지 않습니다. GitHub 연결 완료. main push로 자동 배포가 실행됩니다.

