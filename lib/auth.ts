import {betterAuth} from 'better-auth';
import {env} from 'cloudflare:workers';

export function getAuth(){
 const e=env;
 if(!e.BETTER_AUTH_URL||!e.BETTER_AUTH_SECRET||!e.GOOGLE_CLIENT_ID||!e.GOOGLE_CLIENT_SECRET)throw new Error('고객 로그인 설정이 아직 완료되지 않았습니다.');
 return betterAuth({
  appName:'설비노트',baseURL:e.BETTER_AUTH_URL,secret:e.BETTER_AUTH_SECRET,
  database:e.DB,
  trustedOrigins:[new URL(e.BETTER_AUTH_URL).origin],
  socialProviders:{google:{clientId:e.GOOGLE_CLIENT_ID,clientSecret:e.GOOGLE_CLIENT_SECRET,prompt:'select_account'}},
  account:{accountLinking:{enabled:false},encryptOAuthTokens:true},
  session:{expiresIn:60*60*24*7,updateAge:60*60*24},
  rateLimit:{enabled:true,storage:'database',window:60,max:30},
 });
}
