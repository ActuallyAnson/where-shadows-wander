// Lists what is in the three.js scene (ours vs IWSDK's) and the ECS systems running.
export default async function run({ frame, page }) {
  return (frame ?? page).evaluate(() => {
    const { world, game } = window.__spike;
    const ours = new Set([game.stage.paper, game.stage.quads, game.shadow.joints, game.shadow.bones, game.shadow.jointShadow, game.shadow.boneShadow]);
    const renderables = [];
    world.scene.traverseVisible((o) => {
      if (!(o.isMesh || o.isLine || o.isPoints)) return;
      let p = o, path = [];
      while (p && p !== world.scene) { path.unshift(p.name || p.type); p = p.parent; }
      renderables.push({ ours: ours.has(o), type: o.type, path: path.slice(-3).join('/'), tris: o.geometry?.index ? o.geometry.index.count / 3 : (o.geometry?.attributes.position?.count ?? 0) / 3, instances: o.count ?? 1 });
    });
    const systems = (world.getSystems?.() ?? []).map((s) => `${s.constructor.name}@${s.priority}`);
    return { renderables, systems, entityCount: world.entityManager?.indexLookup?.length ?? null };
  });
}
