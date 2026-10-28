import { marked } from 'marked';
function inlineSegments(tokens) {
  return (tokens||[]).flatMap(t=>{
    if(t.type==='link')return [{type:'link',url:t.href,text:plain(t.tokens)||t.text}];
    if(t.type==='html')return [{type:'text',text:/^<br\s*\/?\s*>$/i.test(t.raw)?'\n':''}];
    if(t.tokens)return inlineSegments(t.tokens);
    return [{type:'text',text:t.text??t.raw??''}];
  });
}
const plain=tokens=>inlineSegments(tokens).map(t=>t.text).join('');
export function parseMarkdown(source) {
  source=source.replace(/\r\n?/g,'\n');
  const tokens=marked.lexer(source,{gfm:true}),rows=[];
  let part=0,sourceSection='',sourceContext='',offset=0;
  for(const token of tokens) {
    const index=source.indexOf(token.raw,offset);
    if(index<0)throw Error('Markdown token could not be located in the original source');
    offset=index+token.raw.length;
    if(token.type==='heading') {
      if(token.depth===2){sourceSection=plain(token.tokens);part=Number(sourceSection.match(/^Part\s+(\d+)/i)?.[1]||0);sourceContext='';}
      if(token.depth===3)sourceContext=plain(token.tokens);
    }
    if(token.type!=='table')continue;
    const line=source.slice(0,index).split('\n').length;
    const rawLines=token.raw.split(/\r?\n/);
    const headers=token.header.map(c=>plain(c.tokens));
    token.rows.forEach((cells,i)=>rows.push({part,sourceSection,sourceContext,sourceLine:line+i+2,rawMarkdown:rawLines[i+2],cells:cells.map((c,j)=>({heading:headers[j]||'',markdown:c.text.replace(/<br\s*\/?\s*>/gi,'\n'),text:plain(c.tokens),segments:inlineSegments(c.tokens)}))}));
  }
  return rows;
}
