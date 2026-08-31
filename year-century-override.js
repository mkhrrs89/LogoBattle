(() => {
  'use strict';

  const DB_NAME = 'nbaLogoBattleDB';
  const DB_VERSION = 1;
  const LOGO_YEAR_PIVOT = 30;
  const force1900ByLogoId = new Map();
  let logoGridObserver = null;
  let yearGridObserver = null;
  let teamGridObserver = null;
  let renderingYearView = false;
  let patchingTeamGrid = false;

  function normalizeLogoYear(value) {
    return String(value ?? '').replace(/\D/g, '').slice(0, 2);
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function isForced1900(logo) {
    return force1900ByLogoId.has(String(logo.id))
      ? force1900ByLogoId.get(String(logo.id))
      : Boolean(logo.force1900);
  }

  function effectiveRange(logo) {
    const startValue = normalizeLogoYear(logo.startYear);
    const endValue = normalizeLogoYear(logo.endYear);
    if (startValue.length !== 2 || endValue.length !== 2) return null;

    const startShort = Number(startValue);
    const endShort = Number(endValue);

    if (isForced1900(logo)) {
      const startYear = 1900 + startShort;
      const endYear = 1900 + endShort;
      return endYear >= startYear ? { startYear, endYear } : null;
    }

    const startYear = (startShort >= LOGO_YEAR_PIVOT ? 1900 : 2000) + startShort;
    let endYear = Math.floor(startYear / 100) * 100 + endShort;
    if (endYear < startYear) endYear += 100;
    return { startYear, endYear };
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

  async function getAllLogos() {
    const db = await openDb();
    try {
      return await requestResult(db.transaction('logos', 'readonly').objectStore('logos').getAll());
    } finally {
      db.close();
    }
  }

  async function saveForce1900(logoId, enabled) {
    const normalized = Boolean(enabled);
    force1900ByLogoId.set(String(logoId), normalized);

    const db = await openDb();
    try {
      const store = db.transaction('logos', 'readwrite').objectStore('logos');
      const logo = await requestResult(store.get(logoId));
      if (!logo) return;
      await requestResult(store.put({
        ...logo,
        force1900: normalized,
        updatedAt: new Date().toISOString(),
      }));
    } finally {
      db.close();
    }
  }

  // Preserve the toggle whenever the main app later saves an older in-memory
  // copy of a logo that does not yet contain the force1900 property.
  const previousPut = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function patchedYearOverridePut(value, key) {
    if (this.name === 'logos' && value && typeof value === 'object' && value.id) {
      const id = String(value.id);
      const forced = force1900ByLogoId.has(id)
        ? force1900ByLogoId.get(id)
        : Boolean(value.force1900);
      force1900ByLogoId.set(id, forced);
      const nextValue = { ...value, force1900: forced };
      return arguments.length > 1
        ? previousPut.call(this, nextValue, key)
        : previousPut.call(this, nextValue);
    }

    return arguments.length > 1
      ? previousPut.call(this, value, key)
      : previousPut.call(this, value);
  };

  // Include the override in backups even if the main app's in-memory logo
  // object was loaded before the toggle was changed.
  const originalStringify = JSON.stringify;
  JSON.stringify = function patchedStringify(value, ...rest) {
    if (value && value.app === 'nba-logo-battle' && Array.isArray(value.logos)) {
      const patched = {
        ...value,
        logos: value.logos.map(logo => ({
          ...logo,
          force1900: force1900ByLogoId.has(String(logo.id))
            ? force1900ByLogoId.get(String(logo.id))
            : Boolean(logo.force1900),
        })),
      };
      return originalStringify.call(this, patched, ...rest);
    }
    return originalStringify.call(this, value, ...rest);
  };

  // Remember imported override flags before the main app normalizes each logo.
  const originalParse = JSON.parse;
  JSON.parse = function patchedParse(text, ...rest) {
    const value = originalParse.call(this, text, ...rest);
    if (value && value.app === 'nba-logo-battle' && Array.isArray(value.logos)) {
      value.logos.forEach(logo => {
        if (logo?.id) force1900ByLogoId.set(String(logo.id), Boolean(logo.force1900));
      });
    }
    return value;
  };

  function setSaveStatus(message) {
    const status = document.getElementById('saveStatus');
    if (!status) return;
    status.textContent = message;
    status.classList.add('flash');
    clearTimeout(setSaveStatus.timer);
    setSaveStatus.timer = setTimeout(() => status.classList.remove('flash'), 1400);
  }

  function ensureStyles() {
    if (document.getElementById('logoCenturyOverrideStyles')) return;
    const style = document.createElement('style');
    style.id = 'logoCenturyOverrideStyles';
    style.textContent = `
      .logo-century-override {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 8px;
        width: max-content;
        max-width: 100%;
        min-height: 34px;
        padding: 5px 9px;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: rgba(255,255,255,.035);
        color: var(--muted);
        font-size: .78rem;
        font-weight: 900;
        cursor: pointer;
        user-select: none;
      }
      .logo-century-override input {
        width: 16px;
        height: 16px;
        margin: 0;
        accent-color: var(--teal);
      }
      .logo-century-override:has(input:checked) {
        color: var(--teal);
        border-color: rgba(22,199,197,.45);
        background: rgba(22,199,197,.09);
      }
    `;
    document.head.appendChild(style);
  }

  function imageKey(img) {
    return img?.getAttribute('src') || img?.src || '';
  }

  async function addCenturyToggles() {
    const cards = Array.from(document.querySelectorAll('#logoGrid .logo-card, #retiredGrid .logo-card'));
    if (!cards.length) return;

    const logos = await getAllLogos();
    const logoByImage = new Map();
    logos.forEach(logo => {
      force1900ByLogoId.set(String(logo.id), Boolean(logo.force1900));
      logoByImage.set(logo.imageDataUrl, logo);
    });

    for (const card of cards) {
      if (card.querySelector('.logo-century-override')) continue;

      const img = card.querySelector('.logo-frame img');
      const years = card.querySelector('.logo-years');
      if (!img || !years) continue;

      const logo = logoByImage.get(imageKey(img));
      if (!logo) continue;

      const label = document.createElement('label');
      label.className = 'logo-century-override';
      label.title = 'Force both two-digit year fields to use the 1900s';
      label.innerHTML = `
        <input type="checkbox" ${isForced1900(logo) ? 'checked' : ''} aria-label="Force ${escapeHtml(logo.name)} years to 19XX" />
        <span>19XX</span>
      `;

      const checkbox = label.querySelector('input');
      checkbox.addEventListener('change', async () => {
        const previous = isForced1900(logo);
        checkbox.disabled = true;
        try {
          await saveForce1900(logo.id, checkbox.checked);
          logo.force1900 = checkbox.checked;
          setSaveStatus(checkbox.checked ? '19XX override on' : '19XX override off');
          await renderYearView();
          await patchTeamLogoGrid();

          if (!hasAnyOverride()) {
            const yearSelect = document.getElementById('logoYearSelect');
            yearSelect?.dispatchEvent(new Event('change', { bubbles: true }));
            const teamSort = document.getElementById('teamLogoSort');
            if (teamSort?.value === 'date') teamSort.dispatchEvent(new Event('change', { bubbles: true }));
          }
        } catch (error) {
          force1900ByLogoId.set(String(logo.id), previous);
          checkbox.checked = previous;
          console.error('Failed to save 19XX override:', error);
          alert('The 19XX override could not be saved. Please try again.');
        } finally {
          checkbox.disabled = false;
        }
      });

      years.insertAdjacentElement('afterend', label);
    }
  }

  function hasAnyOverride() {
    return Array.from(force1900ByLogoId.values()).some(Boolean);
  }

  function applyFrameShape(frame, img) {
    const update = () => {
      if (!img.naturalWidth || !img.naturalHeight) return;
      const portrait = img.naturalHeight > img.naturalWidth;
      frame.classList.toggle('portrait', portrait);
      if (portrait) frame.style.setProperty('--logo-frame-aspect', `${img.naturalWidth} / ${img.naturalHeight}`);
      else frame.style.removeProperty('--logo-frame-aspect');
    };
    if (img.complete) update();
    else img.addEventListener('load', update, { once: true });
  }

  function observeYearGrid() {
    const grid = document.getElementById('logosByYearGrid');
    if (!grid || !yearGridObserver) return;
    yearGridObserver.observe(grid, { childList: true, subtree: true });
  }

  async function renderYearView() {
    if (renderingYearView || !hasAnyOverride()) return;

    const select = document.getElementById('logoYearSelect');
    const toggle = document.getElementById('logoOnlyYearToggle');
    const summary = document.getElementById('logosByYearSummary');
    const grid = document.getElementById('logosByYearGrid');
    if (!select || !toggle || !summary || !grid) return;

    renderingYearView = true;
    yearGridObserver?.disconnect();

    try {
      const logos = await getAllLogos();
      const entries = logos.map(logo => ({ logo, range: effectiveRange(logo) })).filter(entry => entry.range);
      const incompleteCount = logos.filter(logo => normalizeLogoYear(logo.startYear).length !== 2 || normalizeLogoYear(logo.endYear).length !== 2).length;
      const invalidForcedCount = logos.filter(logo => {
        if (!isForced1900(logo)) return false;
        const start = normalizeLogoYear(logo.startYear);
        const end = normalizeLogoYear(logo.endYear);
        return start.length === 2 && end.length === 2 && Number(end) < Number(start);
      }).length;

      summary.classList.toggle('hidden', toggle.checked);
      grid.classList.toggle('logo-only', toggle.checked);
      select.innerHTML = '';
      grid.innerHTML = '';

      if (!entries.length) {
        select.disabled = true;
        select.innerHTML = '<option value="">No years entered</option>';
        summary.innerHTML = '<div><strong>No complete year ranges yet</strong><span>Add both a Start year and End year to logos in Manage Logos.</span></div>';
        grid.innerHTML = '<div class="card stack"><h2>No logos to show</h2><p>Once year ranges are entered, this tab will build the dropdown automatically.</p></div>';
        return;
      }

      const earliest = Math.min(...entries.map(entry => entry.range.startYear));
      const latest = Math.max(...entries.map(entry => entry.range.endYear));
      const years = Array.from({ length: latest - earliest + 1 }, (_, index) => latest - index);
      const previousSelected = Number(select.dataset.overrideSelectedYear || select.value);
      const currentYear = new Date().getFullYear();
      const selectedYear = years.includes(previousSelected)
        ? previousSelected
        : (years.includes(currentYear) ? currentYear : years[0]);
      select.dataset.overrideSelectedYear = String(selectedYear);
      select.disabled = false;

      years.forEach(year => {
        const option = document.createElement('option');
        option.value = String(year);
        option.textContent = String(year);
        option.selected = year === selectedYear;
        select.appendChild(option);
      });

      const matching = entries
        .filter(entry => selectedYear >= entry.range.startYear && selectedYear <= entry.range.endYear)
        .sort((a, b) => {
          const teamDiff = String(a.logo.franchise || '').localeCompare(String(b.logo.franchise || ''));
          return teamDiff || String(a.logo.name || '').localeCompare(String(b.logo.name || ''));
        });

      const teamCount = new Set(matching.map(entry => entry.logo.franchise)).size;
      const notes = [];
      if (incompleteCount) notes.push(`${incompleteCount} ${incompleteCount === 1 ? 'logo is' : 'logos are'} omitted until both year fields are filled in.`);
      if (invalidForcedCount) notes.push(`${invalidForcedCount} 19XX ${invalidForcedCount === 1 ? 'range ends' : 'ranges end'} before the start year.`);

      summary.innerHTML = `
        <div class="logos-by-year-count">
          <strong>${matching.length}</strong>
          <span>${matching.length === 1 ? 'logo' : 'logos'} across ${teamCount} ${teamCount === 1 ? 'team' : 'teams'} in ${selectedYear}</span>
        </div>
        ${notes.length ? `<span class="logos-by-year-note">${notes.map(escapeHtml).join(' ')}</span>` : ''}
      `;

      if (!matching.length) {
        grid.innerHTML = `<div class="card stack"><h2>No logos found for ${selectedYear}</h2><p>Check the Start and End year fields in Manage Logos.</p></div>`;
        return;
      }

      for (const { logo, range } of matching) {
        const card = document.createElement('article');
        card.className = toggle.checked ? 'logo-only-year-item' : 'card logo-card logo-by-year-card';
        card.innerHTML = toggle.checked
          ? `<div class="logo-frame"><img src="${logo.imageDataUrl}" alt="${escapeHtml(logo.name)}"></div>`
          : `
            <div class="logo-frame"><img src="${logo.imageDataUrl}" alt="${escapeHtml(logo.name)}"></div>
            <div>
              <h3>${escapeHtml(logo.name)}</h3>
              <p>${escapeHtml(logo.franchise)}</p>
            </div>
            <span class="logo-use-range">${range.startYear}–${range.endYear}</span>
          `;
        const frame = card.querySelector('.logo-frame');
        const img = card.querySelector('img');
        applyFrameShape(frame, img);
        grid.appendChild(card);
      }
    } finally {
      renderingYearView = false;
      observeYearGrid();
    }
  }

  function observeTeamGrid() {
    const grid = document.getElementById('teamLogoGrid');
    if (!grid || !teamGridObserver) return;
    teamGridObserver.observe(grid, { childList: true, subtree: true });
  }

  async function patchTeamLogoGrid() {
    if (patchingTeamGrid || !hasAnyOverride()) return;
    const grid = document.getElementById('teamLogoGrid');
    if (!grid || !grid.children.length) return;

    patchingTeamGrid = true;
    teamGridObserver?.disconnect();
    try {
      const logos = await getAllLogos();
      const byImage = new Map(logos.map(logo => [logo.imageDataUrl, logo]));
      const children = Array.from(grid.children);

      for (const card of children) {
        const img = card.querySelector('.logo-frame img');
        const logo = byImage.get(imageKey(img));
        if (!logo) continue;
        const badge = card.querySelector('.logo-use-range');
        const range = effectiveRange(logo);
        if (badge) badge.textContent = range ? `${range.startYear}–${range.endYear}` : 'Years incomplete';
        card.dataset.effectiveStartYear = range ? String(range.startYear) : '9999';
        card.dataset.effectiveEndYear = range ? String(range.endYear) : '9999';
        card.dataset.logoNameForDateSort = String(logo.name || '');
      }

      const sort = document.getElementById('teamLogoSort');
      if (sort?.value === 'date') {
        children.sort((a, b) => {
          const startDiff = Number(a.dataset.effectiveStartYear || 9999) - Number(b.dataset.effectiveStartYear || 9999);
          if (startDiff) return startDiff;
          const endDiff = Number(a.dataset.effectiveEndYear || 9999) - Number(b.dataset.effectiveEndYear || 9999);
          if (endDiff) return endDiff;
          return String(a.dataset.logoNameForDateSort || '').localeCompare(String(b.dataset.logoNameForDateSort || ''));
        });
        children.forEach(card => grid.appendChild(card));
      }
    } finally {
      patchingTeamGrid = false;
      observeTeamGrid();
    }
  }

  function scheduleManageToggles() {
    clearTimeout(scheduleManageToggles.timer);
    scheduleManageToggles.timer = setTimeout(() => {
      addCenturyToggles().catch(error => console.error('Failed to render 19XX toggles:', error));
    }, 0);
  }

  function scheduleYearView() {
    clearTimeout(scheduleYearView.timer);
    scheduleYearView.timer = setTimeout(() => {
      renderYearView().catch(error => console.error('Failed to render overridden year view:', error));
    }, 0);
  }

  function scheduleTeamPatch() {
    clearTimeout(scheduleTeamPatch.timer);
    scheduleTeamPatch.timer = setTimeout(() => {
      patchTeamLogoGrid().catch(error => console.error('Failed to patch team logo years:', error));
    }, 0);
  }

  ensureStyles();

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const logos = await getAllLogos();
      logos.forEach(logo => force1900ByLogoId.set(String(logo.id), Boolean(logo.force1900)));
    } catch (error) {
      console.error('Failed to initialize 19XX overrides:', error);
    }

    scheduleManageToggles();
    scheduleYearView();
    scheduleTeamPatch();

    logoGridObserver = new MutationObserver(scheduleManageToggles);
    const logoGrid = document.getElementById('logoGrid');
    const retiredGrid = document.getElementById('retiredGrid');
    if (logoGrid) logoGridObserver.observe(logoGrid, { childList: true, subtree: true });
    if (retiredGrid) logoGridObserver.observe(retiredGrid, { childList: true, subtree: true });

    yearGridObserver = new MutationObserver(scheduleYearView);
    observeYearGrid();

    teamGridObserver = new MutationObserver(scheduleTeamPatch);
    observeTeamGrid();

    document.getElementById('logoYearSelect')?.addEventListener('change', event => {
      event.currentTarget.dataset.overrideSelectedYear = event.currentTarget.value;
      scheduleYearView();
    });
    document.getElementById('logoOnlyYearToggle')?.addEventListener('change', scheduleYearView);
    document.getElementById('teamLogoSort')?.addEventListener('change', scheduleTeamPatch);
    document.getElementById('logoOnlyTeamToggle')?.addEventListener('change', scheduleTeamPatch);

    document.addEventListener('change', event => {
      if (event.target?.matches?.('.logo-year-input')) {
        setTimeout(() => {
          scheduleYearView();
          scheduleTeamPatch();
        }, 30);
      }
    });
  });
})();
