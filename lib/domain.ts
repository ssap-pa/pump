export type Rec = {
    id: string;
    kind: string;
    parent: string;
    data: any;
    created: string;
};
export type Item = {
    name: string;
    unit: string;
    qty: number;
    price: number;
    memo: string;
};
export const money = (n: number) => Math.round(n).toLocaleString('ko-KR');
export const subtotal = (items: Item[]) => items.reduce((s, i) => s + Math.round(i.qty * i.price), 0);
export const total = (q: any) => { const s = subtotal(q?.items || []); return s + (q?.vat === false ? 0 : Math.round(s * .1)); };
export const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
export const blankItem = (): Item => ({ name: '', unit: '식', qty: 1, price: 0, memo: '' });
export const exampleItems: Item[] = [['VLOLA 매립수전설비', 'ea', 1, 700000, ''], ['도기세팅', 'ea', 2, 550000, ''], ['무광돔천장', 'ea', 1, 400000, '거실(메인1,사이드2)'], ['무광돔천장', '식', 1, 600000, '안방(메인2,사이드3)'], ['휴젠뜨시공비', 'ea', 2, 120000, ''], ['VOLA타올워머 설치', 'ea', 1, 600000, ''], ['휴젠뜨3', 'ea', 1, 650000, ''], ['휴젠뜨노바', 'ea', 1, 350000, ''], ['욕조수전설비설치', 'ea', 1, 650000, ''], ['욕조수도설비', 'ea', 1, 300000, '']].map(([name, unit, qty, price, memo]) => ({ name, unit, qty, price, memo })) as Item[];
