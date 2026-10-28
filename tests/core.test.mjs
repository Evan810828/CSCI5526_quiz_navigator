import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseMarkdown } from '../scripts/markdown-parser.mjs';
import { buildIndex } from '../scripts/index-core.mjs';
import { parseReferences } from '../scripts/reference-parser.mjs';
import { readState,stateUrl,resolvePdf } from '../src/lib/navigation.mjs';
import { containsTerm,rankingTier,queryTerms } from '../src/lib/search-core.mjs';
import { createSearchEngine } from '../src/lib/search-engine.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../src/generated/knowledge.json',import.meta.url),'utf8'));
const lectures=data.lectures;
test('all source rows and exact English/Chinese/math text survive preprocessing',()=>{
  const source=fs.readFileSync(new URL('../data/CSCI5526_Open_Book_Master_Index.md',import.meta.url),'utf8');
  const rows=parseMarkdown(source);const result=buildIndex(rows,lectures,data.sourceFilename,source);
  assert.equal(rows.length,1046);assert.equal(result.data.entries.length,1001);
  assert.deepEqual(result.report.categoryCounts,{'Concepts':520,'Quiz Questions':97,'Lecture Topics':164,'Formulas':59,'Comparisons':60,'Clinical Cases':69,'Quick Lookup':32});
  assert.equal(result.report.issues.length,0);
  const sourceLines=source.split(/\r?\n/);
  for(const entry of result.data.entries)assert.equal(entry.rawMarkdown,sourceLines[entry.sourceLine-1]);
  const specificity=result.data.entries.find(e=>e.category==='Formulas'&&e.title==='Specificity / TNR');
  assert.ok(specificity.explanation.includes('\\frac{TN}{TN+FP}'));
  assert.ok(specificity.explanation.includes('实际阴性'));
});
test('visible discontiguous ranges outrank fragment; multi-lecture references survive',()=>{
  const segments=[{type:'text',text:'Lec 4 | Slides 25–28, 33 | '},{type:'link',url:'lec_4_classification.pdf#page=25',text:'lec_4_classification.pdf'},{type:'text',text:'\nLec 6 | Slide 4 | '},{type:'link',url:'lec_6_unsupervised_learning_II.pdf#page=4',text:'PDF'}];
  const result=parseReferences(segments,{},lectures);
  assert.equal(result.issues.length,0);assert.equal(result.references.length,3);
  assert.deepEqual(result.references.map(r=>[r.lectureNumber,r.startPage,r.endPage]),[[4,25,28],[4,33,undefined],[6,4,undefined]]);
});
test('mismatched link reports inconsistency and keeps visible range',()=>{
  const r=parseReferences([{type:'text',text:'Lec 4 | Slide 25–28 | '},{type:'link',url:'lec_4_classification.pdf#page=33'}],{},lectures);
  assert.equal(r.references[0].startPage,25);assert.equal(r.issues[0].kind,'link-range-mismatch');
});
test('bad bounds and filenames never silently map to a different original PDF',()=>{
  const r=parseReferences([{type:'text',text:'Lec 4 | Slide 500 | '},{type:'link',url:'lec_4_classification.pdf#page=500'}],{},lectures);
  assert.equal(r.references.length,0);assert.equal(r.issues[0].kind,'out-of-bounds');
  assert.match(resolvePdf({lectureNumber:4,pdfFilename:'wrong.pdf',startPage:33},lectures).error,/wrong.pdf/);
  assert.match(resolvePdf({lectureNumber:4,pdfFilename:lectures.find(l=>l.lectureNumber===4).pdfFilename,startPage:33},lectures.map(l=>({...l,available:false}))).error,/unavailable/);
});
test('reference-free or malformed rows are retained and reported',()=>{
  const source='## Part 2: Test\n\n| Concept | Clue | Meaning | Location |\n| --- | --- | --- | --- |\n| 未知 | test | $x^2$ | ??? |\n';
  const result=buildIndex(parseMarkdown(source),lectures,'fixture.md',source);
  assert.equal(result.data.entries.length,1);assert.equal(result.report.issues[0].kind,'row-without-reference');
});
test('deep-link state round-trips Chinese query, range, filters and exact filename',()=>{
  const state={...readState('?q=recall&lecture=4&page=33'),q:'灵敏度 recall',filters:[4,6],start:33,end:36,file:'lec_4_classification.pdf',category:'Formulas'};
  assert.deepEqual(readState(stateUrl(state).split('?')[1]),state);
  assert.equal(readState('?page=-1').page,undefined);
});
test('abbreviation matching does not confuse ATE with rate',()=>{
  assert.equal(containsTerm('false positive rate','ate'),false);
  assert.equal(containsTerm('ATE=E[Y1−Y0]','ate'),true);
  const ate=data.entries.find(e=>e.category==='Concepts'&&e.title==='ATE');
  assert.equal(rankingTier(ate,'ATE'),0);
  assert.deepEqual(queryTerms('Why is 99% accuracy still bad?'),['99%','accuracy','bad']);
});
test('originals exist, page ranges are in bounds, and URLs stay relative',()=>{
  assert.equal(lectures.reduce((s,l)=>s+l.pageCount,0),402);
  for(const e of data.entries)for(const r of e.references){const l=lectures.find(l=>l.lectureNumber===r.lectureNumber);assert.equal(r.pdfFilename,l.pdfFilename);assert.ok(r.startPage>=1&&(r.endPage||r.startPage)<=l.pageCount);assert.ok(fs.existsSync(new URL('../public/pdfs/'+r.pdfFilename,import.meta.url)));assert.ok(resolvePdf(r,lectures).url.startsWith('/pdfs/'));}
});
test('lexical ranking retrieves exam examples and source-derived neighboring concepts',()=>{
  // This test isolates deterministic lexical ranking. Real Fuse integration is a browser test.
  class NoFuzzy { search(){return [];} }
  const search=createSearchEngine(data.entries,NoFuzzy);
  assert.equal(search('overfitting')[0].title,'Overfitting');
  assert.ok(search('overfitting').some(e=>e.title==='Generalization'));
  assert.ok(search('overfitting').some(e=>e.title==='Bias-variance tradeoff'));
  assert.equal(search('ATE')[0].title,'ATE');
  assert.ok(search('ATE').some(e=>e.title==='CATE'));
  assert.ok(search('ATE').some(e=>e.title==='Parametric g-formula'));
  for(const title of ['Recall','Sensitivity','Confusion matrix','Clinical error costs'])assert.ok(search('false negative').some(e=>e.title===title),title);
  const question=search('Why is a classifier with 99% accuracy still bad?').slice(0,8);
  assert.ok(question.some(e=>e.references.some(r=>r.lectureNumber===4&&r.startPage===38&&r.endPage===40)));
  assert.ok(search('99% accuracy').some(e=>e.title==='Confusion matrix'));
});
