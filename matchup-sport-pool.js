(() => {
  'use strict';

  const SPORTS = ['NBA', 'MLB', 'NFL', 'NHL', 'MLS'];
  const DB_NAME = 'nbaLogoBattleDB';
  const DB_VERSION = 1;
  const META_KEY = 'matchupSports';
  let selectedSports = new Set(SPORTS);

  function normalizeSports(value) {
    const values = Array.isArray(value) ? value.filter(sport => SPORTS.includes(sport)) : [];
    return values.length ? [...new Set(values)] : [...SPORTS];
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function getSavedSports() {
    const db = await openDb();
    try {
      const store = db.transaction('meta', 'readonly').objectStore('meta');
      const row = await requestResult(store.get(META_KEY));
      return normalizeSports(row?.value);
    } finally {
      db.close();
    }
  }

  async function saveSelectedSports() {
    const value = [...selectedSports];
    const db = await openDb();
    try {
      const store = db.transaction('meta', 'readwrite').objectStore('meta');
      await requestResult(store.put({ key: META_KEY, value }));
    } finally {
      db.close();
    }
  }

  function normalizeLogoSport(value) {
    return SPORTS.includes(value) ? value : 'NBA';
  }

  function isBattleStack() {
    const stack = new Error().stack || '';
    return /\b(generateBattle|ensureBattle|renderBattle|renderBattleShell)\b/.test(stack);
  }

  // Preserve the app's normal active-logo behavior everywhere except the Battle
  // flow. When Battle asks for active logos, narrow that result to the selected
  // sport pool. All leaderboard/team/year/tier/manage behavior stays unchanged.
  const originalFilter = Array.prototype.filter;
  Array.prototype.filter = function matchupSportFilter(callback, thisArg) {
    const result = originalFilter.call(this, callback, thisArg);
    if (!isBattleStack() || !result.length) return result;

    const looksLikeLogoList = result.every(item => item && typeof item === 'object' && 'imageDataUrl' in item && 'retired' in item);
    if (!looksLikeLogoList) return result;

    return originalFilter.call(result, logo => selectedSports.has(normalizeLogoSport(logo.sport)));
  };

  function ensureStyles() {
    if (document.getElementById('matchupSportPoolStyles')) return;
    const style = document.createElement('style');
    style.id = 'matchupSportPoolStyles';
    style.textContent = `
      .matchup-sport-pool { position: relative; }
      .matchup-sport-pool-button {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        white-space: nowrap;
      }
      .matchup-sport-pool-button::after {
        content: '▾';
        font-size: .78em;
        opacity: .8;
      }
      .matchup-sport-pool-menu {
        position: absolute;
        z-index: 30;
        top: calc(100% + 8px);
        right: 0;
        min-width: 190px;
        padding: 8px;
        border: 1px solid var(--line);
        border-radius: 14px;
        background: #0f1722;
        box-shadow: var(--shadow);
      }
      .matchup-sport-pool-menu[hidden] { display: none; }
      .matchup-sport-option {
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 42px;
        padding: 8px 10px;
        border-radius: 10px;
        color: var(--text);
        font-weight: 700;
        cursor: pointer;
      }
      .matchup-sport-option:hover { background: rgba(255,255,255,.055); }
      .matchup-sport-option input {
        width: 18px;
        height: 18px;
        margin: 0;
        accent-color: var(--teal);
      }
      @media (max-width: 760px) {
        .matchup-sport-pool { flex: 1 1 auto; }
        .matchup-sport-pool-button { width: 100%; justify-content: center; }
        .matchup-sport-pool-menu { left: 0; right: auto; min-width: 100%; }
      }
    `;
    document.head.appendChild(style);
  }

  function buttonLabel() {
    if (selectedSports.size === SPORTS.length) return 'Sports: All';
    if (selectedSports.size === 1) return `Sport: ${[...selectedSports][0]}`;
    return `Sports: ${selectedSports.size}`;
  }

  function updateButtonLabel(button) {
    button.textContent = buttonLabel();
    button.setAttribute('aria-label', `${buttonLabel()}. Choose sports included in matchups.`);
  }

  function regenerateBattle() {
    const skipButton = document.getElementById('skipBtn');
    if (skipButton) skipButton.click();
  }

  function buildPoolControl() {
    const actions = document.querySelector('#battleReady .toolbar-actions');
    if (!actions || actions.querySelector('.matchup-sport-pool')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'matchup-sport-pool';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ghost-btn matchup-sport-pool-button';
    button.setAttribute('aria-haspopup', 'true');
    button.setAttribute('aria-expanded', 'false');
    updateButtonLabel(button);

    const menu = document.createElement('div');
    menu.className = 'matchup-sport-pool-menu';
    menu.hidden = true;

    for (const sport of SPORTS) {
      const label = document.createElement('label');
      label.className = 'matchup-sport-option';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = sport;
      checkbox.checked = selectedSports.has(sport);

      const text = document.createElement('span');
      text.textContent = sport;
      label.append(checkbox, text);
      menu.appendChild(label);

      checkbox.addEventListener('change', async () => {
        if (checkbox.checked) {
          selectedSports.add(sport);
        } else if (selectedSports.size === 1) {
          checkbox.checked = true;
          return;
        } else {
          selectedSports.delete(sport);
        }

        updateButtonLabel(button);
        await saveSelectedSports().catch(error => console.error('Failed to save matchup sport pool:', error));
        regenerateBattle();
      });
    }

    button.addEventListener('click', event => {
      event.stopPropagation();
      menu.hidden = !menu.hidden;
      button.setAttribute('aria-expanded', String(!menu.hidden));
    });

    menu.addEventListener('click', event => event.stopPropagation());
    document.addEventListener('click', () => {
      menu.hidden = true;
      button.setAttribute('aria-expanded', 'false');
    });

    wrapper.append(button, menu);
    actions.prepend(wrapper);
  }

  ensureStyles();

  document.addEventListener('DOMContentLoaded', async () => {
    selectedSports = new Set(await getSavedSports().catch(() => SPORTS));
    buildPoolControl();

    // The app generates an initial battle during startup. Regenerate once after
    // the persisted pool has loaded so the first visible matchup respects it.
    requestAnimationFrame(() => regenerateBattle());
  });
})();
