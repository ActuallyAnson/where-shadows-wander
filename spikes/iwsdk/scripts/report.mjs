// Usage: npx iwsdk browser run scripts/report.mjs  — prints window.__spike.report
// The managed window hosts editor + app; the app runs in `frame`.
export default async function run({ frame, page }) {
  const target = frame ?? page;
  return target.evaluate(() => JSON.parse(JSON.stringify(window.__spike?.report ?? null)));
}
