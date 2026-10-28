import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseMarkdown } from '../scripts/markdown-parser.mjs';
import { buildIndex } from '../scripts/index-core.mjs';
import { noteKey, noteTemplate, translateNotes } from '../scripts/english-notes.mjs';

const data=JSON.parse(fs.readFileSync(new URL('../src/generated/knowledge.json',import.meta.url),'utf8'));
const translations=JSON.parse(fs.readFileSync(new URL('../data/english-notes.json',import.meta.url),'utf8'));
const markdown=fs.readFileSync(new URL('../data/CSCI5526_Open_Book_Master_Index.md',import.meta.url),'utf8');
const originals=buildIndex(parseMarkdown(markdown),data.lectures,data.sourceFilename,markdown).data.entries;

test('every displayed note is English, with original references, IDs and formulas intact',()=>{
  assert.equal(data.entries.length,1001);
  for(const original of originals){
    const translated=data.entries.find(entry=>entry.id===original.id);
    assert.ok(translated,original.title);
    assert.ok(!/\p{Script=Han}/u.test(translated.title+' '+translated.explanation),original.title);
    assert.deepEqual(translated.references,original.references);
    assert.equal(translated.rawText,original.rawText);
    for(const expression of noteTemplate(original.explanation).math)assert.ok(translated.explanation.includes(expression),original.title+' formula');
  }
});
test('translation validation fails on missing notes or missing formula placeholders',()=>{
  const original=originals.find(entry=>/\p{Script=Han}/u.test(entry.explanation)&&noteTemplate(entry.explanation).math.length);
  assert.throws(()=>translateNotes([{...original}],{}),/Missing English note/);
  const broken={...translations,[noteKey(original.explanation)]:'A translation without its formula.'};
  assert.throws(()=>translateNotes([{...original}],broken),/Missing or repeated formula/);
});
