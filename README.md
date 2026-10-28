# CSCI 5526 · Index & Search

An English-language, local lecture index with two sections:

- **Master Index:** links to all 10 lectures, all 402 pages, and all 1,001 study entries, grouped in expandable lists.
- **Search:** searches both the study notes and complete PDF text layers, with content and lecture filters.

The interface uses lists, links, and simple separators. Knowledge explanations are in English. Clicking a result opens the original PDF in a continuous vertical reader.

## Start

On Windows, double-click `Start-Navigator.cmd` to install dependencies, validate data, build, and open **http://127.0.0.1:4173/**. After the first build, use `Open-Offline.cmd` to start offline. Keep the server window running.

With Node.js 22.13 or newer:

```sh
npm install
npm run build
npm test
npm run preview -- --open
```

Development uses `npm run dev` at http://127.0.0.1:5173/. Vite loads its ESM configuration natively. The site requires a local HTTP server; opening HTML through `file://` is not supported.

## Reading PDFs

Scroll vertically with a mouse wheel, trackpad, touch, or the focused reader's native scrolling keys. Pages appear consecutively, including pages beyond a cited range. The page field and URL follow the current page without adding a browser history entry for every scroll.

The reader retains page-number entry, previous/next controls, reference-range shortcuts, zoom, Fit Width, Fit Page, selectable text, and deep links. It reserves each page's dimensions and renders nearby pages to keep scrolling stable and limit canvas memory use. Zoom and fit changes preserve the current reading position.

## English notes

`data/english-notes.json` supplies English explanations for the original bilingual notes. Entries use a SHA-256 key derived from the original explanation. Shared explanations reuse a translation. Math placeholders such as `@@M0@@` preserve the original formula exactly.

The preparation step validates translations and rejects missing translations, missing or repeated formula placeholders, unknown placeholders, and remaining Chinese text in translated notes. Original Markdown, source rows, entry IDs, and all 1,378 page references remain available. Original text and English explanations both participate in search.

## Search coverage

At build time, PDF.js extracts the complete text layer from every PDF page into an independent record. A word can be found even when it is absent from every curated study entry.

Search supports:

- Title and alias priority, followed by all-query-term matches before partial matches.
- Case, Unicode dash, line-break hyphenation, and common English singular/plural normalization.
- Word-level Fuse.js typo matching, such as `overfiting` to `Overfitting`.
- Whole-word acronym matching, so `ATE` does not match `rate`.
- Joining adjacent PDF glyphs to recover labels such as `Precision`.
- Excerpts around matching PDF text and links to the original page.
- Pagination that keeps the complete result set accessible.

Related curated concepts can also appear through shared lecture topics and nearby references. PDF page results require a text match. This is local lexical search.

Reproducible PDF-only examples: `metastasis` opens Lec 2 / Slide 10, `desynchronized` opens Lec 2 / Slide 5, and `trustworthiness` opens Lec 2 / Slide 9.

### Limits

OCR is not included. Text embedded in images, screenshots, or scans, and some incorrectly encoded formula glyphs, may remain unsearchable. All 402 pages have extractable text, but some contain only headers or footers in their text layer.

`public/data/validation-report.json` records page coverage and `lowTextPages`: pages with fewer than 40 letters or digits after removing running headers and footers. This heuristic identifies review candidates; it does not prove that every image or word is searchable.

## Update materials

1. Update `data/CSCI5526_Open_Book_Master_Index.md` and/or `public/pdfs/*.pdf`.
2. Register new lectures in the Markdown lecture dashboard and coverage tables with the filename, lecture number, and page count.
3. For new or changed Chinese explanations, add an English translation to `data/english-notes.json`. Use `noteKey` and `noteTemplate` from `scripts/english-notes.mjs` to obtain the key and protected math placeholders.
4. Run `npm run build` to regenerate the index and production files.

The build checks PDF page counts, reference ranges, filenames, and translation coverage. An unregistered PDF fails the build to prevent silently omitting an entire lecture. Index and search share the generated data; manually authored search cards are unnecessary.

## Keyboard and links

- `Ctrl/Cmd + K`: open search and focus the input.
- `Enter` in search: open the first result under the current filters.
- `Esc`: close the reader; clear the query when in search without the reader open.
- `Left` / `Right` in the reader: previous/next page.
- Browser Back / Forward: restore query, filters, section, and explicit PDF navigation.
- Index and result links support opening in a new tab.

```text
/?mode=index
/?q=metastasis
/?q=recall&lecture=4&page=33
/?q=ATE&category=Formulas&lecture=8&page=13&start=13&end=16
/?mode=search&q=recall&category=Slides&filters=4
```

## Verification

```sh
npm run build
npm test
npx playwright install chromium
npm run test:e2e
```

Browser tests run against the production `dist/` preview, so rebuild after code changes. Set `PLAYWRIGHT_CHANNEL=chrome` to use installed Chrome without downloading a browser.

Current validation: **18 core tests, 11 browser tests, and the TypeScript/Vite build passed**. See `VERIFICATION.md`; desktop/mobile screenshots are in `tests/screenshots/`.

## Local assets

React, the PDF.js worker and auxiliary files, KaTeX, fonts, and course data are bundled locally. Search and reading do not upload lectures or require a CDN or online model. Markdown does not execute HTML, and PDF annotation links are not automatically loaded.
