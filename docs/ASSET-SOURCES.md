# Asset sources

Where to download art for the game, what the bedroom needs, and how a downloaded file gets into the game. Every asset that ships is listed in [`CREDITS.md`](../CREDITS.md). Check the competition's rule on third-party assets in [`COMPETITION.md`](COMPETITION.md) before relying on anything that is not CC0.

## Workflow

1. Download into `asset-inbox/` at the top of the repo, one folder per download, with whatever came with it. `asset-inbox/` is git-ignored, so raw files are never committed and do not count against the asset budgets.
2. For anything not from Kenney, Quaternius or Poly Haven, add a `source.txt` to its folder with the page URL, the author, and the licence (for example `CC-BY 4.0, by <author>`).
3. Pick what is used, shrink it to fit the budget, convert it to a single `.glb`, and move it into `src/assets/models/`. The file name sets its asset id (`bedSingle.glb` is `bedsingle`).
4. Add a row for it to `CREDITS.md`.

## Where to download

### Models

| Source | Licence | Look | Notes |
|---|---|---|---|
| [Kenney Furniture Kit](https://kenney.nl/assets/furniture-kit) | CC0 | Low-poly, flat colours | **Start here.** About 140 pieces: beds, bookcases, tables, lamps, rugs, plants, toys. One zip with `.glb` files. Unzip to `asset-inbox/kenney-furniture/`. `src/engine/shadow/room-models.ts` already loads five of them. |
| [Kenney 3D kits](https://kenney.nl/assets?category=3D) | CC0 | Low-poly | The rest of Kenney's 3D packs. |
| [Quaternius](https://quaternius.com) | CC0 | Low-poly, softer | Furniture, house interior and medieval or village packs. Take the glTF/GLB version where offered. |
| [Poly Haven models](https://polyhaven.com/models) | CC0 | Realistic scans | Furniture, candles, books, wooden props. Download **1k** textures in **glTF** format, or the files are far too big. |
| [Poly Pizza](https://poly.pizza) | Mixed CC0 and CC-BY | Low-poly | Note the licence and page link for each CC-BY model so it can be credited. |
| [Sketchfab, downloadable](https://sketchfab.com/search?features=downloadable&type=models) | Varies per model | Anything | Needs a login. Note each model's licence. Download "glTF" or "GLB". |

### Textures

| Source | Licence | Notes |
|---|---|---|
| [ambientCG](https://ambientcg.com) | CC0 | Wood planks, wallpaper, fabric, plaster. **1K-JPG** is enough. |
| [Poly Haven textures](https://polyhaven.com/textures) | CC0 | The same kind of thing, at 1k. |

## What the bedroom needs

In priority order. The first five are near the wall or the candle, so they matter most for the shadows.

1. Bed (single or child's)
2. Bookcase or shelves, and loose books
3. Bedside table and a small lamp
4. Candle and a candle holder or saucer, for the flame on the tray
5. Bed tray (a small wooden lap tray)
6. Rug
7. Toys: a teddy bear, a toy chest, a rocking horse or wooden blocks
8. Chair or stool
9. Potted plant
10. Wall clock and picture frames
11. Curtains or a window frame

## What a file needs

- **Format.** `.glb` is best. `.gltf` with its textures is fine (it is converted to `.glb` before it ships, since loose `.gltf` files are not loaded). `.fbx` or `.obj` will do if that is all there is.
- **Size.** Each shipped model must be at most 500 KB and each texture at most 512 KB (`src/engine/services/assets/budgets.mjs`). Prefer low-poly models with small or no textures.
- **Licence.** In order of preference:

  | Licence | Use it? |
  |---|---|
  | CC0 | Yes, the safest choice |
  | CC BY | Very likely fine. Credit the author in `CREDITS.md` |
  | CC BY-SA | Allowed, but "share alike" can extend to our changes. Best avoided |
  | Any NC (non-commercial) | Avoid: a competition with cash prizes could count as commercial use |
  | Any ND (no derivatives) | Avoid: rescaling or recolouring a model would break it |

- **Style.** Keep to one look so the room hangs together: low-poly (Kenney, Quaternius) or realistic (Poly Haven), not a mix. Low-poly is lighter on Quest and suits the storybook mood.
