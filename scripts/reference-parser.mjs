// Parse individual citation segments after a Markdown parser has identified cells.
// No Markdown-table splitting with a regular expression.
export function parseReferences(segments, context, lectures) {
  const references = [], issues = [];
  let prefix = '';
  for (const segment of segments) {
    if (segment.type !== 'link') { prefix += segment.text || ''; continue; }
    const url = segment.url || '';
    if (!/\.pdf(?:#|$)/i.test(url)) { prefix += segment.text || ''; continue; }
    let filename, linkPage;
    try {
      const parsed = new URL(url, 'http://local.invalid/');
      if (parsed.origin !== 'http://local.invalid') throw Error('External PDF URL is not a local source');
      filename = decodeURIComponent(parsed.pathname.split('/').pop());
      linkPage = Number(new URLSearchParams(parsed.hash.slice(1)).get('page')) || undefined;
    } catch (error) { issues.push({ ...context, kind: 'invalid-url', detail: String(error), url }); prefix = ''; continue; }
    const matches = [...prefix.matchAll(/Lec(?:ture)?\s*(\d+)\s*\|\s*Slides?\s*([\d\s,–—-]+)/gi)];
    const visible = matches.at(-1);
    const lectureNumber = visible ? Number(visible[1]) : Number(filename.match(/^lec[_-](\d+)[_-]/i)?.[1]);
    const lecture = lectures.find(l => l.lectureNumber === lectureNumber);
    let ranges = [];
    if (visible) {
      for (const part of visible[2].trim().split(',')) {
        const range = part.trim().match(/^(\d+)(?:\s*[–—-]\s*(\d+))?$/);
        if (!range) { issues.push({ ...context, kind: 'invalid-range', detail: part }); continue; }
        ranges.push([Number(range[1]), Number(range[2] || range[1])]);
      }
    } else if (linkPage) ranges = [[linkPage, linkPage]];
    if (visible && linkPage && ranges[0]?.[0] !== linkPage) issues.push({ ...context, kind: 'link-range-mismatch', detail: `Visible ${ranges[0]?.[0]} versus link ${linkPage}; visible range retained`, filename });
    if (!ranges.length || !lectureNumber) issues.push({ ...context, kind: 'unparsed-reference', detail: prefix, url });
    for (const [startPage, end] of ranges) {
      if (!Number.isInteger(startPage) || startPage < 1 || end < startPage || (lecture && end > lecture.pageCount)) {
        issues.push({ ...context, kind: 'out-of-bounds', filename, detail: `${startPage}–${end}` }); continue;
      }
      if (lecture && lecture.pdfFilename !== filename) issues.push({ ...context, kind: 'filename-mismatch', filename, detail: `Lecture ${lectureNumber} expects ${lecture.pdfFilename}` });
      if (!lecture) issues.push({ ...context, kind: 'unknown-lecture', filename, detail: String(lectureNumber) });
      // Retain an unavailable filename exactly. Never substitute another PDF.
      references.push({ lectureNumber, pdfFilename: filename, startPage, ...(end > startPage ? { endPage: end } : {}) });
    }
    prefix = '';
  }
  return { references: [...new Map(references.map(r => [JSON.stringify(r), r])).values()], issues };
}
