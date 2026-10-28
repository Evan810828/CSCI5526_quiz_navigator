export function readState(search='') {
  const p=new URLSearchParams(search);
  const number=k=>{const v=Number(p.get(k));return Number.isSafeInteger(v)&&v>0?v:undefined;};
  const legacyCategories={quick:'Quick Lookup',questions:'Quiz Questions',formulas:'Formulas',comparisons:'Comparisons',cases:'Clinical Cases',lectures:'Lecture Topics'};
  const mode=p.get('mode')==='index'||!p.size?'index':'search';
  return {q:p.get('q')||'',mode,category:p.get('category')||legacyCategories[p.get('mode')]||'All',sort:p.get('sort')||'relevance',filters:(p.get('filters')||'').split(',').map(Number).filter(n=>Number.isSafeInteger(n)&&n>0),lecture:number('lecture'),page:number('page'),file:p.get('file')||undefined,start:number('start'),end:number('end'),entry:p.get('entry')||undefined};
}
export function stateUrl(state) {
  const p=new URLSearchParams();
  for(const key of ['q','lecture','page','file','start','end','entry'])if(state[key])p.set(key,String(state[key]));
  p.set('mode',state.mode);
  if(state.category!=='All')p.set('category',state.category);
  if(state.sort!=='relevance')p.set('sort',state.sort);
  if(state.filters.length)p.set('filters',state.filters.join(','));
  return '/'+(p.size?'?'+p.toString():'');
}
export function resolvePdf(reference,lectures) {
  const lecture=lectures.find(l=>l.lectureNumber===reference.lectureNumber);
  if(!lecture)return {error:`Unknown lecture ${reference.lectureNumber}. Requested: ${reference.pdfFilename}`};
  if(lecture.pdfFilename!==reference.pdfFilename)return {error:`Source unavailable: ${reference.pdfFilename}. It does not match the lecture catalog.`};
  if(!lecture.available)return {error:`Source unavailable: ${reference.pdfFilename}. Place the original file in public/pdfs and rebuild.`};
  return {url:'/pdfs/'+encodeURIComponent(reference.pdfFilename),lecture};
}
