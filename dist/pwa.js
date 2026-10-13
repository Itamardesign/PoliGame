// PWA: service worker registration + the home screen "download the app" button.
// Self-contained (injects its own button and styles) so the home markup can change freely.
const standalone = () =>
  matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone === true;
const ios =
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let deferred = null;
let button = null;

if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferred = event;
});

addEventListener('appinstalled', () => {
  deferred = null;
  button?.remove();
});

const CSS = `
.install-app {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  min-height: 48px;
  margin-top: 10px;
  padding: 0 20px;
  border: 0;
  border-radius: var(--radius, 10px);
  background: rgb(255 255 255 / 0.08);
  color: var(--text, #f2f4f7);
  box-shadow: inset 0 0 0 1px var(--line-strong, rgb(255 255 255 / 0.24));
  font: inherit;
  font-weight: 800;
  font-size: 16px;
  cursor: pointer;
  transition: background 0.15s, transform 0.12s;
}
.install-app:hover { background: rgb(255 255 255 / 0.14); }
.install-app:active { transform: translateY(1px); }
.install-app img { width: 28px; height: 28px; border-radius: 7px; }
.install-app svg { width: 20px; height: 20px; color: var(--gold, #f2c14e); }
.install-help { text-align: center; }
.install-help > img { border-radius: 18px; box-shadow: 0 6px 20px rgb(0 0 0 / 0.35); }
.install-help ol { text-align: start; padding-inline-start: 1.4em; }
`;

function showHelp() {
  const steps = ios
    ? `<ol>
        <li>פתחו את המשחק בדפדפן <b>Safari</b>.</li>
        <li>הקישו על כפתור <b>השיתוף</b> <span aria-hidden="true">⬆︎</span>.</li>
        <li>בחרו <b>"הוספה למסך הבית"</b> ואשרו.</li>
      </ol>`
    : `<ol>
        <li>פתחו את תפריט הדפדפן <span aria-hidden="true">⋮</span>.</li>
        <li>בחרו <b>"התקנת אפליקציה"</b> או <b>"הוספה למסך הבית"</b>.</li>
        <li>אשרו — האייקון יופיע במסך הבית.</li>
      </ol>`;
  document.getElementById('infoContent').innerHTML = `
    <div class="install-help">
      <img src="./icons/icon-192.png" alt="" width="72" height="72" />
      <h2>הורדת קואליציה קארט</h2>
      <p>מתקינים פעם אחת, משחקים במסך מלא — גם בלי אינטרנט.</p>
      ${steps}
    </div>`;
  document.getElementById('info').showModal();
}

async function install() {
  if (!deferred) return showHelp();
  deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  if (outcome === 'accepted') button.remove();
}

function mount() {
  if (standalone()) return;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);

  button = document.createElement('button');
  button.id = 'installApp';
  button.type = 'button';
  button.className = 'install-app';
  button.innerHTML = `
    <img src="./icons/icon-192.png" alt="" />
    <span>הורדת האפליקציה</span>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>`;
  button.addEventListener('click', install);

  // Sit right under the main play buttons; fall back to the end of the home screen.
  const anchor = document.querySelector('.cta-buttons') || document.getElementById('play');
  if (anchor) anchor.after(button);
  else document.getElementById('home')?.append(button);
}

mount();
