// EVAL="<js expression using world, game>" npx iwsdk browser run scripts/eval.mjs
export default async function run({ frame, page }) {
  const expr = process.env.EVAL;
  return (frame ?? page).evaluate((expr) => {
    const { world, game } = window.__spike;
    return JSON.parse(JSON.stringify(new Function('world', 'game', `return (${expr});`)(world, game)));
  }, expr);
}
