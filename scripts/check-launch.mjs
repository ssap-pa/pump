import {readFile} from 'node:fs/promises';
const config=JSON.parse(await readFile(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
const database=config.d1_databases?.find(v=>v.binding==='DB');
if(!database || database.database_id==='00000000-0000-4000-8000-000000000000')throw new Error('먼저 본인 Cloudflare D1을 만들고 실제 database_id를 설정하세요.');
if(!config.account_id&&!process.env.CLOUDFLARE_ACCOUNT_ID)throw new Error('검증된 Cloudflare account_id를 설정하세요.');
if(config.vars.BILLING_ORIGIN!==config.vars.BETTER_AUTH_URL)throw new Error('Google 로그인과 결제의 기본 URL이 일치해야 합니다.');
console.log('Cloudflare deployment configuration is ready.');
