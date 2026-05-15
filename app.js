(() => {
  'use strict';

  const DB_NAME = 'nbaLogoBattleDB';
  const DB_VERSION = 1;
  const MAX_SIZE = 800;
  const BACKUP_VERSION = 1;

  let db;
  let state = {
    logos: [],
    currentBattle: [],
    lastVote: null,
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const els = {
    saveStatus: $('#saveStatus'),
    tabButtons: $$('.tab-btn'),
    panels: $$('.tab-panel'),
    battleEmpty: $('#battleEmpty'),
    battleReady: $('#battleReady'),
    battleCards: $('#battleCards'),
    skipBtn: $('#skipBtn'),
    undoBtn: $('#undoBtn'),
    uploadInput: $('#uploadInput'),
    emptyUploadInput: $('#emptyUploadInput'),
    dropZone: $('#dropZone'),
    uploadProgress: $('#uploadProgress'),
    uploadProgressText: $('#uploadProgress .progress-text'),
    uploadProgressBar: $('#uploadProgress .progress-bar span'),
    leaderboardBody: $('#leaderboardBody'),
    leaderboardSearch: $('#leaderboardSearch'),
    leaderboardFranchise: $('#leaderboardFranchise'),
    globalStats: $('#globalStats'),
    manageSearch: $('#manageSearch'),
    manageFranchise: $('#manageFranchise'),
    logoGrid: $('#logoGrid'),
    showRetiredBtn: $('#showRetiredBtn'),
    retiredDialog: $('#retiredDialog'),
    closeRetiredBtn: $('#closeRetiredBtn'),
    retiredGrid: $('#retiredGrid'),
    editDialog: $('#editDialog'),
    editForm: $('#editForm'),
    editLogoId: $('#editLogoId'),
    editName: $('#editName'),
    editFranchise: $('#editFranchise'),
    cancelEditBtn: $('#cancelEditBtn'),
    exportBtn: $('#exportBtn'),
    importInput: $('#importInput'),
    resetAllStatsBtn: $('#resetAllStatsBtn'),
  };

  const franchiseAliases = new Map(Object.entries({
    hawks: 'Atlanta Hawks', atlanta: 'Atlanta Hawks', stlouis_hawks: 'St. Louis Hawks', milwaukee_hawks: 'Milwaukee Hawks', tri_cities: 'Tri-Cities Blackhawks', blackhawks: 'Tri-Cities Blackhawks',
    celtics: 'Boston Celtics', boston: 'Boston Celtics',
    nets: 'Brooklyn Nets', brooklyn: 'Brooklyn Nets', new_jersey: 'New Jersey Nets', nj_nets: 'New Jersey Nets', new_york_nets: 'New York Nets',
    hornets: 'Charlotte Hornets', charlotte: 'Charlotte Hornets', bobcats: 'Charlotte Bobcats',
    bulls: 'Chicago Bulls', chicago: 'Chicago Bulls',
    cavaliers: 'Cleveland Cavaliers', cavs: 'Cleveland Cavaliers', cleveland: 'Cleveland Cavaliers',
    mavericks: 'Dallas Mavericks', mavs: 'Dallas Mavericks', dallas: 'Dallas Mavericks',
    nuggets: 'Denver Nuggets', denver: 'Denver Nuggets', rockets: 'Houston Rockets', houston: 'Houston Rockets',
    pistons: 'Detroit Pistons', detroit: 'Detroit Pistons', fort_wayne: 'Fort Wayne Pistons',
    warriors: 'Golden State Warriors', golden_state: 'Golden State Warriors', san_francisco_warriors: 'San Francisco Warriors', philadelphia_warriors: 'Philadelphia Warriors',
    pacers: 'Indiana Pacers', indiana: 'Indiana Pacers',
    clippers: 'Los Angeles Clippers', la_clippers: 'Los Angeles Clippers', buffalo_braves: 'Buffalo Braves', braves: 'Buffalo Braves', san_diego_clippers: 'San Diego Clippers',
    lakers: 'Los Angeles Lakers', la_lakers: 'Los Angeles Lakers', minneapolis_lakers: 'Minneapolis Lakers',
    grizzlies: 'Memphis Grizzlies', memphis: 'Memphis Grizzlies', vancouver_grizzlies: 'Vancouver Grizzlies',
    heat: 'Miami Heat', miami: 'Miami Heat',
    bucks: 'Milwaukee Bucks', milwaukee: 'Milwaukee Bucks',
    timberwolves: 'Minnesota Timberwolves', wolves: 'Minnesota Timberwolves', minnesota: 'Minnesota Timberwolves',
    pelicans: 'New Orleans Pelicans', new_orleans: 'New Orleans Pelicans', no_pelicans: 'New Orleans Pelicans', hornets_new_orleans: 'New Orleans Hornets',
    knicks: 'New York Knicks', new_york_knicks: 'New York Knicks', ny_knicks: 'New York Knicks',
    thunder: 'Oklahoma City Thunder', okc: 'Oklahoma City Thunder', sonics: 'Seattle SuperSonics', supersonics: 'Seattle SuperSonics', seattle: 'Seattle SuperSonics',
    magic: 'Orlando Magic', orlando: 'Orlando Magic',
    sixers: 'Philadelphia 76ers', '76ers': 'Philadelphia 76ers', philadelphia_76ers: 'Philadelphia 76ers', syracuse_nationals: 'Syracuse Nationals', nationals: 'Syracuse Nationals',
    suns: 'Phoenix Suns', phoenix: 'Phoenix Suns',
    blazers: 'Portland Trail Blazers', trail_blazers: 'Portland Trail Blazers', portland: 'Portland Trail Blazers',
    kings: 'Sacramento Kings', sacramento: 'Sacramento Kings', kansas_city_kings: 'Kansas City Kings', cincinnati_royals: 'Cincinnati Royals', rochester_royals: 'Rochester Royals', royals: 'Cincinnati Royals',
    spurs: 'San Antonio Spurs', san_antonio: 'San Antonio Spurs', chaparrals: 'Dallas Chaparrals', dallas_chaparrals: 'Dallas Chaparrals', texas_chaparrals: 'Texas Chaparrals',
    raptors: 'Toronto Raptors', toronto: 'Toronto Raptors',
    jazz: 'Utah Jazz', utah: 'Utah Jazz', new_orleans_jazz: 'New Orleans Jazz',
    wizards: 'Washington Wizards', washington: 'Washington Wizards', bullets: 'Washington Bullets', baltimore_bullets: 'Baltimore Bullets', capitols: 'Washington Capitols',
    colonels: 'Kentucky Colonels', kentucky: 'Kentucky Colonels',
    spirits: 'Spirits of St. Louis', spirits_of_st_louis: 'Spirits of St. Louis',
    floridians: 'The Floridians', miami_floridians: 'The Floridians',
    squire: 'Virginia Squires', squires: 'Virginia Squires', virginia_squires: 'Virginia Squires',
    stars: 'Utah Stars', utah_stars: 'Utah Stars', los_angeles_stars: 'Los Angeles Stars', anaheim_amigos: 'Anaheim Amigos', amigos: 'Anaheim Amigos',
    pacifics: 'Pittsburgh Pipers', pipers: 'Pittsburgh Pipers', pittsburgh_pipers: 'Pittsburgh Pipers', condors: 'Pittsburgh Condors',
    muskies: 'Minnesota Muskies', miami_floridians_aba: 'Miami Floridians',
  }));

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const nextDb = request.result;
        if (!nextDb.objectStoreNames.contains('logos')) {
          nextDb.createObjectStore('logos', { keyPath: 'id' });
        }
        if (!nextDb.objectStoreNames.contains('meta')) {
          nextDb.createObjectStore('meta', { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function tx(storeName, mode = 'readonly') {
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  function promisifyRequest(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function getAllLogos() {
    return promisifyRequest(tx('logos').getAll());
  }

  async function saveLogo(logo) {
    await promisifyRequest(tx('logos', 'readwrite').put(logo));
  }

  async function deleteLogoRecord(id) {
    await promisifyRequest(tx('logos', 'readwrite').delete(id));
  }

  async function getMeta(key, fallback = null) {
    const row = await promisifyRequest(tx('meta').get(key));
    return row ? row.value : fallback;
  }

  async function setMeta(key, value) {
    await promisifyRequest(tx('meta', 'readwrite').put({ key, value }));
  }

  async function clearStore(storeName) {
    await promisifyRequest(tx(storeName, 'readwrite').clear());
  }

  async function refreshState() {
    state.logos = await getAllLogos();
    state.lastVote = await getMeta('lastVote', null);
    renderAll();
  }

  function activeLogos() {
    return state.logos.filter(l => !l.retired);
  }

  function retiredLogos() {
    return state.logos.filter(l => l.retired);
  }

  function recordText(logo) {
    const battles = logo.wins + logo.losses;
    return `${logo.wins}–${logo.losses} · ${winPct(logo)}%`;
  }

  function winPct(logo) {
    const total = logo.wins + logo.losses;
    return total ? ((logo.wins / total) * 100).toFixed(1) : '0.0';
  }

  function cleanFileName(fileName) {
    return fileName
      .replace(/\.[^.]+$/, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  function keyify(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  function detectFranchise(fileName) {
    const raw = keyify(fileName.replace(/\.[^.]+$/, ''));
    const pieces = raw.split('_').filter(Boolean);
    const candidates = new Set([raw]);

    for (let i = 0; i < pieces.length; i++) {
      for (let len = 1; len <= Math.min(4, pieces.length - i); len++) {
        candidates.add(pieces.slice(i, i + len).join('_'));
      }
    }

    for (const candidate of candidates) {
      if (franchiseAliases.has(candidate)) return franchiseAliases.get(candidate);
    }

    return 'Unknown Franchise';
  }

  function id() {
    return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function showStatus(message = 'Saved') {
    els.saveStatus.textContent = message;
    els.saveStatus.classList.add('flash');
    clearTimeout(showStatus.timer);
    showStatus.timer = setTimeout(() => els.saveStatus.classList.remove('flash'), 1400);
  }

  function showProgress(current, total, label = 'Processing') {
    els.uploadProgress.classList.remove('hidden');
    els.uploadProgressText.textContent = `${label} ${current} of ${total} logos...`;
    els.uploadProgressBar.style.width = `${total ? (current / total) * 100 : 0}%`;
  }

  function hideProgress() {
    els.uploadProgress.classList.add('hidden');
    els.uploadProgressBar.style.width = '0%';
  }

  async function resizeImage(file) {
    const bitmap = await createImageBitmap(file);
    const ratio = Math.min(1, MAX_SIZE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * ratio));
    const height = Math.max(1, Math.round(bitmap.height * ratio));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise(resolve => {
      canvas.toBlob(resolve, 'image/webp', 0.9);
    }) || await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

    const dataUrl = await blobToDataUrl(blob);
    const hash = await hashBlob(blob);
    bitmap.close?.();

    return { dataUrl, hash, width, height, mimeType: blob.type || 'image/png', size: blob.size };
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  async function hashBlob(blob) {
    const buffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function handleFiles(fileList) {
    const files = Array.from(fileList).filter(file => file.type.startsWith('image/'));
    if (!files.length) return;

    const existing = await getAllLogos();
    const existingNames = new Set(existing.map(l => l.originalFileNameKey).filter(Boolean));
    const existingHashes = new Set(existing.map(l => l.imageHash).filter(Boolean));
    let added = 0;
    let skipped = 0;
    let failed = 0;
    const batchNames = new Set();
    const batchHashes = new Set();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      showProgress(i + 1, files.length);
      await waitForPaint();

      const nameKey = keyify(file.name);
      if (existingNames.has(nameKey) || batchNames.has(nameKey)) {
        skipped++;
        continue;
      }

      try {
        const resized = await resizeImage(file);
        if (existingHashes.has(resized.hash) || batchHashes.has(resized.hash)) {
          skipped++;
          continue;
        }

        const logo = {
          id: id(),
          name: cleanFileName(file.name),
          franchise: detectFranchise(file.name),
          originalFileName: file.name,
          originalFileNameKey: nameKey,
          imageDataUrl: resized.dataUrl,
          imageHash: resized.hash,
          mimeType: resized.mimeType,
          width: resized.width,
          height: resized.height,
          compressedSize: resized.size,
          wins: 0,
          losses: 0,
          retired: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await saveLogo(logo);
        existingNames.add(nameKey);
        existingHashes.add(resized.hash);
        batchNames.add(nameKey);
        batchHashes.add(resized.hash);
        added++;
      } catch (error) {
        console.error('Failed to process image:', file.name, error);
        failed++;
      }
    }

    hideProgress();
    await refreshState();
    ensureBattle();
    showStatus(`Upload complete: ${added} added, ${skipped} duplicates skipped${failed ? `, ${failed} failed` : ''}`);
  }

  function waitForPaint() {
    return new Promise(resolve => requestAnimationFrame(() => resolve()));
  }

  function weightedPick(pool, excludeId = null) {
    const candidates = pool.filter(l => l.id !== excludeId);
    if (!candidates.length) return null;

    const weights = candidates.map(l => 1 / Math.pow((l.wins + l.losses) + 1, 1.45));
    const total = weights.reduce((sum, w) => sum + w, 0);
    let roll = Math.random() * total;

    for (let i = 0; i < candidates.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return candidates[i];
    }
    return candidates[candidates.length - 1];
  }

  function generateBattle() {
    const pool = activeLogos();
    if (pool.length < 2) {
      state.currentBattle = [];
      return;
    }
    const first = weightedPick(pool);
    const second = weightedPick(pool, first.id);
    state.currentBattle = [first, second];
    renderBattle();
  }

  function ensureBattle() {
    const ids = new Set(activeLogos().map(l => l.id));
    if (state.currentBattle.length !== 2 || !state.currentBattle.every(l => ids.has(l.id))) {
      generateBattle();
    } else {
      renderBattle();
    }
  }

  async function vote(winnerId, loserId) {
    const winner = state.logos.find(l => l.id === winnerId);
    const loser = state.logos.find(l => l.id === loserId);
    if (!winner || !loser) return;

    winner.wins += 1;
    loser.losses += 1;
    winner.updatedAt = loser.updatedAt = new Date().toISOString();
    await saveLogo(winner);
    await saveLogo(loser);

    state.lastVote = { winnerId, loserId, at: new Date().toISOString() };
    await setMeta('lastVote', state.lastVote);

    state.logos = await getAllLogos();
    generateBattle();
    renderAllExceptBattle();
  }

  async function undoLastVote() {
    const last = state.lastVote || await getMeta('lastVote', null);
    if (!last) return;
    const winner = state.logos.find(l => l.id === last.winnerId);
    const loser = state.logos.find(l => l.id === last.loserId);
    if (winner && loser) {
      winner.wins = Math.max(0, winner.wins - 1);
      loser.losses = Math.max(0, loser.losses - 1);
      winner.updatedAt = loser.updatedAt = new Date().toISOString();
      await saveLogo(winner);
      await saveLogo(loser);
    }
    state.lastVote = null;
    await setMeta('lastVote', null);
    state.logos = await getAllLogos();
    renderAll();
    showStatus('Last vote undone');
  }

  function sortRanked(logos) {
    return [...logos].sort((a, b) => {
      const pctDiff = Number(winPct(b)) - Number(winPct(a));
      if (pctDiff) return pctDiff;
      const battlesDiff = (b.wins + b.losses) - (a.wins + a.losses);
      if (battlesDiff) return battlesDiff;
      const winsDiff = b.wins - a.wins;
      if (winsDiff) return winsDiff;
      return a.name.localeCompare(b.name);
    });
  }

  function renderAll() {
    renderBattleShell();
    renderBattle();
    renderLeaderboardFilters();
    renderLeaderboard();
    renderManageFilters();
    renderManageGrid();
    renderRetiredGrid();
    els.undoBtn.disabled = !state.lastVote;
  }

  function renderAllExceptBattle() {
    renderLeaderboardFilters();
    renderLeaderboard();
    renderManageFilters();
    renderManageGrid();
    renderRetiredGrid();
    els.undoBtn.disabled = !state.lastVote;
  }

  function renderBattleShell() {
    const count = activeLogos().length;
    els.battleEmpty.classList.toggle('hidden', count > 0);
    els.battleReady.classList.toggle('hidden', count === 0);
  }

  function renderBattle() {
    renderBattleShell();
    els.battleCards.innerHTML = '';
    els.undoBtn.disabled = !state.lastVote;

    if (activeLogos().length < 2) {
      if (activeLogos().length === 1) {
        els.battleCards.innerHTML = '<div class="card stack"><h2>Need one more logo</h2><p>Upload at least two active logos to start battles.</p></div>';
      }
      return;
    }

    if (state.currentBattle.length !== 2) generateBattle();

    const template = $('#battleCardTemplate');
    for (const logo of state.currentBattle) {
      const clone = template.content.cloneNode(true);
      const btn = $('.battle-card', clone);
      const img = $('img', clone);
      const title = $('h2', clone);
      const franchise = $('.franchise', clone);
      const record = $('.record', clone);

      img.src = logo.imageDataUrl;
      img.alt = logo.name;
      title.textContent = logo.name;
      franchise.textContent = logo.franchise;
      record.textContent = recordText(logo);

      const opponent = state.currentBattle.find(l => l.id !== logo.id);
      btn.addEventListener('click', () => vote(logo.id, opponent.id));
      els.battleCards.appendChild(clone);
    }
  }

  function uniqueFranchises(logos = activeLogos()) {
    return [...new Set(logos.map(l => l.franchise).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }

  function fillFranchiseSelect(select, logos, allLabel = 'All franchises') {
    const current = select.value;
    select.innerHTML = `<option value="">${allLabel}</option>`;
    for (const f of uniqueFranchises(logos)) {
      const opt = document.createElement('option');
      opt.value = f;
      opt.textContent = f;
      select.appendChild(opt);
    }
    if ([...select.options].some(o => o.value === current)) select.value = current;
  }

  function renderLeaderboardFilters() {
    fillFranchiseSelect(els.leaderboardFranchise, activeLogos());
  }

  function renderLeaderboard() {
    const query = els.leaderboardSearch.value.trim().toLowerCase();
    const franchise = els.leaderboardFranchise.value;
    const filtered = activeLogos().filter(l => {
      const matchesSearch = !query || `${l.name} ${l.franchise}`.toLowerCase().includes(query);
      const matchesFranchise = !franchise || l.franchise === franchise;
      return matchesSearch && matchesFranchise;
    });
    const ranked = sortRanked(filtered);

    renderGlobalStats(activeLogos());

    els.leaderboardBody.innerHTML = '';
    if (!ranked.length) {
      els.leaderboardBody.innerHTML = '<tr><td colspan="7" class="muted">No active logos match this view.</td></tr>';
      return;
    }

    ranked.forEach((logo, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${index + 1}</td>
        <td><div class="logo-frame thumb"><img src="${logo.imageDataUrl}" alt="${escapeHtml(logo.name)}"></div></td>
        <td><strong>${escapeHtml(logo.name)}</strong></td>
        <td>${escapeHtml(logo.franchise)}</td>
        <td>${logo.wins}–${logo.losses}</td>
        <td>${winPct(logo)}%</td>
        <td>${logo.wins + logo.losses}</td>
      `;
      els.leaderboardBody.appendChild(tr);
    });
  }

  function renderGlobalStats(logos) {
    const ranked = sortRanked(logos);
    const totalBattles = logos.reduce((sum, l) => sum + l.wins + l.losses, 0) / 2;
    const top = ranked[0]?.name || '—';
    const worst = ranked.length ? ranked[ranked.length - 1].name : '—';
    const cards = [
      ['Active Logos', logos.length],
      ['Total Battles', Math.floor(totalBattles)],
      ['Current #1', top],
      ['Lowest Ranked', worst],
    ];
    els.globalStats.innerHTML = cards.map(([label, value]) => `
      <div class="card stat-card">
        <div class="stat-label">${escapeHtml(label)}</div>
        <div class="stat-value">${escapeHtml(String(value))}</div>
      </div>
    `).join('');
  }

  function renderManageFilters() {
    fillFranchiseSelect(els.manageFranchise, activeLogos());
  }

  function renderManageGrid() {
    const query = els.manageSearch.value.trim().toLowerCase();
    const franchise = els.manageFranchise.value;
    const logos = sortRanked(activeLogos()).filter(l => {
      const matchesSearch = !query || `${l.name} ${l.franchise}`.toLowerCase().includes(query);
      const matchesFranchise = !franchise || l.franchise === franchise;
      return matchesSearch && matchesFranchise;
    });

    els.logoGrid.innerHTML = '';
    if (!logos.length) {
      els.logoGrid.innerHTML = '<div class="card stack"><h2>No active logos found</h2><p>Upload logos or adjust your filters.</p></div>';
      return;
    }

    for (const logo of logos) {
      els.logoGrid.appendChild(logoCard(logo, false));
    }
  }

  function renderRetiredGrid() {
    const logos = sortRanked(retiredLogos());
    els.retiredGrid.innerHTML = '';
    if (!logos.length) {
      els.retiredGrid.innerHTML = '<div class="card stack"><h2>No retired logos</h2><p>Retired logos will appear here.</p></div>';
      return;
    }
    for (const logo of logos) {
      els.retiredGrid.appendChild(logoCard(logo, true));
    }
  }

  function logoCard(logo, retiredView) {
    const card = document.createElement('article');
    card.className = 'card logo-card';
    card.innerHTML = `
      <div class="logo-frame"><img src="${logo.imageDataUrl}" alt="${escapeHtml(logo.name)}"></div>
      <div>
        <h3>${escapeHtml(logo.name)}</h3>
        <p>${escapeHtml(logo.franchise)}</p>
        <p>${logo.wins}–${logo.losses} · ${winPct(logo)}% · ${logo.wins + logo.losses} battles</p>
      </div>
      <div class="logo-actions"></div>
    `;
    const actions = $('.logo-actions', card);

    if (retiredView) {
      actions.append(
        button('Replace Image', 'ghost-btn full', () => promptReplaceImage(logo.id)),
        button('Restore', 'primary-btn full', () => restoreLogo(logo.id)),
      );
      return card;
    }

    actions.append(
      button('Edit', 'ghost-btn', () => openEdit(logo)),
      button('Replace Image', 'ghost-btn', () => promptReplaceImage(logo.id)),
      button('Retire', 'ghost-btn', () => retireLogo(logo.id)),
      button('Reset Stats', 'danger-btn full', () => resetLogoStats(logo.id)),
    );
    return card;
  }

  function promptReplaceImage(logoId) {
    const picker = document.createElement('input');
    picker.type = 'file';
    picker.accept = 'image/*';
    picker.addEventListener('change', async () => {
      const file = picker.files?.[0];
      if (!file) return;
      await replaceLogoImage(logoId, file);
    }, { once: true });
    picker.click();
  }

  async function replaceLogoImage(logoId, file) {
    if (!file || !file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }

    const logo = state.logos.find(l => l.id === logoId);
    if (!logo) {
      alert('Logo not found.');
      return;
    }

    try {
      const resized = await resizeImage(file);
      const duplicate = state.logos.find(l => l.imageHash && l.imageHash === resized.hash);
      if (duplicate && duplicate.id !== logoId) {
        const ok = confirm('This image appears to match another logo already in the app. Replace anyway?');
        if (!ok) return;
      } else if (duplicate && duplicate.id === logoId) {
        const sameOk = confirm('This appears to be the same image. Replace anyway?');
        if (!sameOk) return;
      }

      const updatedLogo = {
        ...logo,
        imageDataUrl: resized.dataUrl,
        imageHash: resized.hash,
        mimeType: resized.mimeType,
        width: resized.width,
        height: resized.height,
        compressedSize: resized.size,
        originalFileName: file.name || logo.originalFileName,
        originalFileNameKey: file.name ? keyify(file.name) : logo.originalFileNameKey,
        updatedAt: new Date().toISOString(),
      };

      await saveLogo(updatedLogo);
      await refreshState();
      ensureBattle();
      showStatus('Image replaced. Stats preserved.');
    } catch (error) {
      console.error('Failed to replace image:', file?.name, error);
      alert('Image replacement failed. Your existing logo image was not changed.');
    }
  }

  function button(text, className, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = text;
    btn.className = className;
    btn.addEventListener('click', onClick);
    return btn;
  }

  function openEdit(logo) {
    els.editLogoId.value = logo.id;
    els.editName.value = logo.name;
    els.editFranchise.value = logo.franchise;
    els.editDialog.showModal();
  }

  async function saveEdit(event) {
    event.preventDefault();
    const logo = state.logos.find(l => l.id === els.editLogoId.value);
    if (!logo) return;
    logo.name = els.editName.value.trim() || logo.name;
    logo.franchise = els.editFranchise.value.trim() || 'Unknown Franchise';
    logo.updatedAt = new Date().toISOString();
    await saveLogo(logo);
    els.editDialog.close();
    await refreshState();
    showStatus('Saved');
  }

  async function retireLogo(id) {
    const logo = state.logos.find(l => l.id === id);
    if (!logo) return;
    const hasStats = logo.wins + logo.losses > 0;
    const message = hasStats
      ? `Retire ${logo.name}? It has stats, but they will be preserved in the Retired Archive.`
      : `Retire ${logo.name}?`;
    if (!confirm(message)) return;
    logo.retired = true;
    logo.updatedAt = new Date().toISOString();
    await saveLogo(logo);
    if (state.currentBattle.some(l => l.id === id)) state.currentBattle = [];
    await refreshState();
    ensureBattle();
    showStatus('Logo retired');
  }

  async function restoreLogo(id) {
    const logo = state.logos.find(l => l.id === id);
    if (!logo) return;
    logo.retired = false;
    logo.updatedAt = new Date().toISOString();
    await saveLogo(logo);
    await refreshState();
    ensureBattle();
    showStatus('Logo restored');
  }

  async function resetLogoStats(id) {
    const logo = state.logos.find(l => l.id === id);
    if (!logo) return;
    if (!confirm(`Reset stats for ${logo.name} back to 0–0?`)) return;
    logo.wins = 0;
    logo.losses = 0;
    logo.updatedAt = new Date().toISOString();
    await saveLogo(logo);
    state.lastVote = null;
    await setMeta('lastVote', null);
    await refreshState();
    showStatus('Stats reset');
  }

  async function resetAllStats() {
    const first = confirm('Reset ALL logo stats back to 0–0? Images and franchises will stay saved.');
    if (!first) return;
    const second = confirm('Are you absolutely sure? This cannot be undone unless you imported/exported a backup.');
    if (!second) return;

    for (const logo of state.logos) {
      logo.wins = 0;
      logo.losses = 0;
      logo.updatedAt = new Date().toISOString();
      await saveLogo(logo);
    }
    state.lastVote = null;
    await setMeta('lastVote', null);
    await refreshState();
    generateBattle();
    showStatus('All stats reset');
  }

  function exportBackup() {
    const payload = {
      app: 'nba-logo-battle',
      backupVersion: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      logos: state.logos,
      meta: { lastVote: state.lastVote },
    };
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nba-logo-battle-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showStatus('Backup exported');
  }

  async function importBackup(file) {
    if (!file) return;
    const ok = confirm('Importing this backup will replace ALL current app data. Continue?');
    if (!ok) return;

    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      if (!payload || payload.app !== 'nba-logo-battle' || !Array.isArray(payload.logos)) {
        alert('This does not look like a valid NBA Logo Battle backup file.');
        return;
      }

      await clearStore('logos');
      await clearStore('meta');
      for (const logo of payload.logos) {
        await saveLogo(normalizeImportedLogo(logo));
      }
      await setMeta('lastVote', payload.meta?.lastVote || null);
      await refreshState();
      generateBattle();
      showStatus('Backup imported successfully');
    } catch (error) {
      console.error(error);
      alert('Import failed. The backup file may be damaged or invalid.');
    } finally {
      els.importInput.value = '';
    }
  }

  function normalizeImportedLogo(logo) {
    return {
      id: logo.id || id(),
      name: logo.name || 'Untitled Logo',
      franchise: logo.franchise || 'Unknown Franchise',
      originalFileName: logo.originalFileName || logo.name || 'unknown',
      originalFileNameKey: logo.originalFileNameKey || keyify(logo.originalFileName || logo.name || ''),
      imageDataUrl: logo.imageDataUrl,
      imageHash: logo.imageHash || '',
      mimeType: logo.mimeType || 'image/webp',
      width: logo.width || null,
      height: logo.height || null,
      compressedSize: logo.compressedSize || null,
      wins: Number.isFinite(logo.wins) ? logo.wins : 0,
      losses: Number.isFinite(logo.losses) ? logo.losses : 0,
      retired: Boolean(logo.retired),
      createdAt: logo.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function bindEvents() {
    els.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        els.tabButtons.forEach(b => b.classList.toggle('active', b === btn));
        els.panels.forEach(panel => panel.classList.toggle('active', panel.id === btn.dataset.tab));
        if (btn.dataset.tab === 'battle') ensureBattle();
      });
    });

    els.uploadInput.addEventListener('change', e => handleFiles(e.target.files).finally(() => { e.target.value = ''; }));
    els.emptyUploadInput.addEventListener('change', e => handleFiles(e.target.files).finally(() => { e.target.value = ''; }));

    ['dragenter', 'dragover'].forEach(eventName => {
      els.dropZone.addEventListener(eventName, e => {
        e.preventDefault();
        els.dropZone.classList.add('dragging');
      });
    });
    ['dragleave', 'drop'].forEach(eventName => {
      els.dropZone.addEventListener(eventName, e => {
        e.preventDefault();
        els.dropZone.classList.remove('dragging');
      });
    });
    els.dropZone.addEventListener('drop', e => handleFiles(e.dataTransfer.files));

    els.skipBtn.addEventListener('click', generateBattle);
    els.undoBtn.addEventListener('click', undoLastVote);

    els.leaderboardSearch.addEventListener('input', renderLeaderboard);
    els.leaderboardFranchise.addEventListener('change', renderLeaderboard);
    els.manageSearch.addEventListener('input', renderManageGrid);
    els.manageFranchise.addEventListener('change', renderManageGrid);

    els.editForm.addEventListener('submit', saveEdit);
    els.cancelEditBtn.addEventListener('click', () => els.editDialog.close());
    els.showRetiredBtn.addEventListener('click', () => {
      renderRetiredGrid();
      els.retiredDialog.showModal();
    });
    els.closeRetiredBtn.addEventListener('click', () => els.retiredDialog.close());

    els.exportBtn.addEventListener('click', exportBackup);
    els.importInput.addEventListener('change', e => importBackup(e.target.files[0]));
    els.resetAllStatsBtn.addEventListener('click', resetAllStats);
  }

  async function init() {
    db = await openDb();
    bindEvents();
    await refreshState();
    generateBattle();
    showStatus('Ready');
  }

  init().catch(error => {
    console.error(error);
    alert('The app failed to start. Check the browser console for details.');
  });
})();
