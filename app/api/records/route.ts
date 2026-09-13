import { insertSite } from '@/lib/site-quota';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { db } from '@/db/storage';
import type { Item } from '@/lib/domain';
type StoredRow={id:string;kind:string;parent:string;data:string;created:string};
type WriteBody={id?:string;kind:string;parent?:string;data:{name?:string;amount?:number;items?:Item[];[key:string]:unknown}};
const json = (v: unknown, s = 200) => Response.json(v, { status: s });
export async function GET() { const u = await getChatGPTUser(); if (!u)
    return json({ error: '로그인 후 이용해 주세요.' }, 401); const r = await db().prepare('SELECT id,kind,parent,data,created FROM records WHERE owner=? ORDER BY created DESC').bind(u.userId).all<StoredRow>(); return json(r.results.map((r) => ({ ...r, data: JSON.parse(r.data) }))); }
export async function POST(req: Request) {
    const u = await getChatGPTUser();
    if (!u)
        return json({ error: '로그인 후 이용해 주세요.' }, 401);
    if (req.headers.get('origin') && req.headers.get('origin') !== new URL(req.url).origin)
        return json({ error: '요청을 확인해 주세요.' }, 403);
    let b: WriteBody;
    try {
        const raw = await req.text();
        if (raw.length > 100000)
            return json({ error: '입력 내용이 너무 큽니다.' }, 413);
        b = JSON.parse(raw);
    }
    catch {
        return json({ error: '올바르지 않은 입력입니다.' }, 400);
    }
    if (!b || typeof b !== 'object' || !['site', 'quote', 'note', 'payment', 'profile'].includes(b.kind) || typeof b.data !== 'object' || !b.data || Array.isArray(b.data))
        return json({ error: '입력 내용을 확인해 주세요.' }, 400);
    if (b.kind === 'site' && !String(b.data.name || '').trim())
        return json({ error: '현장명을 입력해 주세요.' }, 400);
    if (b.kind === 'quote' && (!Array.isArray(b.data.items) || b.data.items.length > 200 || b.data.items.some((i: Item) => !Number.isFinite(i.qty) || !Number.isFinite(i.price) || i.qty < 0 || i.price < 0 || i.qty > 1000000 || i.price > 10000000000)))
        return json({ error: '수량과 단가를 확인해 주세요.' }, 400);
    if (b.kind === 'payment' && (typeof b.data.amount !== 'number' || !Number.isFinite(b.data.amount) || b.data.amount <= 0))
        return json({ error: '입금액은 0보다 커야 합니다.' }, 400);
    if (['quote', 'note', 'payment'].includes(b.kind)) {
        const p = await db().prepare('SELECT id FROM records WHERE id=? AND owner=? AND kind=?').bind(b.parent || '', u.userId, 'site').first();
        if (!p)
            return json({ error: '현장을 찾을 수 없습니다.' }, 404);
    }
    if (b.kind === 'note') {
        if (typeof b.data.text !== 'string' || !Array.isArray(b.data.attachments) || b.data.attachments.length > 100)
            return json({ error: '작업 내용과 첨부파일을 확인해 주세요.' }, 400);
        const attachments = [];
        for (const entry of b.data.attachments) {
            if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string')
                return json({ error: '첨부파일을 확인해 주세요.' }, 400);
            const attachment = await db().prepare('SELECT data FROM records WHERE id=? AND owner=? AND parent=? AND kind=?')
                .bind(entry.id, u.userId, b.parent, 'file').first<{ data: string }>();
            if (!attachment) return json({ error: '현재 현장에 업로드한 파일만 연결할 수 있어요.' }, 404);
            const data = JSON.parse(attachment.data);
            attachments.push({ id: entry.id, name: data.name, type: data.type });
        }
        b.data.attachments = attachments;
    }
    const id = b.id || crypto.randomUUID();
    if (b.id) {
        const old = await db().prepare('SELECT kind,parent FROM records WHERE id=? AND owner=?').bind(id, u.userId).first<{kind:string;parent:string}>();
        if (!old)
            return json({ error: '자료를 찾을 수 없습니다.' }, 404);
        if (old.kind !== b.kind || old.parent !== (b.parent || ''))
            return json({ error: '변경할 수 없는 자료입니다.' }, 400);
        await db().prepare('UPDATE records SET data=? WHERE id=? AND owner=?').bind(JSON.stringify(b.data), id, u.userId).run();
    }
    else if (b.kind === 'site') {
        if (!await insertSite(db(), u.userId, id, b.data))
            return json({ error: '무료 현장 10개를 모두 사용했어요. 11번째 현장부터 구독이 필요합니다.', code: 'SITE_LIMIT_REACHED', subscriptionUrl: '/subscription' }, 403);
    }
    else {
        await db().prepare('INSERT INTO records(id,owner,kind,parent,data,created) VALUES(?,?,?,?,?,?)').bind(id, u.userId, b.kind, b.parent || '', JSON.stringify(b.data), new Date().toISOString()).run();
    }
    return json({ id });
}
