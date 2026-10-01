// Lists meshes in the scene and whether they are visible, to confirm IWSDK's
// input visuals are hidden and only our objects draw.
// Usage: npx iwsdk browser run scripts/census.mjs
export default async function run({ frame, page }) {
  return (frame ?? page).evaluate(() => {
    const { world } = window.__wsw;
    const rows = [];
    world.scene.traverse((o) => {
      if (!o.isMesh) return;
      let shown = true;
      const path = [];
      for (let p = o; p; p = p.parent) {
        shown &&= p.visible;
        if (p !== world.scene) path.unshift(p.name || p.type);
      }
      rows.push(`${shown ? 'shown ' : 'hidden'} ${o.type}${o.isInstancedMesh ? `(count ${o.count})` : ''} ${o.material?.type ?? ''} ${path.slice(-4).join('/')}`);
    });
    return { inXR: world.renderer.xr.isPresenting, drawCalls: world.renderer.info.render.calls, rows: rows.filter((r) => !r.includes('LevelRoot')) };
  });
}
