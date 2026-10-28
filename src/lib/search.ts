import Fuse from 'fuse.js';
import type { SearchEntry } from '../types';
import { createSearchEngine } from './search-engine.mjs';
export function createSearch(entries:SearchEntry[]):(query:string)=>SearchEntry[] { return createSearchEngine(entries,Fuse); }
