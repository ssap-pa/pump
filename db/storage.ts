import { env } from 'cloudflare:workers';
export function db() { return env.DB; }
export function files() { return env.FILES; }
