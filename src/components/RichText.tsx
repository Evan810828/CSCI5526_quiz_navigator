import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { queryTerms } from '../lib/search-core.mjs';
export function Highlight({text,query}:{text:string;query:string}) {
  const terms=queryTerms(query).sort((a:string,b:string)=>b.length-a.length);
  if(!terms.length)return <>{text}</>;
  const pattern=new RegExp(`(${terms.map((t:string)=>{const escaped=t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return /\p{Script=Han}/u.test(t)?escaped:`(?<![a-z0-9])${escaped}(?![a-z0-9])`;}).join('|')})`,'gi');
  return <>{text.split(pattern).map((p,i)=>terms.some((t:string)=>p.toLowerCase()===t.toLowerCase())?<mark key={i}>{p}</mark>:p)}</>;
}
export default function RichText({text,query=''}:{text:string;query?:string}) {
  return <div className="rich-text"><ReactMarkdown remarkPlugins={[remarkGfm,remarkMath]} rehypePlugins={[[rehypeKatex,{throwOnError:false,trust:false}]]} skipHtml components={{
    a:({children})=><span>{children}</span>,
    img:()=> <span>[Figure: view the original PDF]</span>,
    p:({children})=><p>{Array.isArray(children)?children.map((c,i)=>typeof c==='string'?<Highlight key={i} text={c} query={query}/>:c):typeof children==='string'?<Highlight text={children} query={query}/>:children}</p>
  }}>{text.replace(/<br\s*\/?\s*>/gi,'\n\n')}</ReactMarkdown></div>;
}
