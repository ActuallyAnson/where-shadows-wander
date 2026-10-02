// Prints the diagnostics report from the dev server's managed browser.
// Usage: npx iwsdk browser run scripts/read-report.mjs
export default async function run({ frame, page }) {
  return (frame ?? page).evaluate(() => JSON.parse(localStorage.getItem('wsw.diagnostics.v1') ?? 'null'));
}
