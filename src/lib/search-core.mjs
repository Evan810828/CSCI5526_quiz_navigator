export function normalize(value='') { return value.normalize('NFKC').toLowerCase().replace(/[\u00ad\u200b]/g,'').replace(/([a-z])-\s*\n\s*([a-z])/g,'$1$2').replace(/[‐‑‒–—−-]/g,' ').replace(/\s+/g,' ').trim(); }
const stop=new Set('a an the is are was were why how what which when can could should would does do did of for to in on with and or still it this that be at if from as than then so my'.split(' '));
export function textTerms(text) { return normalize(text).match(/[a-z]+\d*[a-z]*|\d+(?:\.\d+)?%?|[\p{Script=Han}]+/gu)||[]; }
export function queryTerms(query) { return [...new Set(textTerms(query).filter(t=>!stop.has(t)))]; }
export function stem(term) {
  if(!/^[a-z]{5,}$/.test(term))return term;
  if(term.endsWith('ies'))return term.slice(0,-3)+'y';
  if(/(?:ches|shes|xes|zes|sses)$/.test(term))return term.slice(0,-2);
  if(term.endsWith('s')&&!/(ss|us|is)$/.test(term))return term.slice(0,-1);
  return term;
}
export function searchExcerpt(text,query,limit=260) {
  const compact=text.replace(/\s+/g,' ').trim();
  if(compact.length<=limit)return compact;
  const terms=queryTerms(query).sort((a,b)=>b.length-a.length);
  const positions=terms.map(t=>compact.toLowerCase().indexOf(t)).filter(n=>n>=0);
  let start=positions.length?Math.max(0,positions[0]-70):0;
  if(start) { const boundary=compact.indexOf(' ',start); if(boundary>=0&&boundary<start+20)start=boundary+1; }
  return (start?'…':'')+compact.slice(start,start+limit).trim()+(start+limit<compact.length?'…':'');
}
export function containsTerm(text,term) {
  const value=normalize(text);
  if(/[\p{Script=Han}]/u.test(term))return value.includes(term);
  const escaped=term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`,'i').test(value);
}
export function rankingTier(entry,query) {
  const q=normalize(query), title=normalize(entry.title), aliases=entry.keywords.map(normalize);
  if(title===q)return 0;
  if(aliases.some(k=>k===q))return 1;
  if(/^[a-z]{2,6}$/i.test(query.trim())&&entry.keywords.some(k=>k.split(/[; /,]/).some(a=>a.toUpperCase()===query.trim().toUpperCase())))return 1;
  if(containsTerm(title,q))return 2;
  if(aliases.some(k=>containsTerm(k,q)))return 3;
  if(entry.category==='Quiz Questions'&&queryTerms(q).some(t=>containsTerm(title,t)))return 4;
  if(containsTerm(entry.explanation,q))return 5;
  return 6;
}
export function referenceLabel(ref) { return `Lec ${ref.lectureNumber} · ${ref.endPage ? `Slides ${ref.startPage}–${ref.endPage}` : `Slide ${ref.startPage}`}`; }
export function copyReference(ref) { return `Lec ${ref.lectureNumber} | Slide ${ref.startPage}${ref.endPage ? `–${ref.endPage}`:''} | ${ref.pdfFilename}`; }
