/**
 * Opens the quality report in Chrome.
 *
 * The report itself is a fragment — no doctype, no charset — because the
 * publisher wraps it in that skeleton. Opened straight from disk a browser has
 * to guess the encoding, and every dash and symbol in it comes out as mojibake.
 * So this writes a wrapped copy alongside it and opens that.
 *
 *   npm run report
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const SOURCE = 'LMS_TEST_REPORT.html';
const OUTPUT = 'LMS_TEST_REPORT.view.html';

if (!fs.existsSync(SOURCE)) {
  console.error(`Cannot find ${SOURCE} — run this from the project root.`);
  process.exit(1);
}

const body = fs.readFileSync(SOURCE, 'utf8');
const title = body.match(/<title>(.*?)<\/title>/)?.[1] || 'Iron Lady LMS — Quality Assessment';

fs.writeFileSync(
  OUTPUT,
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

const target = path.resolve(OUTPUT);
console.log(`Wrote ${OUTPUT} (${Math.round(fs.statSync(target).size / 1024)} KB)`);

/** Chrome's usual homes on Windows, then macOS, then Linux. */
const candidates = [
  process.env.PROGRAMFILES &&
    `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
  process.env['PROGRAMFILES(X86)'] &&
    `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`,
  process.env.LOCALAPPDATA &&
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].filter(Boolean);

const chrome = candidates.find((c) => fs.existsSync(c));

if (chrome) {
  spawn(chrome, [target], { detached: true, stdio: 'ignore' }).unref();
  console.log('Opened in Chrome.');
} else {
  // No Chrome found — hand it to whatever the machine uses by default.
  const [cmd, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', target]]
      : process.platform === 'darwin'
        ? ['open', [target]]
        : ['xdg-open', [target]];
  spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
  console.log('Chrome not found in the usual places — opened in the default browser.');
}
