import { createHash } from 'node:crypto';

export function noteKey(text) { return createHash('sha256').update(text).digest('hex'); }
export function noteTemplate(text) {
  const math=[];
  const template=text.replace(/\$\$[\s\S]*?\$\$|\$(?:\\.|[^$])+\$/g,expression=>/\p{Script=Han}/u.test(expression)||/^\$\d+(?:\.\d+)?[BMK]\b/.test(expression)?expression:`@@M${math.push(expression)-1}@@`);
  return {template,math};
}
export function translateNotes(entries, translations) {
  for(const entry of entries) {
    if(!/\p{Script=Han}/u.test(entry.explanation))continue;
    const translated=translations[noteKey(entry.explanation)];
    if(typeof translated!=='string'||!translated.trim())throw Error(`Missing English note: ${entry.title} (${entry.id}). Update data/english-notes.json.`);
    const {math}=noteTemplate(entry.explanation);
    for(let i=0;i<math.length;i++)if(translated.split(`@@M${i}@@`).length!==2)throw Error(`Missing or repeated formula in English note: ${entry.title}, M${i}`);
    entry.explanation=translated.replace(/@@M(\d+)@@/g,(_,index)=>{
      if(!math[Number(index)])throw Error(`Unknown formula placeholder in ${entry.title}`);
      return math[Number(index)];
    });
    if(/\p{Script=Han}/u.test(entry.explanation))throw Error(`Untranslated English note: ${entry.title}`);
  }
}
