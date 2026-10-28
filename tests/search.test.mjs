import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Fuse from 'fuse.js';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createSearchEngine } from '../src/lib/search-engine.mjs';
import { containsTerm, normalize, searchExcerpt } from '../src/lib/search-core.mjs';
import { readState, stateUrl } from '../src/lib/navigation.mjs';
import { pageText } from '../scripts/slide-index.mjs';

const data=JSON.parse(fs.readFileSync(new URL('../src/generated/knowledge.json',import.meta.url),'utf8'));
const search=createSearchEngine([...data.entries,...data.slideEntries],Fuse);
test('every original PDF page has its own searchable entry and exact link',()=>{
  assert.equal(data.slideEntries.length,402);
  assert.equal(new Set(data.slideEntries.map(entry=>entry.id)).size,402);
  for(const lecture of data.lectures){
    const pages=data.slideEntries.filter(entry=>entry.references[0].pdfFilename===lecture.pdfFilename);
    assert.deepEqual(pages.map(entry=>entry.references[0].startPage),Array.from({length:lecture.pageCount},(_,i)=>i+1));
    assert.ok(pages.every(entry=>entry.rawText.trim()));
    assert.ok(pages.every(entry=>!entry.title.startsWith('Computer Science & Engineering')));
  }
});
test('terms absent from every curated entry retrieve the original slide',()=>{
  for(const [query,id] of [['metastasis','slide-2-10'],['desynchronized','slide-2-5'],['trustworthiness','slide-2-9']]){
    assert.ok(!data.entries.some(entry=>containsTerm(entry.rawText,query)),query+' must be absent from curated rows');
    const found=search(query);
    assert.ok(found.some(entry=>entry.id===id),query);
    assert.equal(found[0].category,'Slides');
    assert.ok(searchExcerpt(found[0].rawText,query).toLowerCase().includes(query));
  }
});
test('real PDF extraction joins adjacent glyphs and search finds labels in formulas',async()=>{
  const document=await getDocument({data:new Uint8Array(fs.readFileSync(new URL('../public/pdfs/lec_4_classification.pdf',import.meta.url))),useSystemFonts:true,isEvalSupported:false}).promise;
  try {
    const page=await document.getPage(33);
    const text=pageText(await page.getTextContent());
    assert.match(text,/Precision/);
    assert.match(text,/Recall/);
    assert.equal(data.slideEntries.find(entry=>entry.id==='slide-4-33').rawText,text);
    assert.ok(search('precision').some(entry=>entry.id==='slide-4-33'));
  } finally {await document.destroy();}
});
test('real fuzzy matching handles typos in notes and PDF-only words',()=>{
  assert.equal(search('overfiting')[0].title,'Overfitting');
  assert.ok(search('metastais').some(entry=>entry.id==='slide-2-10'));
});
test('normalization covers case, plurals, line wraps and Unicode hyphens',()=>{
  assert.deepEqual(search('METASTASIS').map(entry=>entry.id),search('metastasis').map(entry=>entry.id));
  const singular=new Set(search('disease').filter(e=>e.category==='Slides').map(e=>e.id));
  const plural=new Set(search('diseases').filter(e=>e.category==='Slides').map(e=>e.id));
  assert.deepEqual(singular,plural);
  assert.equal(normalize('counter-\nfactual'),'counterfactual');
  assert.deepEqual(search('risk‐stratification').map(e=>e.id),search('risk stratification').map(e=>e.id));
});
test('acronyms do not match substrings and all matched terms outrank partial matches',()=>{
  const slides=search('ATE').filter(entry=>entry.category==='Slides');
  assert.ok(slides.length);
  assert.ok(slides.every(entry=>containsTerm(entry.rawText,'ate')));
  assert.equal(search('qxzvbnmunknownword').length,0);
  assert.deepEqual(search('!!!'),[]);
  const first=search('potential outcomes framework')[0];
  for(const word of ['potential','outcomes','framework'])assert.ok(containsTerm(first.rawText,word));
});
test('index is the default; searches, filters, page links and mode survive reloads',()=>{
  assert.equal(readState('').mode,'index');
  assert.equal(readState('?q=recall').mode,'search');
  for(const mode of ['search','index']){
    const state={...readState('?q=recall&lecture=4&page=33&filters=4,6'),mode};
    assert.deepEqual(readState(stateUrl(state).split('?')[1]),state);
  }
});
