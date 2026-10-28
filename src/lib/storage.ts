import { useState } from 'react';
export function useLocalState<T>(key:string,initial:T) {
  const [value,setValue]=useState<T>(()=>{try {const raw=localStorage.getItem(key);if(!raw)return initial;const decoded=JSON.parse(raw);if(Array.isArray(initial))return Array.isArray(decoded)?decoded.filter(x=>x&&typeof x.key==='string'&&typeof x.title==='string'):initial;return typeof decoded===typeof initial?decoded:initial;}catch{return initial;}});
  const [error,setError]=useState(false);
  const update=(next:T|((old:T)=>T))=>setValue(old=>{
    const val=typeof next==='function'?(next as (old:T)=>T)(old):next;
    try{localStorage.setItem(key,JSON.stringify(val));setError(false);}catch{setError(true);}return val;
  });
  return [value,update,error] as const;
}
