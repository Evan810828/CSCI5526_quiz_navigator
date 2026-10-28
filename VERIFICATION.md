# Verification record — 2026-10-25

## Passed

- Data preprocessing with the project's installed PDF.js 5.4.296 and Marked dependencies.
- 1,046 Markdown table rows retained: 1,001 study entries and 45 metadata rows.
- 1,378 original references, zero reference errors and zero reference warnings.
- One independent full-text record for every original page: 10 PDFs, 402 pages.
- All 1,001 study entries have English titles and explanations. Translation coverage includes 959 distinct originally Chinese explanations reused across 990 entries; the remaining entries were already English.
- 18 Node tests: PDF-only terms absent from curated rows; real Fuse typo matching; case/plural/hyphen normalization; acronym boundaries; complete page coverage; adjacent glyph extraction from original Lec 4 page 33; URL state round trips; complete English notes with original references, IDs, raw text, and formulas preserved; rejection of missing translations and missing formula placeholders.
- TypeScript `tsc --noEmit` and the Vite production build using the native ESM config loader.
- 11 Playwright tests on the production preview using installed Chrome: complete two-section navigation, English interface and explanations, PDF-only keyword excerpts/highlighting and original-page navigation, keyboard focus, fuzzy matching, deep links and selectable text, reference navigation, zoom, Back navigation, filters, pagination, invalid source/page recovery, mobile formulas/layout, and no external network requests or runtime errors during reading.
- Continuous PDF scrolling verified in both directions. Page number and URL follow the viewport; scrolling continues beyond the cited range; nearby canvases are rendered on demand; zoom/fit retain the current page.
- Mobile last-page links, explicit page entry, and subsequent scrolling verified at 390 × 844.
- Visual review of English desktop/mobile index and search, plus desktop/mobile PDF reading. No horizontal site overflow at 390px width.

## Screenshots

- `tests/screenshots/index-desktop.png`
- `tests/screenshots/index-mobile.png`
- `tests/screenshots/search-desktop.png`
- `tests/screenshots/search-mobile.png`
- `tests/screenshots/reader-desktop.png`
- `tests/screenshots/reader-mobile.png`

## Reproduction

```sh
npm run build
npm test
npm run test:e2e
```

Browser tests require an installed Playwright Chromium, or `PLAYWRIGHT_CHANNEL=chrome` with installed Chrome. They use `http://127.0.0.1:4173/` and start/reuse the production preview.

## Limits

The generated index covers PDF text layers, not OCR. Some pages contain only running headers and footers in their text layer; text within images and incorrectly encoded formula glyphs may remain unsearchable. `public/data/validation-report.json` records low-text candidates after excluding course headers/footers. This heuristic is not a proof that every image or word is searchable.

PDF.js emits font-program warnings for some supplied PDFs during extraction; preprocessing and tested page rendering succeed. Vite reports a large main bundle because the complete course index is bundled locally. Neither warning is represented as a failed reference check.

The default esbuild config/dependency scanning encountered restricted ancestor-directory access in this Windows execution environment. The native ESM config and production build/preview path passed. Development-server dependency prebundling was not verified in this restricted environment; production preview was verified.
