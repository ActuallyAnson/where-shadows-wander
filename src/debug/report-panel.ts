// The "Copy report" panel on the 2D page. The XR session's report is shown
// here after the tester leaves XR (DOM isn't visible inside immersive-ar).
import { Diagnostics } from './diagnostics';

/**
 * Adds a small "Copy report" panel to the 2D page. It shows the latest saved
 * report (from this or an earlier visit) so a remote tester can paste it to us.
 */
export function mountReportPanel(diagnostics: Diagnostics): void {
  const panel = document.createElement('div');
  panel.style.cssText =
    'position:fixed;left:12px;bottom:12px;z-index:10;font:14px system-ui,sans-serif;color:#111;' +
    'background:#fffbe9;border:1px solid #c9b77a;border-radius:8px;padding:10px;max-width:min(560px,calc(100vw - 48px))';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap';
  const copy = button('Copy report');
  const toggle = button('Show');
  const status = document.createElement('span');
  status.style.cssText = 'font-size:12px;color:#555';
  const text = document.createElement('textarea');
  text.readOnly = true;
  text.style.cssText =
    'display:none;width:100%;height:220px;margin-top:8px;font:11px ui-monospace,monospace;box-sizing:border-box';
  row.append(copy, toggle, status);
  panel.append(row, text);
  document.body.append(panel);

  // Always this page's report (so startup errors show). If this page hasn't run
  // a session yet, also attach the last saved one, e.g. from before a reload.
  const refresh = () => {
    diagnostics.save();
    const report = diagnostics.snapshot();
    const saved = diagnostics.hasSession ? null : Diagnostics.loadSaved();
    if (saved) report.previousSession = JSON.parse(saved);
    text.value = JSON.stringify(report, null, 2);
  };
  toggle.onclick = () => {
    const show = text.style.display === 'none';
    if (show) refresh();
    text.style.display = show ? 'block' : 'none';
    toggle.textContent = show ? 'Hide' : 'Show';
  };
  copy.onclick = async () => {
    refresh();
    try {
      await navigator.clipboard.writeText(text.value);
      status.textContent = 'Copied. Paste it into the chat.';
      return;
    } catch {
      // Clipboard API may be blocked; fall back to a selection the tester can copy.
    }
    text.style.display = 'block';
    toggle.textContent = 'Hide';
    text.select();
    const ok = document.execCommand?.('copy');
    status.textContent = ok ? 'Copied. Paste it into the chat.' : 'Select all the text below and copy it.';
  };
}

function button(label: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.style.cssText =
    'font:inherit;padding:8px 14px;border-radius:6px;border:1px solid #8a7a45;background:#fff;cursor:pointer';
  return b;
}
