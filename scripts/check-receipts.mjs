import assert from 'node:assert/strict';
import {parseReceipt,validPurchase} from '../lib/receipt.ts';
const text=`자재 구매 영수증
상호: 한빛 철물
2026-09-10
품명 단가 수량 금액
PVC 엘보 15A 1,000 3 3,000
볼밸브 20A 5,000 2 10,000
합계 13,000
카드승인번호 12345678`;
const p=parseReceipt(text,90);console.log(p);assert.equal(p.items.length,2);assert.equal(p.items[0].name,'PVC 엘보 15A');assert.equal(p.items[0].quantity,3);assert.equal(p.total,13000);assert.equal(p.date,'2026-09-10');assert.equal(parseReceipt('흐린 글자').items.length,0);assert.equal(parseReceipt('엘보 1,000').items[0].quantity,null);assert.equal(validPurchase({...p,fileId:'a'}),true);assert.equal(validPurchase({...p,fileId:'a',total:-1}),false);console.log('PASS: Korean receipt columns, totals, dates, unknown quantities and validation');
