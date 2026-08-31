(() => {
  'use strict';

  const DB_NAME = 'nbaLogoBattleDB';
  const DB_VERSION = 1;
  const SPORTS = ['NBA', 'MLB', 'NFL', 'NHL', 'MLS'];
  const DEFAULT_SPORT = 'NBA';
  const sportByLogoId = new Map();

  function normalizeSport(value) {
    return SPORTS.includes(value) ? value : DEFAULT_SPORT;
  }

  // Keep sport values intact even when the main app saves a logo from an
  // in-memory object that predates a sport dropdown change.
  const originalPut = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function patchedLogoPut(value, key) {
    if (this.name === 'logos' && value && typeof value === 'object' && value.id) {
      const rememberedSport = sportByLogoId.get(String(value.id));
      const sport = normalizeSport(rememberedSport || value.sport);
      sportByLogoId.set(String(value.id), sport);
      const nextValue = { ...value, sport };
      return arguments.length > 1
        ? originalPut.call(this, nextValue, key)
        : originalPut.call(this, nextValue);
    }

    return arguments.length > 1
      ? originalPut.call(this, value, key)
      : originalPut.call(this, value);
  };

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

  async function getAllLogos() {
    const db = await openDb();
    try {
      return await requestResult(db.transaction('logos', 'readonly').objectStore('logos').getAll());
    } finally {
      db.close();
    }
  }

  async function saveSport(logoId, sport) {
    const normalizedSport = normalizeSport(sport);
    sportByLogoId.set(String(logoId), normalizedSport);

    const db = await openDb();
    try {
      const store = db.transaction('logos', 'readwrite').objectStore('logos');
      const logo = await requestResult(store.get(logoId));
      if (!logo) return;
      await requestResult(store.put({
        ...logo,
        sport: normalizedSport,
        updatedAt: new Date().toISOString(),
      }));
    } finally {
      db.close();
    }
  }

  function ensureStyles() {
    if (document.getElementById('logoSportFieldStyles')) return;
    const style = document.createElement('style');
    style.id = 'logoSportFieldStyles';
    style.textContent = `
      .logo-sport-field {
        display: grid;
        gap: 5px;
        min-width: 0;
      }
      .logo-sport-field > span {
        color: var(--muted);
        font-size: .78rem;
        font-weight: 800;
        letter-spacing: .02em;
      }
      .logo-sport-select {
        width: 100%;
        min-width: 0;
      }
    `;
    document.head.appendChild(style);
  }

  function setSaveStatus(message) {
    const status = document.getElementById('saveStatus');
    if (!status) return;
    status.textContent = message;
    status.classList.add('flash');
    clearTimeout(setSaveStatus.timer);
    setSaveStatus.timer = setTimeout(() => status.classList.remove('flash'), 1400);
  }

  async function addSportFields() {
    const cards = Array.from(document.querySelectorAll('#logoGrid .logo-card, #retiredGrid .logo-card'));
    if (!cards.length) return;

    const logos = await getAllLogos();
    const logoByImage = new Map();

    for (const logo of logos) {
      const sport = normalizeSport(logo.sport);
      sportByLogoId.set(String(logo.id), sport);
      logoByImage.set(logo.imageDataUrl, logo);

      if (logo.sport !== sport) {
        saveSport(logo.id, sport).catch(error => console.error('Failed to initialize logo sport:', error));
      }
    }

    for (const card of cards) {
      if (card.querySelector('.logo-sport-field')) continue;

      const img = card.querySelector('.logo-frame img');
      const years = card.querySelector('.logo-years');
      if (!img || !years) continue;

      const logo = logoByImage.get(img.getAttribute('src'));
      if (!logo) continue;

      const label = document.createElement('label');
      label.className = 'logo-sport-field';
      label.innerHTML = `
        <span>Sport</span>
        <select class="input logo-sport-select" aria-label="Sport for ${String(logo.name || 'logo').replace(/"/g, '&quot;')}">
          ${SPORTS.map(sport => `<option value="${sport}"${sport === normalizeSport(logo.sport) ? ' selected' : ''}>${sport}</option>`).join('')}
        </select>
      `;

      const select = label.querySelector('select');
      select.addEventListener('change', async () => {
        const previousSport = sportByLogoId.get(String(logo.id)) || DEFAULT_SPORT;
        const nextSport = normalizeSport(select.value);
        select.disabled = true;
        try {
          await saveSport(logo.id, nextSport);
          setSaveStatus('Sport saved');
        } catch (error) {
          sportByLogoId.set(String(logo.id), previousSport);
          select.value = previousSport;
          console.error('Failed to save logo sport:', error);
          alert('The logo sport could not be saved. Please try again.');
        } finally {
          select.disabled = false;
        }
      });

      years.insertAdjacentElement('afterend', label);
    }
  }

  function scheduleSportFields() {
    clearTimeout(scheduleSportFields.timer);
    scheduleSportFields.timer = setTimeout(() => {
      addSportFields().catch(error => console.error('Failed to render logo sport fields:', error));
    }, 0);
  }

  ensureStyles();

  document.addEventListener('DOMContentLoaded', () => {
    scheduleSportFields();

    const observer = new MutationObserver(scheduleSportFields);
    const logoGrid = document.getElementById('logoGrid');
    const retiredGrid = document.getElementById('retiredGrid');
    if (logoGrid) observer.observe(logoGrid, { childList: true, subtree: true });
    if (retiredGrid) observer.observe(retiredGrid, { childList: true, subtree: true });
  });

  const clipboardUploader = document.createElement('script');
  clipboardUploader.src = 'clipboard-upload.js?v=20260831-paste-images';
  document.head.appendChild(clipboardUploader);

  if (document.readyState === 'loading') {
    document.write('<script src="year-century-override.js?v=20260831-force-19xx"><\/script>');
    document.write('<script src="matchup-sport-pool.js?v=20260831-sport-pool"><\/script>');
  } else {
    const yearCenturyOverride = document.createElement('script');
    yearCenturyOverride.src = 'year-century-override.js?v=20260831-force-19xx';
    document.head.appendChild(yearCenturyOverride);

    const matchupSportPool = document.createElement('script');
    matchupSportPool.src = 'matchup-sport-pool.js?v=20260831-sport-pool';
    document.head.appendChild(matchupSportPool);
  }
})();
