// If the game cannot start (the world fails to build, a critical asset will not load), the page is otherwise
// blank and the only trace is the debug log, which a release build hides. This puts a plain message on the
// page with a Reload button, in the same style as the no-headset notice. It runs only when start() failed.

/** One line for the small print under the message: the error's name and message, trimmed. Never throws. */
export function startFailureDetail(error: unknown): string {
  let text: string;
  try {
    text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  } catch {
    text = 'unprintable error';
  }
  return text.length > 200 ? `${text.slice(0, 197)}...` : text;
}

export function showStartFailure(error: unknown): void {
  const box = document.createElement('section');
  box.setAttribute('role', 'alert');
  box.style.cssText =
    'position:fixed;inset:0;display:grid;place-items:center;padding:24px;z-index:10000;' +
    'background:#14161c;color:#ece6d8;font:16px/1.55 system-ui,-apple-system,sans-serif;text-align:center';

  const inner = document.createElement('div');
  inner.style.cssText = 'max-width:30rem;display:grid;gap:14px;justify-items:center';

  const title = document.createElement('h1');
  title.style.cssText = 'margin:0;font-size:28px;font-weight:650;letter-spacing:-0.01em';
  title.textContent = 'Where Shadows Wander';

  const text = document.createElement('p');
  text.style.cssText = 'margin:0';
  text.textContent = "The game couldn't start. Reloading the page usually fixes it.";

  const reload = document.createElement('button');
  reload.type = 'button';
  reload.textContent = 'Reload';
  reload.style.cssText =
    'font:inherit;font-weight:600;padding:10px 22px;border-radius:10px;border:0;cursor:pointer;' +
    'background:#f0a24a;color:#14161c';
  reload.addEventListener('click', () => location.reload());

  const detail = document.createElement('p');
  detail.style.cssText = 'margin:0;color:#a8a294;font-size:13px;word-break:break-word';
  detail.textContent = startFailureDetail(error);

  inner.append(title, text, reload, detail);
  box.append(inner);
  document.body.append(box);
}
