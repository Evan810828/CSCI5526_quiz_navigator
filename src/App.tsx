import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import dataJson from './generated/knowledge.json';
import type { KnowledgeBase, SearchEntry, SlideReference, ViewState } from './types';
import { createSearch } from './lib/search';
import { readState, stateUrl } from './lib/navigation.mjs';
import { referenceLabel, searchExcerpt } from './lib/search-core.mjs';
import RichText, { Highlight } from './components/RichText';

const PdfViewer = lazy(() => import('./components/PdfViewer'));
const data = dataJson as KnowledgeBase;
const allEntries = [...data.entries, ...data.slideEntries];
const searchIndex = createSearch(allEntries);
const sections = [
  ['Concepts', 'Concepts'], ['Quiz Questions', 'Questions'], ['Lecture Topics', 'Lecture Topics'],
  ['Formulas', 'Formulas'], ['Comparisons', 'Comparisons'], ['Clinical Cases', 'Clinical Cases'], ['Quick Lookup', 'Quick Lookup'],
];
const categoryLabel = Object.fromEntries([...sections, ['Slides', 'Slide text']]);
const closedReader = { lecture: undefined, page: undefined, file: undefined, start: undefined, end: undefined, entry: undefined };

export default function App() {
  const [state, setState] = useState<ViewState>(() => readState(window.location.search));
  const [visible, setVisible] = useState(40);
  const searchInput = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const deferredQuery = useDeferredValue(state.q);
  const update = useCallback((patch: Partial<ViewState>, replace = false) => {
    setState(old => {
      const next = { ...old, ...patch };
      const url = stateUrl(next);
      if (url !== window.location.pathname + window.location.search) window.history[replace ? 'replaceState' : 'pushState']({}, '', url);
      return next;
    });
  }, []);
  useEffect(() => {
    const restore = () => setState(readState(window.location.search));
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  const selectedEntry = allEntries.find(entry => entry.id === state.entry);
  const selectedLecture = data.lectures.find(lecture => lecture.lectureNumber === state.lecture);
  const reference: SlideReference | undefined = state.lecture ? {
    lectureNumber: state.lecture,
    pdfFilename: state.file || selectedLecture?.pdfFilename || `unknown_lecture_${state.lecture}.pdf`,
    startPage: state.start || state.page || 1,
    ...(state.end ? { endPage: state.end } : {}),
  } : undefined;
  useEffect(() => {
    const element = dialog.current;
    if (reference && element && !element.open) element.showModal();
    else if (!reference && element?.open) element.close();
  }, [!!reference]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        update({ mode: 'search', ...closedReader });
        requestAnimationFrame(() => { searchInput.current?.focus(); searchInput.current?.select(); });
      }
      if (event.key === 'Escape' && !dialog.current?.open && state.mode === 'search') update({ q: '' }, true);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state.mode, update]);
  const results = useMemo(() => {
    if (!deferredQuery.trim()) return [];
    return searchIndex(deferredQuery).filter(entry =>
      (state.category === 'All' || entry.category === state.category) &&
      (!state.filters.length || entry.references.some(ref => state.filters.includes(ref.lectureNumber)))
    );
  }, [deferredQuery, state.category, state.filters]);
  useEffect(() => setVisible(40), [deferredQuery, state.category, state.filters]);
  const referenceState = (ref: SlideReference, entry?: SearchEntry) => ({
    lecture: ref.lectureNumber, file: ref.pdfFilename, page: ref.startPage,
    start: ref.startPage, end: ref.endPage, entry: entry?.id,
  });
  const sourceLink = (ref: SlideReference, entry?: SearchEntry, label?: React.ReactNode) => {
    const patch = referenceState(ref, entry);
    return <a key={`${ref.pdfFilename}-${ref.startPage}-${ref.endPage || ''}`} href={stateUrl({ ...state, ...patch })}
      onClick={event => {
        if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault(); update(patch);
      }}>{label || referenceLabel(ref)}</a>;
  };
  const openFirst = () => {
    const first = searchIndex(state.q).find(entry => (state.category === 'All' || entry.category === state.category) &&
      (!state.filters.length || entry.references.some(ref => state.filters.includes(ref.lectureNumber))));
    const ref = first?.references.find(ref => !state.filters.length || state.filters.includes(ref.lectureNumber));
    if (first && ref) update(referenceState(ref, first));
  };

  return <div className="app-shell">
    <header className="site-header">
      <a className="brand" href="/" onClick={event => { if (!event.metaKey && !event.ctrlKey) { event.preventDefault(); update({ mode: 'index', ...closedReader }); } }}>CSCI 5526</a>
      <nav aria-label="Main navigation">
        {[['index', 'Master Index'], ['search', 'Search']].map(([mode, label]) => <a key={mode}
          href={stateUrl({ ...state, mode, ...closedReader })} aria-current={state.mode === mode ? 'page' : undefined}
          onClick={event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); update({ mode, ...closedReader }); }}>{label}</a>)}
      </nav>
    </header>
    <main className="content">
      {state.mode === 'index' ? <section aria-labelledby="index-title">
        <h1 id="index-title">Master Index</h1>
        <div className="index-links"><a href="#lectures">Lectures</a>{sections.map(([category, label]) => <a key={category} href={`#${category.replaceAll(' ', '-')}`} onClick={() => {
          const group = document.getElementById(category.replaceAll(' ', '-')) as HTMLDetailsElement | null;
          if (group) group.open = true;
        }}>{label}</a>)}</div>
        <section className="lecture-index" id="lectures" aria-labelledby="lectures-title">
          <h2 id="lectures-title">Lectures</h2>
          <ul className="lecture-list">{data.lectures.map(lecture => <li key={lecture.lectureNumber}>
            <div className="lecture-row">{sourceLink({ lectureNumber: lecture.lectureNumber, pdfFilename: lecture.pdfFilename, startPage: 1 }, undefined,
              <><span className="lecture-number">{String(lecture.lectureNumber).padStart(2, '0')}</span>{lecture.title}</>)}<span className="page-count">{lecture.pageCount} pages</span></div>
            <details className="slide-index"><summary>Page index</summary><ol>{data.slideEntries.filter(entry => entry.references[0].lectureNumber === lecture.lectureNumber).map(entry => <li key={entry.id}>{sourceLink(entry.references[0], entry, <><span className="slide-number">{entry.references[0].startPage}</span>{entry.title}</>)}</li>)}</ol></details>
          </li>)}</ul>
        </section>
        {sections.map(([category, label]) => {
          const entries = data.entries.filter(entry => entry.category === category);
          return <details className="index-group" id={category.replaceAll(' ', '-')} key={category}>
            <summary><h2>{label}</h2><span>{entries.length}</span></summary>
            <ul className="entry-index">{entries.map(entry => <li key={entry.id} data-index-entry={entry.id}>
              <div className="index-entry-title">{entry.references[0] ? sourceLink(entry.references[0], entry, entry.title) : <span>{entry.title}</span>}</div>
              <div className="reference-list">{entry.references.map(ref => sourceLink(ref, entry))}</div>
              {!entry.references.length && <RichText text={entry.explanation} />}
            </li>)}</ul>
          </details>;
        })}
      </section> : <section aria-labelledby="search-title">
        <h1 id="search-title">Search</h1>
        <form className="search-box" role="search" onSubmit={event => { event.preventDefault(); if (state.q.trim()) openFirst(); }}>
          <Search size={21} aria-hidden="true" />
          <input ref={searchInput} type="search" aria-label="Search knowledge index" placeholder="Search keywords, abbreviations, or questions" value={state.q} onChange={event => update({ q: event.target.value }, true)} autoComplete="off" />
          {state.q && <button type="button" aria-label="Clear search" onClick={() => { update({ q: '' }, true); searchInput.current?.focus(); }}><X size={19} /></button>}
        </form>
        <div className="search-controls">
          <select aria-label="Content type" value={state.category} onChange={event => update({ category: event.target.value })}>
            <option value="All">All content</option><option value="Slides">Slide text</option>
            {sections.map(([category, label]) => <option key={category} value={category}>{label}</option>)}
          </select>
          <select aria-label="Lecture filter" value={state.filters.length === 1 ? state.filters[0] : state.filters.length > 1 ? 'multiple' : ''} onChange={event => { if (event.target.value !== 'multiple') update({ filters: event.target.value ? [Number(event.target.value)] : [] }); }}>
            <option value="">All lectures</option>{state.filters.length > 1 && <option value="multiple">{state.filters.length} selected</option>}
            {data.lectures.map(lecture => <option key={lecture.lectureNumber} value={lecture.lectureNumber}>Lec {lecture.lectureNumber}</option>)}
          </select>
          <span className="result-count" role="status">{state.q.trim() ? `${results.length} ${results.length === 1 ? 'result' : 'results'}` : ''}</span>
        </div>
        <ul className="search-results" aria-label="Search results" aria-busy={deferredQuery !== state.q}>
          {results.slice(0, visible).map(entry => <li className="search-result" key={entry.id} data-entry-id={entry.id} data-source={entry.category === 'Slides' ? 'slide' : 'index'}>
            <div className="result-heading"><h2>{entry.references.length ? sourceLink(entry.references.find(ref => !state.filters.length || state.filters.includes(ref.lectureNumber)) || entry.references[0], entry, <Highlight text={entry.title} query={deferredQuery} />) : <Highlight text={entry.title} query={deferredQuery} />}</h2><span>{categoryLabel[entry.category] || entry.category}</span></div>
            {entry.category === 'Slides' ? <p className="result-excerpt"><Highlight text={searchExcerpt(entry.rawText, deferredQuery)} query={deferredQuery} /></p> : <RichText text={entry.explanation} query={deferredQuery} />}
            <div className="reference-list">{entry.references.map(ref => sourceLink(ref, entry))}</div>
          </li>)}
        </ul>
        {!!state.q.trim() && !results.length && <p className="empty-results">No matching results{state.filters.length || state.category !== 'All' ? <button onClick={() => update({ filters: [], category: 'All' })}>Search all content</button> : null}</p>}
        {results.length > visible && <button className="load-more" onClick={() => setVisible(count => count + 40)}>Show more</button>}
      </section>}
    </main>
    <dialog className="reader-dialog" ref={dialog} aria-label="Original lecture" onCancel={event => { event.preventDefault(); update(closedReader); }} onClick={event => { if (event.target === event.currentTarget) update(closedReader); }}>
      {reference && <div className="reader-content">
        {selectedEntry && selectedEntry.category !== 'Slides' && <details className="reader-note" open><summary>{selectedEntry.title}</summary><RichText text={selectedEntry.explanation} query={state.q} /></details>}
        <Suspense fallback={<div className="pdf-message" role="status">Opening lecture…<button onClick={() => update(closedReader)}>Close</button></div>}>
          <PdfViewer reference={reference} page={state.page || reference.startPage} lectures={data.lectures} onPage={(page, replace) => update({ page }, replace)} onClose={() => update(closedReader)} />
        </Suspense>
      </div>}
    </dialog>
  </div>;
}
