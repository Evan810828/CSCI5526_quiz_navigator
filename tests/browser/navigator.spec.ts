import { test, expect } from '@playwright/test';

test('two navigation sections expose every index entry and every slide', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav.getByRole('link')).toHaveText(['Master Index', 'Search']);
  await expect(page.getByRole('heading', { name: 'Master Index', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('[data-index-entry]')).toHaveCount(1001);
  await expect(page.locator('.slide-index ol li')).toHaveCount(402);
  await expect(page.locator('.lecture-list > li')).toHaveCount(10);
  await page.screenshot({ path: 'tests/screenshots/index-desktop.png', fullPage: true });
  await page.getByRole('link', { name: 'Concepts', exact: true }).click();
  await page.locator('#Concepts').getByRole('link', { name: 'Overfitting', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.react-pdf__Page canvas').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('PDF-only keyword opens its original page, with an excerpt and highlight', async ({ page }) => {
  await page.goto('/?q=metastasis');
  const result = page.locator('[data-entry-id="slide-2-10"]');
  await expect(result).toBeVisible();
  await expect(result.locator('.result-excerpt mark')).toContainText(/metastasis/i);
  await page.screenshot({ path: 'tests/screenshots/search-desktop.png', fullPage: true });
  await result.getByRole('link', { name: 'Lec 2 · Slide 10', exact: true }).click();
  await expect(page.getByLabel('PDF page number')).toHaveValue('10');
  await expect(page.locator('.react-pdf__Page canvas').first()).toBeVisible();
  await expect(page.locator('[data-pdf-page="10"] .react-pdf__Page__textContent')).toContainText(/metastasis/i);
  await page.screenshot({ path: 'tests/screenshots/reader-desktop.png' });
  await page.getByLabel('Close PDF').click();
  await expect(page.getByLabel('Search knowledge index')).toHaveValue('metastasis');
});

test('real fuzzy search and keyboard focus work from the index', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  await expect(page.getByLabel('Search knowledge index')).toBeFocused();
  await page.getByLabel('Search knowledge index').fill('overfiting');
  await expect(page.locator('.search-result').first().locator('h2')).toHaveText('Overfitting');
  await page.getByLabel('Search knowledge index').fill('metastais');
  await expect(page.locator('[data-entry-id="slide-2-10"]')).toBeVisible();
});

test('deep link renders original confusion matrix and selectable text', async ({ page }) => {
  await page.goto('/?q=recall&lecture=4&page=33');
  await expect(page.getByLabel('PDF page number')).toHaveValue('33');
  await expect(page.locator('.react-pdf__Page canvas').first()).toBeVisible();
  await expect(page.locator('[data-pdf-page="33"] .react-pdf__Page__textContent')).toContainText('Definitions');
  await expect(page.locator('[data-pdf-page="33"] .react-pdf__Page__textContent')).toContainText('Precision');
  await page.getByLabel('Close PDF').click();
  await expect(page.getByLabel('Search knowledge index')).toHaveValue('recall');
});

test('range navigation, zoom and browser history retain the correct page', async ({ page }) => {
  await page.goto('/?q=99%25+accuracy');
  await page.locator('.search-result').first().getByRole('link', { name: 'Lec 4 · Slides 38–40', exact: true }).click();
  await expect(page.getByLabel('PDF page number')).toHaveValue('38');
  await expect(page.locator('.react-pdf__Page canvas').first()).toBeVisible();
  await page.getByLabel('Zoom in').click();
  await expect(page.locator('.zoom-value')).toHaveText('120%');
  await page.getByLabel('Next page', { exact: true }).click();
  await expect(page.getByLabel('PDF page number')).toHaveValue('39');
  await expect(page.locator('.zoom-value')).toHaveText('120%');
  await page.getByLabel('Next page', { exact: true }).click();
  await page.goBack();
  await expect(page.getByLabel('PDF page number')).toHaveValue('39');
  await page.getByLabel('PDF page number').fill('42');
  await page.getByLabel('PDF page number').press('Enter');
  await expect(page.locator('[data-pdf-page="42"] canvas')).toBeVisible();
  await expect(page.locator('.react-pdf__Page canvas').first()).toBeVisible();
});

test('source filters, lecture filters and pagination keep full-text results accessible', async ({ page }) => {
  await page.goto('/?q=metastasis');
  await page.getByLabel('Content type').selectOption('Slides');
  await page.getByLabel('Lecture filter').selectOption('4');
  await expect(page.locator('.empty-results')).toContainText('No matching results');
  await page.getByRole('button', { name: 'Search all content' }).click();
  await expect(page.locator('[data-entry-id="slide-2-10"]')).toBeVisible();
  await page.getByLabel('Search knowledge index').fill('Varatharajah');
  await page.getByLabel('Content type').selectOption('Slides');
  await expect(page.locator('.search-result')).toHaveCount(40);
  await page.getByRole('button', { name: 'Show more' }).click();
  await expect(page.locator('.search-result')).toHaveCount(80);
  await page.getByLabel('Clear search').click();
  await expect(page.locator('.search-result')).toHaveCount(0);
});

test('unknown sources and out-of-range pages remain explicit', async ({ page }) => {
  await page.goto('/?lecture=4&page=33&file=missing.pdf');
  await expect(page.getByRole('alert')).toContainText('missing.pdf');
  await expect(page.locator('.react-pdf__Page canvas')).toHaveCount(0);
  await page.goto('/?lecture=4&page=500');
  await expect(page.getByRole('alert')).toContainText('Page is out of range');
  await page.getByLabel('PDF page number').fill('33');
  await page.getByLabel('PDF page number').press('Enter');
  await expect(page.locator('.react-pdf__Page canvas').first()).toBeVisible();
});

test('mobile layout, formulas and closing the reader preserve search', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?q=specificity&category=Formulas');
  await expect(page.locator('.katex').first()).toBeVisible();
  expect(await page.locator('main').innerText()).not.toMatch(/\p{Script=Han}/u);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'tests/screenshots/search-mobile.png', fullPage: true });
  await page.locator('.search-result').first().locator('h2 a').click();
  await expect(page.locator('.react-pdf__Page canvas').first()).toBeVisible();
  expect(await page.locator('.reader-note').innerText()).not.toMatch(/\p{Script=Han}/u);
  await page.screenshot({ path: 'tests/screenshots/reader-mobile.png' });
  await page.getByLabel('Close PDF').click();
  await expect(page.getByLabel('Search knowledge index')).toBeVisible();
  await expect(page.getByLabel('Search knowledge index')).toHaveValue('specificity');
  await page.getByRole('link', { name: 'Master Index', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'tests/screenshots/index-mobile.png', fullPage: true });
});

test('reading uses no external network requests or runtime errors', async ({ page }) => {
  const external: string[] = [], errors: string[] = [];
  page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith('http://127.0.0.1:4173/')) external.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?lecture=4&page=33&q=recall');
  await expect(page.locator('.react-pdf__Page canvas').first()).toBeVisible();
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('wheel scrolling reads consecutive pages and synchronizes the page number and URL', async ({ page }) => {
  await page.goto('/?lecture=4&page=33&start=33&end=34');
  await expect(page.locator('[data-pdf-page="33"] canvas')).toBeVisible();
  await expect(page.locator('.pdf-page-slot')).toHaveCount(42);
  const height = await page.locator('[data-pdf-page="33"]').evaluate(element => element.getBoundingClientRect().height);
  await page.getByTestId('pdf-scroll').hover();
  await page.mouse.wheel(0, height + 20);
  await expect(page.getByLabel('PDF page number')).toHaveValue('34');
  await expect(page).toHaveURL(/page=34/);
  await expect(page.locator('[data-pdf-page="34"] canvas')).toBeVisible();
  await page.mouse.wheel(0, height + 20);
  await expect(page.getByLabel('PDF page number')).toHaveValue('35');
  await page.mouse.wheel(0, -(height + 20));
  await expect(page.getByLabel('PDF page number')).toHaveValue('34');
  expect(await page.locator('.react-pdf__Page canvas').count()).toBeLessThan(8);
  await page.getByLabel('Zoom in').click();
  await expect(page.getByLabel('PDF page number')).toHaveValue('34');
  await expect(page.locator('.zoom-value')).toHaveText('120%');
  await page.getByLabel('Fit Page', { exact: true }).click();
  await expect(page.getByLabel('PDF page number')).toHaveValue('34');
});

test('mobile reader reaches the last page and preserves direct page navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?lecture=9&page=9');
  await expect(page.locator('[data-pdf-page="9"] canvas')).toBeVisible();
  await expect(page.getByLabel('PDF page number')).toHaveValue('9');
  await page.getByLabel('PDF page number').fill('4');
  await page.getByLabel('PDF page number').press('Enter');
  await expect(page.locator('[data-pdf-page="4"] canvas')).toBeVisible();
  await expect(page.getByLabel('PDF page number')).toHaveValue('4');
  await page.getByTestId('pdf-scroll').hover();
  await page.mouse.wheel(0, 550);
  await expect(page.getByLabel('PDF page number')).not.toHaveValue('4');
  await page.getByLabel('PDF page number').fill('1');
  await page.getByLabel('PDF page number').press('Enter');
  await expect(page.locator('[data-pdf-page="1"] canvas')).toBeVisible();
  await expect(page.getByLabel('PDF page number')).toHaveValue('1');
});
