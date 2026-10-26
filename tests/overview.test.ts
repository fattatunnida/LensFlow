import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { inboxDestination, type InboxTarget } from '../src/features/overview/models';

test('inbox destinations allow only known routes with valid dates and document IDs', () => {
  assert.deepEqual(inboxDestination({kind:'calendar',date:'2028-02-29'}),{pathname:'/calendar',params:{date:'2028-02-29'}});
  assert.deepEqual(inboxDestination({kind:'financeBooking',id:'booking_123'}),{pathname:'/finance/bookings/[id]',params:{id:'booking_123'}});
  assert.deepEqual(inboxDestination({kind:'financeEntry',id:'entry-123'}),{pathname:'/finance/entries/[id]',params:{id:'entry-123'}});
  for(const target of [{kind:'calendar',date:'2026-02-30'},{kind:'calendar',date:'2026-01-00'},{kind:'financeEntry',id:'../another'},{kind:'financeBooking',id:'a/b'},{kind:'url',id:'https://example.com'}]) assert.throws(()=>inboxDestination(target as InboxTarget));
});

test('native feature views contain no literal text nodes outside Text', () => {
  const issues:string[]=[];
  function scan(dir:string){
    for(const file of readdirSync(dir,{withFileTypes:true})){
      const path=join(dir,file.name);if(file.isDirectory()){scan(path);continue;}if(!path.endsWith('.tsx'))continue;
      const source=ts.createSourceFile(path,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
      function walk(node:ts.Node){
        if(ts.isJsxText(node)){
          const parent=node.parent,tag=ts.isJsxElement(parent)?parent.openingElement.tagName.getText(source):'';
          // A same-line space is rendered as a text child by the JSX transform.
          const literal=node.getText(source),rendered=literal.trim().length>0||(!/[\r\n]/.test(literal)&&literal.length>0);
          if(rendered&&tag!=='Text')issues.push(`${path}:${source.getLineAndCharacterOfPosition(node.pos).line+1}: ${JSON.stringify(literal)}`);
        }
        ts.forEachChild(node,walk);
      }
      walk(source);
    }
  }
  scan(join(process.cwd(),'src','features'));assert.deepEqual(issues,[]);
});
