import { readFile, writeFile, mkdir, readdir, copyFile, cp, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { parseMarkdown } from './markdown-parser.mjs';
import { buildIndex } from './index-core.mjs';
import { indexSlides } from './slide-index.mjs';
import { translateNotes } from './english-notes.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sourceName='CSCI5526_Open_Book_Master_Index.md';
const source=await readFile(path.join(root,'data',sourceName),'utf8');
const rows=parseMarkdown(source);
const dashboard=rows.filter(r=>r.part===1&&r.cells[0]?.text.match(/^Lec \d+$/)&&r.cells[3]?.text.includes('slides'));
const filenames=await readdir(path.join(root,'public/pdfs'));
const require=createRequire(import.meta.url);
// Optional installed-cache path is for offline data validation only, never shipped in viewer URLs.
const pdfRoot=process.env.NAVIGATOR_PDFJS_ROOT||path.dirname(require.resolve('pdfjs-dist/package.json'));
const {getDocument}=await import(pathToFileURL(path.join(pdfRoot,'legacy/build/pdf.mjs')).href);
const lectures=[];
const slideEntries=[], slideCoverage=[];
for(const row of dashboard) {
  const lectureNumber=Number(row.cells[0].text.match(/\d+/)[0]);
  // Filename comes from source coverage table, not a guessed title slug.
  const coverage=rows.find(r=>r.part===1&&r.cells[0]?.text===`Lec ${lectureNumber}`&&r.cells[1]?.segments.some(s=>s.type==='link'&&/\.pdf$/.test(s.url)));
  const pdfFilename=coverage?.cells[1].segments.find(s=>s.type==='link')?.text;
  if(!pdfFilename) throw Error(`Missing source filename for lecture ${lectureNumber}`);
  const pageCount=Number(row.cells[3].text.match(/(\d+) slides/)[1]);
  const available=filenames.includes(pdfFilename);
  let sha256;
  if(available) {
    const bytes=await readFile(path.join(root,'public/pdfs',pdfFilename));
    sha256=createHash('sha256').update(bytes).digest('hex');
    const doc=await getDocument({data:new Uint8Array(bytes),useSystemFonts:true,isEvalSupported:false}).promise;
    if(doc.numPages!==pageCount) throw Error(`${pdfFilename}: source says ${pageCount}, PDF has ${doc.numPages}`);
    try {
      const indexed=await indexSlides(doc,{lectureNumber,title:row.cells[1].text,pdfFilename});
      slideEntries.push(...indexed.entries);
      slideCoverage.push({pdfFilename,pages:doc.numPages,textPages:indexed.entries.filter(e=>e.rawText.trim()).length,lowTextPages:indexed.lowTextPages});
    } finally { await doc.destroy(); }
  }
  lectures.push({lectureNumber,title:row.cells[1].text,pdfFilename,pageCount,available,sha256});
}
if(!lectures.length) throw Error('No lectures parsed; refusing empty build');
const result=buildIndex(rows,lectures,sourceName,source);
const englishNotes=JSON.parse(await readFile(path.join(root,'data/english-notes.json'),'utf8'));
translateNotes(result.data.entries,englishNotes);
result.report.englishNotes=result.data.entries.length;
// Refuse to silently omit a newly added PDF from search.
const unlisted=filenames.filter(name=>/\.pdf$/i.test(name)&&!lectures.some(l=>l.pdfFilename===name));
if(unlisted.length)throw Error(`PDFs missing from the Markdown lecture catalog: ${unlisted.join(', ')}. Add their lecture rows before rebuilding.`);
result.data.slideEntries=slideEntries;
result.data.report.slidePages=slideEntries.length;
result.data.report.textPages=slideEntries.filter(e=>e.rawText.trim()).length;
result.report.slidePages=result.data.report.slidePages;
result.report.textPages=result.data.report.textPages;
result.report.slideCoverage=slideCoverage;
result.report.searchLimitations=['PDF text layers are indexed in full. Text embedded only in images and some formula glyphs require OCR; short text pages are listed in slideCoverage.lowTextPages for review.'];
for(const lecture of lectures) if(!lecture.available) result.report.issues.push({kind:'missing-pdf',filename:lecture.pdfFilename,detail:'Source remains indexed; viewer shows unavailable.'});
result.data.report.errors=result.report.errors+=lectures.filter(l=>!l.available).length;
await mkdir(path.join(root,'src/generated'),{recursive:true});
await mkdir(path.join(root,'public/data'),{recursive:true});
await writeFile(path.join(root,'src/generated/knowledge.json'),JSON.stringify(result.data));
await writeFile(path.join(root,'public/data/validation-report.json'),JSON.stringify(result.report,null,2));
await copyFile(path.join(root,'data',sourceName),path.join(root,'public/data',sourceName));
// Bundle worker through Vite, and keep auxiliary PDF.js assets local too.
for(const name of ['cmaps','standard_fonts','wasm']) {
  try { await access(path.join(pdfRoot,name)); await cp(path.join(pdfRoot,name),path.join(root,'public/pdfjs',name),{recursive:true}); }
  catch(error) { throw Error(`Cannot prepare local PDF.js ${name}: ${error}`); }
}
console.log(JSON.stringify({ ...result.data.report, lectures:lectures.length, categoryCounts:result.report.categoryCounts },null,2));
if(result.report.issues.some(i=>['out-of-bounds','filename-mismatch','invalid-range','unparsed-reference','invalid-url'].includes(i.kind))) process.exitCode=1;
