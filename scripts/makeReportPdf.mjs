/**
 * Turns the quality report into a PDF you can attach to an email.
 *
 * A report is a document — it gets forwarded, filed and printed — so the
 * deliverable is a file rather than a link to a page.
 *
 * Two things this handles that printing from the browser does not: the
 * disclosures are opened first, since a collapsed section prints as a heading
 * with nothing under it, and the light palette is forced regardless of the
 * machine's theme, because a dark-mode PDF is unreadable on paper.
 *
 *   npm run report:pdf
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SOURCE = 'LMS_TEST_REPORT.html';
const STANDALONE = 'LMS_TEST_REPORT.view.html';
const OUTPUT = 'Iron Lady LMS — Quality Assessment.pdf';

if (!fs.existsSync(SOURCE)) {
  console.error(`Cannot find ${SOURCE} — run this from the project root.`);
  process.exit(1);
}

const body = fs.readFileSync(SOURCE, 'utf8');
const title = body.match(/<title>(.*?)<\/title>/)?.[1] || 'Iron Lady LMS — Quality Assessment';

fs.writeFileSync(
  STANDALONE,
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
</head>
<body>
${body}
</body>
</html>
`,
  'utf8'
);

const browser = await chromium.launch();
const page = await browser.newPage({ colorScheme: 'light' });
await page.goto(pathToFileURL(path.resolve(STANDALONE)).href, { waitUntil: 'load' });

// A collapsed disclosure prints as a heading with nothing beneath it.
await page.evaluate(() => {
  document.querySelectorAll('details').forEach((d) => d.setAttribute('open', ''));
});
await page.waitForTimeout(400);

const date = new Date().toLocaleDateString('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

await page.pdf({
  path: OUTPUT,
  format: 'A4',
  printBackground: true,
  margin: { top: '16mm', bottom: '18mm', left: '14mm', right: '14mm' },
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: `
    <div style="width:100%;padding:0 14mm;font-family:sans-serif;font-size:8pt;color:#6b6b6b;
                display:flex;justify-content:space-between;">
      <span>Iron Lady LMS — Quality Assessment · ${date}</span>
      <span class="pageNumber"></span>/<span class="totalPages"></span>
    </div>`,
});

const pages = await page.evaluate(() => document.querySelectorAll('h2').length);
await browser.close();

const kb = Math.round(fs.statSync(OUTPUT).size / 1024);
console.log(`Wrote "${OUTPUT}" — ${kb} KB, ${pages} sections.`);
console.log('Attach that file. It needs no internet connection and nothing to install.');
