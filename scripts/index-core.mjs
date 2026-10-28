import { createHash } from 'node:crypto';
import { parseReferences } from './reference-parser.mjs';
const categories = { 2: 'Concepts', 3: 'Quiz Questions', 4: 'Lecture Topics', 5: 'Formulas', 6: 'Comparisons', 7: 'Clinical Cases', 8: 'Quick Lookup' };
export function buildIndex(rows, lectures, sourceFilename, source) {
  const entries = [], issues = [], metadataRows = [];
  for (const row of rows) {
    if (row.part < 2) { metadataRows.push(row); continue; }
    const category = categories[row.part] || 'Other';
    const cells = row.cells;
    const titleIndex = row.part === 4 ? 1 : 0;
    const title = cells[titleIndex]?.text.trim() || `Unparsed row at line ${row.sourceLine}`;
    const parsed = parseReferences(cells.flatMap(c => c.segments), { sourceLine: row.sourceLine, title }, lectures);
    issues.push(...parsed.issues);
    if (!parsed.references.length) issues.push({ kind: 'row-without-reference', sourceLine: row.sourceLine, title, detail: 'Row retained; view original source text.' });
    const clueIndices = row.part === 2 || row.part === 3 ? [1] : row.part === 4 ? [3] : [0,1];
    const keywords = [...new Set(clueIndices.flatMap(i => (cells[i]?.text || '').split(/[;；\n]/)).map(k => k.trim()).filter(Boolean))];
    const explanationIndices = row.part === 6 ? [1,2,3,4] : row.part === 5 ? [1,2] : row.part === 8 ? [1] : [2];
    const explanation = explanationIndices.map(i => cells[i]?.markdown || '').filter(Boolean).join('\n\n');
    const id = createHash('sha256').update(`${row.sourceSection}|${row.sourceContext}|${row.rawMarkdown}`).digest('hex').slice(0,16);
    entries.push({ id, title, keywords, explanation, category, references: parsed.references, sourceSection: row.sourceSection, sourceContext: row.sourceContext, sourceLine: row.sourceLine, rawText: cells.map(c => c.text).join(' • '), rawMarkdown: row.rawMarkdown, cells: cells.map(({ heading,markdown,text }) => ({ heading,markdown,text })), lectureTitles: [...new Set(parsed.references.map(r => lectures.find(l => l.lectureNumber === r.lectureNumber)?.title || ''))].join(' ') });
  }
  const ids = new Set();
  for (const e of entries) { if (ids.has(e.id)) { issues.push({ kind:'duplicate-row', sourceLine:e.sourceLine, title:e.title }); e.id += `-${e.sourceLine}`; } ids.add(e.id); }
  const warnings = issues.filter(i => ['link-range-mismatch','row-without-reference'].includes(i.kind)).length;
  const summary = { tableRows: rows.length, searchRows: entries.length, validReferences: entries.reduce((s,e)=>s+e.references.length,0), warnings, errors: issues.length-warnings };
  return { data: { entries, lectures, sourceFilename, sourceHash: createHash('sha256').update(source).digest('hex'), report:summary }, report: { ...summary, issues, metadataRows, categoryCounts: Object.fromEntries(Object.values(categories).map(c => [c,entries.filter(e => e.category === c).length])) } };
}
