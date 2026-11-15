# ADR 0017: One address; modes are chosen on the page, and the AR mode is gone

Status: accepted 11 Nov 2026.

## Context

The page took a dozen query options: `?mock=1` (with `&src=` and `&file=`) for the Hand Lab, `&edit=room` for the room editor, `?xr=ar` for the old passthrough mode, `?debug=`, `?settings`, `?record` (with `&script=` and `&note=`), `?flicker=` and `?occlude=` for testing. Typing them is a chore on a headset, they are easy to lose (a reload in the `npm run dev` window dropped `?mock=1`), and the launcher had grown buttons to match: two Enter VR buttons that did the same thing, Enter AR, Copy Logs, Testing and an Open Hand Lab link. The Testing panel already held most of the testing switches without an address.

The game is a virtual room (ADR 0005); the passthrough mode was kept only for testing and nobody uses it.

## Decision

- **The page has one address and reads no query options.** What it starts as is in `src/app/launch-mode.ts`: `game` (the default), `lab` (the Hand Lab) or `room-editor` (the Hand Lab with the room editor; dev and tester builds only, else it opens as the lab). The choice, and the lab's hand source, are kept in the tab's `sessionStorage`: a reload stays in the mode, a new tab or the link sent to a headset opens the game. Choosing a mode saves it and reloads.
- **The title screen is the same in every build:** BEGIN and SETTINGS. (Update, 11 Nov 2026: "Trouble starting?" and its other ways in, compatibility mode and IWSDK's own launch, were removed. BEGIN already falls back to fewer features and to the older WebGL layer by itself, and IWSDK's launch was the path that failed silently on the Pico.)
- **Dev and tester builds add one Developer button** (`src/app/developer-panel.ts`): the modes, the testing switches (now with the lantern's flicker, which replaces `?flicker=`), the launch log and Copy logs. It is behind `DEBUG_TOOLS`, so the judges' build does not contain it (`check:debug-free`).
- **The judges' build reaches the Hand Lab only from the no-headset page** ("Try the Hand Lab"), for visitors without a headset. The lab's "Back to the game" returns. (Superseded by [ADR 0018](0018-hand-lab-in-session.md), 11 Nov 2026: the Hand Lab is mock hands inside the game's session, dev and tester builds only; the no-headset page no longer offers it, and the modes are `game` and `room-editor`.)
- **The AR mode is removed:** the Enter AR button, `?xr=ar`, the `HandOccluder` (it only mattered over passthrough), and the composite probe. Git history keeps them.
- **Scripts set the mode before the page loads** (`scripts/lib/launch.mjs`), writing the same storage keys the page reads.

## Consequences

- A hand recording on a headset is armed from the Developer panel; a free recording is always 20 s and the `note` label is gone (rename the file instead).
- A replay chosen from a file comes back as the demo recording after a reload (the file is not stored); drop it again.
- Links to `?mock=1` in old notes open the game; open the lab from the Developer panel.
