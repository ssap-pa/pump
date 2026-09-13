import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import {defineConfig} from 'vite';
export default defineConfig(async()=>{
  process.env.WRANGLER_WRITE_LOGS??='false';
  const {cloudflare}=await import('@cloudflare/vite-plugin');
  return {css:{postcss:{plugins:[tailwindcss()]}},plugins:[vinext(),cloudflare({viteEnvironment:{name:'rsc',childEnvironments:['ssr']}})]};
});
