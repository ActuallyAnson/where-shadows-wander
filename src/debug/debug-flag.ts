// The one gate for debug tools: on in the dev server, and in a build made on purpose with
// `npx vite build --mode tester` (a tester build); off in the plain `npm run build` that the judges get. Vite replaces
// `import.meta.env.DEV` and `.MODE` with literals (an unset VITE_ variable is not one, which is why the mode is used),
// so with the gate off, every `if (DEBUG_TOOLS)` block, and the
// modules it alone imports (dynamically, from main.ts), are removed from the bundle. debug-free-build.test.ts
// builds without the flag and checks that none of it is left.
//
// Rule for new debug code: never import it statically from code that ships. Reach it with
// `if (DEBUG_TOOLS) { const { ... } = await import('../debug/...') }`.
export const DEBUG_TOOLS: boolean = import.meta.env.DEV || import.meta.env.MODE === 'tester';
