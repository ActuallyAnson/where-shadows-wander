# ADR 0015: The bedroom's static pieces are placed by a layout file, edited in the running game

Status: proposed 10 Nov 2026 (Teammate A), prototyped on `exp/real-wall-stage`. Needs Anson (`engine/shadow`, `src/app`, `src/input-mock`) and Teammate B (`render/room`, `src/debug`) to agree. Replaces [ADR 0006](0006-editor-authored-layouts.md) for the room only; puzzle layouts are unchanged.

## Context

Every static piece of the bedroom was placed by number literals spread through four views (`room-models.ts`, `room-dressing-view.ts`, `bedroom-view.ts`, `bed-tray-view.ts`). Arranging the room meant editing a number, reloading and looking, which works for big moves and not for fine ones. The quilt standing up through the bed tray is an example.

ADR 0006 planned the room for IWSDK's scene editor (`public/scenes/main.iwsdk.scene.json`, never filled). That editor cannot show what decorating needs:
- It shows the `.glb` furniture, but not the painted pieces (walls, window, pictures, the tray and quilt) or the candle and moon lighting.
- It shows a different room from the game's. The game builds the room around the player's head and moves the wall ahead to the stage distance at run time; the editor has neither.
- `main.iwsdk.scene.json` is the scene IWSDK loads at start, so pieces placed there would be added to the world a second time, fixed in world space.

## Decision

- **One layout file, `content/rooms/bedroom.json`.** Each piece id maps to a placement: `pos` (metres), `rotDeg` (degrees, Euler XYZ) and `scale` (a multiplier on the piece's own size).
  - The `room` section is room space: x right, y up from the floor, -z toward the wall ahead.
  - The `lap` section is the bed tray's own space: `tray` (with its rims and legs) and `quilt`.
  - Pieces: `bed`, `bookcase`, `rug`, `chair`, `plant`, `picture-moon`, `picture-hill`, `shelf`, `sill`, `moon-patch`, `tin-can`, and in `lap`, `tray` and `quilt`.
- **A pure parser, `src/engine/stage/room-layout.ts`.** It reads the file as `unknown` and never throws. Anything it can't use is reported in `problems` and that piece stays at its code default, so a missing or broken file never breaks the room.
  - It writes the file in a fixed format (sorted, one piece per line, rounded to 1 mm and 0.1°), so a save is a small diff.
  - `content/rooms/` is in `.prettierignore`.
- **The code keeps the defaults.** Each view builds its piece around the piece's own origin and then applies the layout (`src/engine/shadow/room-placement.ts`). A model's fit-to-footprint size stays in `ROOM_PIECES`, and the file's scale multiplies it.
- **What stays in code** is what is placed at run time: the room's root (the head pose), the wall ahead and the bunting on it (the stage distance), and where the tray sits in front of the head. The window also stays in code for now: it is ten layers over two views, with a parallax tied to its position.
- **A dev-only room editor, `src/debug/room-editor.ts`**, opened with `?mock=1&edit=room`.
  - It takes the Hand Lab's desk view (`HandLab.suspend`).
  - Click to select, then use the `TransformControls` gizmo or type exact numbers.
  - Undo/redo, Revert (to the file), Reset (to the code's default), view presets, and "Room only" to hide the stage and the story's views.
  - **Save** posts the file to a dev-server endpoint (`vite.config.ts`, `saveRoomLayouts`). The endpoint refuses anything the parser has problems with. A change to the file doesn't reload the page, but the next reload reads it.
  - It runs only in debug builds, behind `DEBUG_TOOLS` with a dynamic import, and `check-debug-free` has its marker.
- **Things that follow a piece follow it in the game too.** The candle stands on the tray wherever the tray is, and the wonders' glows (and the spark that flies to each) move with the piece they are on.

## Consequences

- **Arranging the room needs no code.** It's done in the real room, with its lighting and the real wall distance, and the change is a reviewable diff of a data file.
- **Moving the tray moves the candle**, and the candle is the light that casts the gameplay shadows. Keep the tray near its default unless that is wanted.
- **Not in the editor yet:** the window, the walls, and the painted stand-ins (hidden once their models load). Adding a piece means giving it an id in its view (`editable(id, object)` or an `EditablePiece`) and listing it in `BEDROOM_PIECE_IDS`.
- **The editor works on the desktop only**, in the Hand Lab, not in a headset session.
- `public/scenes/main.iwsdk.scene.json` stays as IWSDK's start scene, empty.

## Update (11 Nov 2026): added models, an asset browser and export

- **Added pieces.** A layout entry may name a `"model"`: the asset id of a `.glb` under `src/assets`. Such an entry is a model placed in the editor, not built by the code, so its id is free (`chair-2`); a built-in piece can't take a model. `PlacedModels` (`src/engine/shadow/placed-models.ts`) loads them through the asset manifest in the game and the headset. Unlike the fitted furniture, a placed model keeps its own size (times the layout's scale) and is moved so the middle of its base is at its origin. Its look is the room's (`room-look.ts`, shared with `RoomModels`, now keeping transparency). A model whose file is missing is left out with a warning and its entry is kept; the dev server refuses to save a layout that places a model with no file.
- **The editor's scene tree** groups the pieces by section and owner (grouping only, no parenting). Added models can be copied and removed, undoably.
- **An asset browser** (`src/debug/room-editor-assets.ts`) shows `src/assets/models` as folders, and imports, moves, renames and deletes files through dev-server endpoints (`/__wsw/assets/`, `vite.config.ts`). The rules live in `src/engine/services/assets/asset-tree.ts`: paths confined to the folder, the model budget, a self-contained `.glb`, no asset id clash anywhere under `src/assets` (two files with one id would break the manifest), and no rename or delete of a model a layout places. A model is referred to by its id, not its path, so moving it between folders never touches a layout.
- **No reload for model files.** Vite's glob plugin would reload the page when a file is added or deleted (nothing accepts the asset list module's update), ending the editor's session. A post-order `hotUpdate` hook marks those modules stale instead, so the next reload sees the folder as it is; a pre-order hook keeps an overwrite from reaching IWSDK's dev plugin. While the editor is open it loads placed models from their files, so a model imported after the page loaded can be placed at once.
- **Export to .glb** (`src/debug/piece-export.ts`, three's `GLTFExporter`) writes a built piece to `src/assets/models/exported/`. The code's piece stays as it is; the file is for placing copies or editing elsewhere. Additive blending, depth offset and drawing order are not kept.
- `scripts/room-editor-probe.mjs` checks all of it in a browser against a dev server.
