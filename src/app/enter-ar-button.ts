import type { World } from '@iwsdk/core';
import { DEBUG_TOOLS } from '../debug/debug-flag';
import { captureOptions, loadCaptureChoice, nextCapture, saveCaptureChoice } from './capture-mode';
import { createTitleScreen, type TitleScreen } from '../ui/title-screen/title-screen';
import type { UiSound } from './ui-sound';

/** Things the page's own screens ask of the app, filled in once the app has them (the settings exist after the title does). */
export interface LauncherHooks {
  openSettings?: () => void;
  /** The title has finished fading to black and is gone, so the session's own fade-in can start (it would be hidden before). */
  titleGone?: () => void;
}

/** How long the title takes to fade to black after BEGIN (title-markup.ts: a 0.3 s delay, then 1.2 s). */
const TITLE_FADE_MS = 1500;

export async function mountEnterArButtonIfNeeded(
  world: World,
  sound?: UiSound,
  hooks: LauncherHooks = {},
): Promise<void> {
  const xr = navigator.xr;
  if (!xr) {
    console.warn('[Launcher] navigator.xr is not available');
    return;
  }

  // The launch log: kept from the start, shown on the page only when BEGIN fails in a debug build (in a session, the
  // developer overlay shows the errors instead).
  const logs: string[] = [];

  // Create UI overlay container
  const uiContainer = document.createElement('div');
  uiContainer.id = 'xr-launcher-ui';
  uiContainer.style.cssText =
    'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:9999;' +
    'display:flex;flex-direction:column;align-items:center;gap:10px;' +
    'width:94vw;max-width:680px;pointer-events:none;';

  // Live log window
  const logBox = document.createElement('div');
  logBox.style.cssText =
    'width:100%;flex:none;max-height:160px;overflow-y:auto;background:rgba(15,18,24,0.95);' +
    'border:1px solid #3a4459;border-radius:10px;padding:10px 14px;font:11px/1.45 ui-monospace,monospace;' +
    'color:#c9d1d9;box-sizing:border-box;pointer-events:auto;box-shadow:0 8px 24px rgba(0,0,0,0.5);';

  const statusLine = document.createElement('div');
  statusLine.style.cssText = 'font-weight:700;color:#58a6ff;margin-bottom:6px;font-size:12px;';
  statusLine.textContent = DEBUG_TOOLS ? '● WebXR Launcher Ready' : '';
  logBox.append(statusLine);

  // What a player sees when something goes wrong: the log box above is a debug tool and is not shown in the judges' build.
  const note = document.createElement('div');
  note.style.cssText =
    'display:none;max-width:30rem;padding:10px 14px;border-radius:10px;background:rgba(20,22,28,0.92);' +
    'color:#ece6d8;font:14px/1.45 system-ui,-apple-system,sans-serif;text-align:center;pointer-events:auto;';
  // With the title screen up (a VR-capable browser), a message goes under its menu; otherwise in the box above.
  let title: TitleScreen | null = null;
  const showNote = (text: string): void => {
    if (title) {
      title.setNote(text);
      return;
    }
    note.textContent = text;
    note.style.display = 'block';
  };

  const logList = document.createElement('div');
  logBox.append(logList);

  const appendLog = (msg: string, color = '#c9d1d9') => {
    const time = new Date().toTimeString().slice(0, 8);
    const line = `[${time}] ${msg}`;
    logs.push(line);
    const el = document.createElement('div');
    el.style.color = color;
    el.style.wordBreak = 'break-word';
    el.textContent = line;
    logList.append(el);
    logBox.scrollTop = logBox.scrollHeight;
  };

  // Intercept window errors and unhandled rejections to show in the logBox
  window.addEventListener('error', (e) => {
    appendLog(`Uncaught Error: ${e.message} (${e.filename}:${e.lineno})`, '#ff7b72');
  });
  window.addEventListener('unhandledrejection', (e) => {
    appendLog(`Unhandled Rejection: ${String(e.reason)}`, '#ff7b72');
  });

  appendLog(`Browser UA: ${navigator.userAgent.slice(0, 75)}...`);
  if (typeof XRWebGLBinding !== 'undefined') {
    const hasProj = 'createProjectionLayer' in XRWebGLBinding.prototype;
    appendLog(`XRWebGLBinding available. createProjectionLayer: ${hasProj}`);
  }

  // Buttons row
  const buttonRow = document.createElement('div');
  buttonRow.style.cssText =
    'display:flex;flex-wrap:wrap;justify-content:center;gap:8px;width:100%;pointer-events:auto;';

  const makeBtn = (text: string, bg: string, fg: string, border: string, onClick: () => void) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = text;
    btn.style.cssText =
      `padding:12px 18px;border-radius:10px;background:${bg};color:${fg};border:1.5px solid ${border};` +
      'font:700 14px system-ui,-apple-system,sans-serif;cursor:pointer;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
    btn.onclick = onClick;
    return btn;
  };

  // The one way in (the title's BEGIN). It falls back by itself: to fewer features if the runtime rejects some, and to
  // the older XRWebGLLayer if three.js can't bind the session with a projection layer (the Pico's driver has none).
  /** Shows the launch log on the page (set below in debug builds). */
  let showLaunchLog: (() => void) | null = null;
  /** When BEGIN was pressed (performance.now()), so the title stays up until its fade to black has finished. */
  let pressedAt = -Infinity;
  const launchDirect = async (mode: XRSessionMode) => {
    pressedAt = performance.now();
    title?.setBusy(true);
    statusLine.textContent = `● Launching ${mode}...`;
    statusLine.style.color = '#e3b341';
    appendLog(`Requesting ${mode} session...`, '#e3b341');

    // Stash original createProjectionLayer so we can restore it on failure or session end
    const origCreateProjLayer =
      typeof XRWebGLBinding !== 'undefined'
        ? (XRWebGLBinding.prototype as unknown as { createProjectionLayer?: unknown }).createProjectionLayer
        : undefined;

    const restoreProjectionLayer = () => {
      if (
        origCreateProjLayer &&
        typeof XRWebGLBinding !== 'undefined' &&
        !('createProjectionLayer' in XRWebGLBinding.prototype)
      ) {
        (XRWebGLBinding.prototype as unknown as { createProjectionLayer?: unknown }).createProjectionLayer =
          origCreateProjLayer;
      }
    };

    try {
      const w = world as unknown as { sessionRequestPending?: boolean; session?: XRSession };
      w.sessionRequestPending = false;

      // Feature ladder: Wolvic on Pico can reject optional features (like bounded-floor or hand-tracking)
      // if controllers are connected, boundary is unconfigured/stationary, or after a session reset.
      const configs: Array<{ label: string; init: XRSessionInit }> = [
        { label: 'hands + boundary', init: { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] } },
        { label: 'hands only', init: { optionalFeatures: ['local-floor', 'hand-tracking'] } },
        { label: 'basic floor', init: { optionalFeatures: ['local-floor'] } },
        { label: 'minimal', init: {} },
      ];

      let session: XRSession | null = null;
      let lastErr: unknown = null;

      for (let i = 0; i < configs.length; i++) {
        const cfg = configs[i];
        try {
          appendLog(`Requesting ${mode} (${cfg.label})...`, '#e3b341');
          session = await xr.requestSession(mode, cfg.init);
          appendLog(`Session granted (${cfg.label})!`, '#7ee787');
          break;
        } catch (e: unknown) {
          lastErr = e;
          const msg = e instanceof Error ? e.message : String(e);
          appendLog(`Config (${cfg.label}) rejected: ${msg}`, '#e3b341');
          if (i < configs.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 60));
          }
        }
      }

      if (!session) {
        throw lastErr;
      }

      const sessInfo = session as unknown as { mode?: string; enabledFeatures?: Iterable<string> };
      appendLog(`Session granted! Mode: ${sessInfo.mode || mode}`, '#7ee787');

      if (sessInfo.enabledFeatures) {
        appendLog(`Enabled features: ${Array.from(sessInfo.enabledFeatures).join(', ')}`, '#7ee787');
      }

      // Probing reference space
      let refSpaceType: XRReferenceSpaceType = 'local-floor';
      try {
        await session.requestReferenceSpace('local-floor');
        appendLog('Reference space: local-floor supported', '#7ee787');
      } catch {
        refSpaceType = 'local';
        appendLog('local-floor unsupported, falling back to local', '#e3b341');
      }

      world.renderer.xr.enabled = true;
      world.renderer.xr.setReferenceSpaceType(refSpaceType);

      appendLog('Binding session to Three.js WebXRManager...', '#58a6ff');
      try {
        await world.renderer.xr.setSession(session);
      } catch (bindErr: unknown) {
        const msg = bindErr instanceof Error ? bindErr.message : String(bindErr);
        appendLog(`Initial setSession threw: ${msg}. Retrying with XRWebGLLayer...`, '#ff7b72');
        if (typeof XRWebGLBinding !== 'undefined' && 'createProjectionLayer' in XRWebGLBinding.prototype) {
          delete (XRWebGLBinding.prototype as unknown as { createProjectionLayer?: unknown }).createProjectionLayer;
        }
        await world.renderer.xr.setSession(session);
      }

      w.session = session;
      statusLine.textContent = `● XR Session Running (${mode})`;
      statusLine.style.color = '#7ee787';
      appendLog('Session successfully running! Presenting virtual scene.', '#7ee787');

      session.addEventListener('end', () => {
        restoreProjectionLayer();
      });
    } catch (err: unknown) {
      restoreProjectionLayer();
      statusLine.textContent = `✕ Session Failed`;
      statusLine.style.color = '#ff7b72';
      const name = err instanceof Error ? err.name : 'Error';
      const msg = err instanceof Error ? err.message : String(err);
      appendLog(`Launch failed: ${name}: ${msg}`, '#ff7b72');
      console.error('[XR Direct Launch Error]', err);
      title?.setBusy(false);
      showNote("Couldn't start VR. Reload the page and press BEGIN again.");
      showLaunchLog?.();
    }
  };

  const vrSupported = await xr.isSessionSupported('immersive-vr').catch(() => false);

  appendLog(`XR Support: immersive-vr=${vrSupported}`);

  // Without VR support the title is not shown, so the no-XR notice (no-xr-notice.ts) stays readable.
  if (vrSupported) {
    title = createTitleScreen(
      [
        {
          label: 'BEGIN',
          begin: true,
          onPress: () => {
            void launchDirect('immersive-vr');
          },
        },
        { label: 'SETTINGS', onPress: () => hooks.openSettings?.() },
      ],
      {
        onReach: () => sound?.hover(),
        onPressed: (item) => (item.begin ? sound?.begin() : sound?.press()),
        // Five taps on the emblem step capture mode (demo video) through off, clean and sharp, and reload to apply it.
        onEmblemTaps: () => {
          saveCaptureChoice(nextCapture(loadCaptureChoice()));
          location.reload();
        },
      },
    );
    // The title covers the whole page, so the 3D scene behind it is not drawn until the session starts (it used to be drawn
    // every frame behind the title, which doubled the title's frame time in a desktop test).
    world.scene.visible = false;
    const choice = loadCaptureChoice();
    if (captureOptions(choice).enabled) title.setNote(`Capture mode: ${choice}. Five taps on the flame change it.`);
  }

  // The launch log and its copy button, shown when BEGIN fails. A debug tool: only when DEBUG_TOOLS is on (the dev server or
  // a `--mode tester` build), never in the judges' build. The developer switches are in the room (developer-page.ts).
  if (DEBUG_TOOLS) {
    logBox.style.display = 'none';
    buttonRow.style.display = 'none';
    uiContainer.append(logBox);
    buttonRow.append(
      makeBtn('📋 Copy logs', '#2b2410', '#e3b341', '#9e6a03', async () => {
        try {
          await navigator.clipboard.writeText(logs.join('\n'));
          appendLog('Logs copied to clipboard!', '#7ee787');
        } catch {
          appendLog('Clipboard write blocked. Select and copy from log box.', '#e3b341');
        }
      }),
    );
    showLaunchLog = () => {
      logBox.style.display = 'block';
      buttonRow.style.display = 'flex';
    };
  }
  uiContainer.append(note, buttonRow);
  document.body.append(uiContainer);

  // A session can start a few milliseconds after BEGIN (the emulator): the title stays up, fading, until it is black. The
  // count makes a hide meant for an earlier session do nothing.
  let sessions = 0;
  world.renderer.xr.addEventListener('sessionstart', () => {
    const which = ++sessions;
    uiContainer.style.display = 'none';
    world.scene.visible = true;
    const wait = Math.max(0, pressedAt + TITLE_FADE_MS - performance.now());
    setTimeout(() => {
      if (which !== sessions || !world.renderer.xr.isPresenting) return;
      title?.setVisible(false);
      hooks.titleGone?.();
    }, wait);
  });
  world.renderer.xr.addEventListener('sessionend', () => {
    sessions++;
    pressedAt = -Infinity;
    uiContainer.style.display = 'flex';
    title?.setVisible(true);
    title?.setBusy(false);
    if (title) world.scene.visible = false;
    statusLine.textContent = '● XR Session Ended';
    statusLine.style.color = '#8b949e';
    appendLog('XR session ended.', '#8b949e');
    const w = world as unknown as { sessionRequestPending?: boolean; session?: XRSession };
    w.session = undefined;
    w.sessionRequestPending = false;
    world.renderer.xr.enabled = false;
  });
}
