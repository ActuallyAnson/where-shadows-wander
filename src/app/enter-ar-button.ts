import type { World } from '@iwsdk/core';

export async function mountEnterArButtonIfNeeded(world: World): Promise<void> {
  const xr = navigator.xr;
  if (!xr) {
    console.warn('[Launcher] navigator.xr is not available');
    return;
  }

  // Live log buffer for on-screen inspection
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
    'width:100%;max-height:160px;overflow-y:auto;background:rgba(15,18,24,0.95);' +
    'border:1px solid #3a4459;border-radius:10px;padding:10px 14px;font:11px/1.45 ui-monospace,monospace;' +
    'color:#c9d1d9;box-sizing:border-box;pointer-events:auto;box-shadow:0 8px 24px rgba(0,0,0,0.5);';

  const statusLine = document.createElement('div');
  statusLine.style.cssText = 'font-weight:700;color:#58a6ff;margin-bottom:6px;font-size:12px;';
  statusLine.textContent = '● WebXR Launcher Ready';
  logBox.append(statusLine);

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

  // Direct clean launch function
  const launchDirect = async (mode: XRSessionMode, forceWebGLLayer: boolean) => {
    statusLine.textContent = `● Launching ${mode}...`;
    statusLine.style.color = '#e3b341';
    appendLog(`Requesting ${mode} session (forceWebGLLayer: ${forceWebGLLayer})...`, '#e3b341');

    try {
      const w = world as unknown as { sessionRequestPending?: boolean; session?: XRSession };
      w.sessionRequestPending = false;

      if (forceWebGLLayer) {
        if (typeof XRWebGLBinding !== 'undefined' && 'createProjectionLayer' in XRWebGLBinding.prototype) {
          appendLog('Bypassing createProjectionLayer to force XRWebGLLayer', '#d2a8ff');
          delete (XRWebGLBinding.prototype as unknown as { createProjectionLayer?: unknown }).createProjectionLayer;
        }
      }

      const session = await xr.requestSession(mode, {
        optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
      });
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
    } catch (err: unknown) {
      statusLine.textContent = `✕ Session Failed`;
      statusLine.style.color = '#ff7b72';
      const name = err instanceof Error ? err.name : 'Error';
      const msg = err instanceof Error ? err.message : String(err);
      appendLog(`Launch failed: ${name}: ${msg}`, '#ff7b72');
      console.error('[XR Direct Launch Error]', err);
    }
  };

  const [arSupported, vrSupported] = await Promise.all([
    xr.isSessionSupported('immersive-ar').catch(() => false),
    xr.isSessionSupported('immersive-vr').catch(() => false),
  ]);

  appendLog(`XR Support: immersive-vr=${vrSupported}, immersive-ar=${arSupported}`);

  if (vrSupported) {
    const vrDirectBtn = makeBtn('▶ Enter VR (Direct Hands)', '#163824', '#3fb950', '#2ea043', () => {
      void launchDirect('immersive-vr', false);
    });
    buttonRow.append(vrDirectBtn);

    const vrSafeBtn = makeBtn('🛡️ Enter VR (Safe WebGL)', '#1c2d42', '#58a6ff', '#388bfd', () => {
      void launchDirect('immersive-vr', true);
    });
    buttonRow.append(vrSafeBtn);
  }

  if (arSupported) {
    const arDirectBtn = makeBtn('👁️ Enter AR (Passthrough)', '#3b2300', '#f0883e', '#d29922', () => {
      void launchDirect('immersive-ar', false);
    });
    buttonRow.append(arDirectBtn);
  }

  const iwsdkBtn = makeBtn('⚡ Enter via IWSDK', '#2d1840', '#bc8cff', '#a371f7', () => {
    statusLine.textContent = '● Launching via IWSDK...';
    statusLine.style.color = '#bc8cff';
    appendLog('Calling world.launchXR({ sessionMode: "immersive-vr", features: { handTracking: true } })...');
    try {
      world.launchXR({
        sessionMode: 'immersive-vr' as unknown as import('@iwsdk/core').SessionMode,
        features: { handTracking: true },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      appendLog(`IWSDK launch threw: ${msg}`, '#ff7b72');
    }
  });
  buttonRow.append(iwsdkBtn);

  // Copy logs button
  const copyBtn = makeBtn('📋 Copy Logs', '#21262d', '#c9d1d9', '#30363d', async () => {
    try {
      await navigator.clipboard.writeText(logs.join('\n'));
      appendLog('Logs copied to clipboard!', '#7ee787');
    } catch {
      appendLog('Clipboard write blocked. Select and copy from log box.', '#e3b341');
    }
  });
  buttonRow.append(copyBtn);

  uiContainer.append(logBox, buttonRow);
  document.body.append(uiContainer);

  world.renderer.xr.addEventListener('sessionstart', () => {
    uiContainer.style.display = 'none';
  });
  world.renderer.xr.addEventListener('sessionend', () => {
    uiContainer.style.display = 'flex';
    statusLine.textContent = '● XR Session Ended';
    statusLine.style.color = '#8b949e';
    appendLog('XR session ended.', '#8b949e');
  });
}
