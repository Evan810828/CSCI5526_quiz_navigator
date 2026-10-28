import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { ChevronUp, ChevronDown, Maximize, MoveHorizontal, RotateCw, X, ZoomIn, ZoomOut } from 'lucide-react';
import 'react-pdf/dist/Page/TextLayer.css';
import type { Lecture, SlideReference } from '../types';
import { resolvePdf } from '../lib/navigation.mjs';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
const options = { cMapUrl: '/pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: '/pdfjs/standard_fonts/', wasmUrl: '/pdfjs/wasm/', isEvalSupported: false };
interface Props { reference: SlideReference; page: number; lectures: Lecture[]; onPage: (page: number, replace?: boolean) => void; onClose: () => void }
type Size = { width: number; height: number };
function Loading() { return <div className="pdf-message" role="status">Loading lecture…</div>; }

function ContinuousPages({ url, page, zoom, fit, onPage }: { url: string; page: number; zoom: number; fit: 'width' | 'page'; onPage: Props['onPage'] }) {
  const [document, setDocument] = useState<PDFDocumentProxy>();
  const [sizes, setSizes] = useState<Size[]>([]), [error, setError] = useState('');
  const [bounds, setBounds] = useState<Size>({ width: 900, height: 600 });
  const [nearby, setNearby] = useState<number[]>([]);
  const scroll = useRef<HTMLDivElement>(null), frame = useRef(0);
  const lastReported = useRef<number | undefined>(undefined), layout = useRef('');
  const anchor = useRef({ page, fraction: 0 });
  const onPageRef = useRef(onPage); onPageRef.current = onPage;
  useEffect(() => {
    const element = scroll.current; if (!element) return;
    const observer = new ResizeObserver(() => setBounds({ width: element.clientWidth, height: element.clientHeight }));
    observer.observe(element); return () => { observer.disconnect(); cancelAnimationFrame(frame.current); };
  }, []);
  useEffect(() => {
    if (!document) return;
    let alive = true;
    // Reserve exact page heights before jumping, so later renders cannot move the target.
    Promise.all(Array.from({ length: document.numPages }, async (_, index) => {
      const original = await document.getPage(index + 1);
      const viewport = original.getViewport({ scale: 1 });
      return { width: viewport.width, height: viewport.height };
    })).then(result => { if (alive) setSizes(result); }).catch(reason => { if (alive) setError(String(reason)); });
    return () => { alive = false; };
  }, [document]);
  const rows = useMemo(() => {
    let top = 0;
    return sizes.map((size, index) => {
      const width = Math.max(180, (fit === 'width' ? bounds.width - 32 : Math.min(bounds.width - 32, (bounds.height - 32) * size.width / size.height)) * zoom);
      const height = width * size.height / size.width;
      const row = { page: index + 1, width, height, top };
      top += height + 20;
      return row;
    });
  }, [sizes, bounds, fit, zoom]);
  const refreshViewport = useCallback(() => {
    const element = scroll.current;
    if (!element || !rows.length || page > rows.length) return;
    const top = element.scrollTop;
    const viewHeight = element.clientHeight;
    const near = rows.filter(row => row.top + row.height >= top - viewHeight && row.top <= top + viewHeight * 2).map(row => row.page);
    setNearby(previous => previous.join(',') === near.join(',') ? previous : near);
    const readingLine = top + Math.min(120, viewHeight * .3);
    const atEnd = top > 0 && element.scrollHeight - element.clientHeight - top < 2;
    const active = atEnd ? rows[rows.length - 1] : rows.find(row => row.top + row.height > readingLine) || rows[rows.length - 1];
    anchor.current = { page: active.page, fraction: Math.max(0, (top - active.top) / active.height) };
    if (lastReported.current !== active.page) {
      lastReported.current = active.page;
      onPageRef.current(active.page, true);
    }
  }, [rows, page]);
  useLayoutEffect(() => {
    const element = scroll.current;
    if (!element || !rows.length || page > rows.length) return;
    const nextLayout = `${bounds.width}:${bounds.height}:${zoom}:${fit}:${sizes.length}`;
    const changedLayout = layout.current !== nextLayout;
    const fromScroll = lastReported.current === page;
    if (!fromScroll || changedLayout) {
      const position = changedLayout && fromScroll ? anchor.current : { page, fraction: 0 };
      const row = rows[position.page - 1];
      lastReported.current = position.page;
      element.scrollTop = row.top + row.height * position.fraction;
    }
    layout.current = nextLayout;
    refreshViewport();
  }, [page, rows, bounds, zoom, fit, sizes.length, refreshViewport]);
  const handleScroll = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(refreshViewport);
  };
  return <div className="pdf-scroll" ref={scroll} data-testid="pdf-scroll" role="region" aria-label="Lecture pages" tabIndex={0} onScroll={handleScroll}>
    <Document file={url} options={options} onLoadSuccess={setDocument} onLoadError={reason => setError(reason.message)} loading={<Loading />}
      error={<div role="alert" className="pdf-message">Could not open PDF: {error || decodeURIComponent(url.split('/').pop() || '')}</div>}>
      {error ? <div role="alert" className="pdf-message">Could not read PDF pages: {error}</div> : document && page > document.numPages ? <div className="pdf-message" role="alert">Page is out of range (1–{document.numPages}).</div> : !rows.length ? <Loading /> :
        <div className="pdf-pages">{rows.map(row => <div key={row.page} className="pdf-page-slot" data-pdf-page={row.page} aria-label={`Page ${row.page}`} style={{ width: row.width, height: row.height }}>
          {nearby.includes(row.page) ? <Page pageNumber={row.page} width={row.width} renderTextLayer renderAnnotationLayer={false} loading={<div className="pdf-placeholder">Page {row.page}</div>} error={<div className="pdf-placeholder" role="alert">Could not render page {row.page}.</div>} /> : <div className="pdf-placeholder" aria-hidden="true">Page {row.page}</div>}
        </div>)}</div>}
    </Document>
  </div>;
}

export default function PdfViewer({ reference, page, lectures, onPage, onClose }: Props) {
  const [zoom, setZoom] = useState(1), [fit, setFit] = useState<'width' | 'page'>('width');
  const [draft, setDraft] = useState(String(page)), [retry, setRetry] = useState(0);
  const resolved = resolvePdf(reference, lectures);
  const count = resolved.lecture?.pageCount || 0;
  useEffect(() => setDraft(String(page)), [page, reference.pdfFilename]);
  const rangeEnd = reference.endPage || reference.startPage;
  const hasRange = !!reference.endPage && rangeEnd >= reference.startPage && rangeEnd <= count;
  const jump = () => {
    const next = Number(draft);
    if (Number.isInteger(next) && next >= 1 && next <= count) { if (next !== page) onPage(next); }
    else setDraft(String(page));
  };
  return <section className="pdf-panel" aria-label="Original PDF viewer" tabIndex={0} onKeyDown={event => {
    if ((event.target as HTMLElement).closest('input,button,select')) return;
    if (event.key === 'ArrowLeft' && page > 1) { event.preventDefault(); onPage(page - 1); }
    if (event.key === 'ArrowRight' && page < count) { event.preventDefault(); onPage(page + 1); }
  }}>
    <header className="document-heading"><h2>Lec {reference.lectureNumber} · {resolved.lecture?.title || 'Source unavailable'}</h2><button aria-label="Close PDF" title="Close PDF" onClick={onClose}><X size={22} /></button></header>
    <div className="pdf-toolbar">
      <div className="toolbar-group"><button aria-label="Previous page" title="Previous page" disabled={page <= 1 || !!resolved.error} onClick={() => onPage(page - 1)}><ChevronUp size={20} /></button>
        <form onSubmit={event => { event.preventDefault(); jump(); }}><input aria-label="PDF page number" inputMode="numeric" value={draft} onChange={event => setDraft(event.target.value)} onBlur={jump} /><span>/ {count || '—'}</span></form>
        <button aria-label="Next page" title="Next page" disabled={page >= count || !!resolved.error} onClick={() => onPage(page + 1)}><ChevronDown size={20} /></button></div>
      <div className="toolbar-group"><button aria-label="Zoom out" title="Zoom out" onClick={() => setZoom(value => Math.max(.4, Number((value - .2).toFixed(2))))}><ZoomOut size={18} /></button><span className="zoom-value">{Math.round(zoom * 100)}%</span><button aria-label="Zoom in" title="Zoom in" onClick={() => setZoom(value => Math.min(3, Number((value + .2).toFixed(2))))}><ZoomIn size={18} /></button></div>
      <div className="toolbar-group"><button aria-label="Fit Width" title="Fit width" aria-pressed={fit === 'width' && zoom === 1} onClick={() => { setFit('width'); setZoom(1); }}><MoveHorizontal size={18} /></button><button aria-label="Fit Page" title="Fit page" aria-pressed={fit === 'page' && zoom === 1} onClick={() => { setFit('page'); setZoom(1); }}><Maximize size={18} /></button><button aria-label="Reload original PDF" title="Reload PDF" onClick={() => setRetry(value => value + 1)}><RotateCw size={17} /></button></div>
    </div>
    {hasRange && <div className="range-strip" role="group" aria-label="Referenced pages">{Array.from({ length: rangeEnd - reference.startPage + 1 }, (_, index) => reference.startPage + index).map(number => <button key={number} aria-label={`Range page ${number}`} aria-current={number === page ? 'page' : undefined} onClick={() => onPage(number)}>{number}</button>)}</div>}
    {resolved.error ? <div className="pdf-message" role="alert">{resolved.error}</div> : <ContinuousPages key={`${resolved.url}-${retry}`} url={resolved.url!} page={page} zoom={zoom} fit={fit} onPage={onPage} />}
  </section>;
}
