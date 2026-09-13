import fs from 'node:fs';
import ts from 'typescript';
for(const file of ['app/desk.tsx','app/page.tsx','app/layout.tsx','app/api/records/route.ts','app/api/files/route.ts','db/schema.ts','db/storage.ts','lib/domain.ts']){const src=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);fs.writeFileSync(file,ts.createPrinter({newLine:ts.NewLineKind.LineFeed}).printFile(src));}
