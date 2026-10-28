import { normalize, queryTerms, textTerms, containsTerm, stem } from './search-core.mjs';

export function createSearchEngine(entries, Fuse) {
  const vocabulary=new Set(), documentFrequency=new Map(), stemWords=new Map();
  const documents=entries.map(entry=>{
    const title=normalize(entry.title), aliases=entry.keywords.map(normalize);
    // Always search the complete page text, independently of curated keywords.
    const body=normalize(entry.rawText+' '+entry.explanation);
    const fields=[new Set(textTerms(title)),new Set(textTerms(aliases.join(' '))),new Set(textTerms(body))];
    const words=new Set(fields.flatMap(field=>[...field]));
    for(const word of words){vocabulary.add(word);documentFrequency.set(word,(documentFrequency.get(word)||0)+1);}
    return {entry,title,aliases,body,fields,words};
  });
  for(const word of vocabulary){const key=stem(word);if(!stemWords.has(key))stemWords.set(key,new Set());stemWords.get(key).add(word);}
  const fuzzy=new Fuse([...vocabulary].filter(word=>/^[a-z]{4,}$/.test(word)),{includeScore:true,threshold:.28,ignoreLocation:true,minMatchCharLength:3});
  const related=new Map();
  for(const entry of entries.filter(e=>e.category==='Lecture Topics')){
    const words=entry.keywords.flatMap(k=>k.split(/[;；]/)).map(normalize);
    for(const word of words){const set=related.get(word)||new Set();words.forEach(w=>set.add(w));related.set(word,set);}
  }
  return query=>{
    if(!query.trim())return entries;
    const q=normalize(query), meaningful=queryTerms(query);
    const terms=meaningful.length?meaningful:[...new Set(textTerms(query))];
    if(!terms.length)return [];
    const variants=terms.map(term=>{
      const words=new Set([term,...(stemWords.get(stem(term))||[])]);
      // Short acronyms and correctly spelled words retain exact boundaries.
      if(!vocabulary.has(term)&&/^[a-z]{4,}$/.test(term)){
        for(const result of fuzzy.search(term,{limit:4}))if(Math.abs(result.item.length-term.length)<=2)words.add(result.item);
      }
      return [...words];
    });
    const neighbors=new Set(related.get(q)||[]);
    for(const term of terms)for(const word of related.get(term)||[])neighbors.add(word);
    const concepts=entries.filter(e=>e.category==='Concepts');
    const seeds=concepts.filter(e=>normalize(e.title)===q||terms.includes(normalize(e.title)));
    for(const candidate of concepts){
      if(seeds.some(seed=>seed.references.some(a=>candidate.references.some(b=>a.lectureNumber===b.lectureNumber&&a.startPage<=(b.endPage||b.startPage)+1&&b.startPage<=(a.endPage||a.startPage)+1))))neighbors.add(normalize(candidate.title));
    }
    const ranked=[];
    for(const doc of documents){
      let hits=0,exactHits=0,score=0;
      for(let i=0;i<terms.length;i++){
        const han=/\p{Script=Han}/u.test(terms[i]);
        const exact=han?`${doc.title} ${doc.aliases.join(' ')} ${doc.body}`.includes(terms[i]):doc.words.has(terms[i]);
        const matched=variants[i].filter(word=>doc.words.has(word));
        if(!exact&&!matched.length)continue;
        hits++;if(exact)exactHits++;
        const matches=exact?[terms[i]]:matched;
        const idf=Math.log(1+entries.length/(documentFrequency.get(matches[0])||1));
        const weight=doc.fields[0].has(matches[0])?6:doc.fields[1].has(matches[0])?4:1;
        score+=idf*weight*(exact?1:.7);
      }
      const neighbor=doc.entry.category!=='Slides'&&neighbors.has(doc.title);
      if(!hits&&!neighbor)continue;
      const exactTitle=doc.title===q,exactAlias=doc.aliases.includes(q);
      const phrase=containsTerm(doc.title,q)||containsTerm(doc.body,q);
      const all=hits===terms.length;
      const tier=exactTitle?0:exactAlias?1:all&&exactHits===terms.length?2:all?3:hits?4:5;
      ranked.push({entry:doc.entry,tier,hits,score:score+(phrase?5:0)+(neighbor?1:0)});
    }
    return ranked.sort((a,b)=>a.tier-b.tier||b.hits-a.hits||b.score-a.score||Number(a.entry.category==='Slides')-Number(b.entry.category==='Slides')||a.entry.id.localeCompare(b.entry.id)).map(result=>result.entry);
  };
}
