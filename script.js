/**
 * Layout modes:
 *  Mobile  < 768px — single-column, bottom nav drives all three views
 *  Desktop ≥ 768px — two-column; Now Playing always left;
 *                    header nav Equaliser / Tracklist on right
 */

'use strict';

const DESKTOP_BP = 768;   


const AUDIUS_HOST = 'https://discoveryprovider.audius.co';
const AUDIUS_API = `${AUDIUS_HOST}/v1/tracks/search?query=Drake&limit=20&app_name=Nocturne`;
const ITUNES_API  = 'https://itunes.apple.com/search?term=hip+hop+rap&entity=song&limit=20&country=us';


const BAR_COUNT_MINI  = 24;
const BAR_COUNT_LARGE = 48;

const state = {
  playlist:     [],
  currentIndex: 0,
  isPlaying:    false,
  isShuffle:    false,
  isRepeat:     false,
  prevVolume:   0.8,
  
  activeView:   'tracklist',
};

function isDesktop() {
  return window.innerWidth >= DESKTOP_BP;
}

const appEl         = document.getElementById('app');
const audio         = document.getElementById('audio-element');

// Header
const hdrIndicator  = document.getElementById('hdr-indicator');

// Now Playing
const coverArt      = document.getElementById('cover-art');
const npCoverWrap   = document.getElementById('np-cover-wrap');
const songTitle     = document.getElementById('song-title');
const songArtist    = document.getElementById('song-artist');
const songAlbum     = document.getElementById('song-album');
const npMeta        = document.getElementById('np-meta');

// Controls
const btnPlay       = document.getElementById('btn-play');
const playIcon      = document.getElementById('play-icon');
const btnPrev       = document.getElementById('btn-prev');
const btnNext       = document.getElementById('btn-next');
const btnShuffle    = document.getElementById('btn-shuffle');
const btnRepeat     = document.getElementById('btn-repeat');
const btnMute       = document.getElementById('btn-mute');
const volIcon       = document.getElementById('vol-icon');
const seekBar       = document.getElementById('seek-bar');
const progressFill  = document.getElementById('progress-fill');
const progressTrack = document.getElementById('progress-track');
const timeCurrent   = document.getElementById('time-current');
const timeTotal     = document.getElementById('time-total');
const volumeSlider  = document.getElementById('volume-slider');
const volFill       = document.getElementById('vol-fill');

// Equaliser view
const btnPlayEq     = document.getElementById('btn-play-eq');
const playIconEq    = document.getElementById('play-icon-eq');
const eqThumb       = document.getElementById('eq-thumb');
const eqTitle       = document.getElementById('eq-title');
const eqArtist      = document.getElementById('eq-artist');

// Track list
const tracklistEl   = document.getElementById('tracklist');
const tracklistSkeleton = document.getElementById('tracklist-skeleton');
const tracklistCount    = document.getElementById('tracklist-count');

// Playlists
const plFolderList   = document.getElementById('pl-folder-list');
const plSkeleton     = document.getElementById('playlists-skeleton');
const plSubtitle     = document.getElementById('pl-subtitle');

// Visualizers
const vizMini       = document.getElementById('visualizer-mini');
const vizLarge      = document.getElementById('visualizer-large');
const vizReflect    = document.getElementById('visualizer-reflect');

// Status
const statusBanner  = document.getElementById('status-banner');
const statusMsg     = document.getElementById('status-message');
const statusClose   = document.getElementById('status-close');

// EQ band controls
const eqSliderBass   = document.getElementById('eq-slider-bass');
const eqSliderMid    = document.getElementById('eq-slider-mid');
const eqSliderTreble = document.getElementById('eq-slider-treble');
const eqValBass      = document.getElementById('eq-val-bass');
const eqValMid       = document.getElementById('eq-val-mid');
const eqValTreble    = document.getElementById('eq-val-treble');
const eqFillBass     = document.getElementById('eq-fill-bass');
const eqFillMid      = document.getElementById('eq-fill-mid');
const eqFillTreble   = document.getElementById('eq-fill-treble');
const eqKnobBass     = document.getElementById('eq-knob-bass');
const eqKnobMid      = document.getElementById('eq-knob-mid');
const eqKnobTreble   = document.getElementById('eq-knob-treble');
const eqResetBtn     = document.getElementById('eq-reset');

const allNavTabs    = document.querySelectorAll('.nav-tab, .header-nav__tab');

let audioCtx, analyser, sourceNode, dataArray, rafId;
let filterBass, filterMid, filterTreble;

function initAudioContext() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    //Three EQ filter nodes
    filterBass = audioCtx.createBiquadFilter();
    filterBass.type            = 'lowshelf';
    filterBass.frequency.value = 80;
    filterBass.gain.value      = 0;

    filterMid = audioCtx.createBiquadFilter();
    filterMid.type            = 'peaking';
    filterMid.frequency.value = 1000;
    filterMid.Q.value         = 1.0;
    filterMid.gain.value      = 0;

    filterTreble = audioCtx.createBiquadFilter();
    filterTreble.type            = 'highshelf';
    filterTreble.frequency.value = 10000;
    filterTreble.gain.value      = 0;

    //Analyser for the visualizer
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.80;
    dataArray = new Uint8Array(analyser.frequencyBinCount);

    try {
      const currentSrc  = audio.src;
      const currentTime = audio.currentTime;
      const wasPlaying  = !audio.paused;

      audio.crossOrigin = 'anonymous';
      audio.src = currentSrc;   // re-set triggers a CORS reload
      audio.load();
      if (currentTime > 0) audio.currentTime = currentTime;
      if (wasPlaying) audio.play().catch(() => {});

      sourceNode = audioCtx.createMediaElementSource(audio);
      sourceNode
        .connect(filterBass)
        .connect(filterMid)
        .connect(filterTreble)
        .connect(analyser)
        .connect(audioCtx.destination);

    } catch (corsErr) {
      console.warn('Web Audio API: CORS not supported by this source, using simulation.', corsErr.message);
      audio.removeAttribute('crossOrigin');
      analyser  = null;
      dataArray = null;
      if (sourceNode) {
        sourceNode.connect(filterBass).connect(filterMid)
                  .connect(filterTreble).connect(audioCtx.destination);
      }
    }

  } catch (err) {
    console.warn('Web Audio API unavailable — using simulation.', err);
    audioCtx = null;
  }
}

function buildBars(container, count) {
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const bar = document.createElement('div');
    bar.className = 'eq-bar';
    bar.style.height = '3px';
    container.appendChild(bar);
  }
}

let barsMini = [], barsLarge = [], barsReflect = [];

function refreshBarRefs() {
  barsMini    = [...vizMini.querySelectorAll('.eq-bar')];
  barsLarge   = [...vizLarge.querySelectorAll('.eq-bar')];
  barsReflect = [...vizReflect.querySelectorAll('.eq-bar')];
}

/*Draw loop  */
function drawFrame() {
  if (!state.isPlaying) return;
  rafId = requestAnimationFrame(drawFrame);

  const heights = new Array(BAR_COUNT_LARGE);

  if (analyser && dataArray) {
    analyser.getByteFrequencyData(dataArray);
    const total = dataArray.length;
    for (let i = 0; i < BAR_COUNT_LARGE; i++) {
      const bi = Math.floor((i / BAR_COUNT_LARGE) * total * 0.65);
      const v  = dataArray[bi] || 0;
      heights[i] = { h: Math.max(3, (v / 255) * 100), o: 0.3 + (v / 255) * 0.7 };
    }
  } else {
    const t = audio.currentTime || 0;
    for (let i = 0; i < BAR_COUNT_LARGE; i++) {
      const w = Math.sin(t * 2.8 + i * 0.42) * 0.5 + 0.5;
      heights[i] = { h: 3 + w * 90, o: 0.3 + w * 0.6 };
    }
  }

  const largeMaxH = vizLarge.clientHeight || 160;

  barsLarge.forEach((bar, i) => {
    bar.style.height  = Math.min(largeMaxH, heights[i].h) + 'px';
    bar.style.opacity = heights[i].o;
  });

  barsReflect.forEach((bar, i) => {
    bar.style.height  = Math.min(38, heights[i].h * 0.38) + 'px';
    bar.style.opacity = heights[i].o * 0.45;
  });

  barsMini.forEach((bar, i) => {
    const si = Math.floor((i / BAR_COUNT_MINI) * BAR_COUNT_LARGE);
    bar.style.height  = Math.min(26, heights[si].h * 0.24) + 'px';
    bar.style.opacity = heights[si].o;
  });
}

function startVisualizer() {
  [vizMini, vizLarge, vizReflect].forEach(v => v.classList.remove('idle'));
  cancelAnimationFrame(rafId);
  drawFrame();
}

function stopVisualizer() {
  cancelAnimationFrame(rafId);
  [vizMini, vizLarge, vizReflect].forEach(v => {
    v.classList.add('idle');
    v.querySelectorAll('.eq-bar').forEach(b => b.style.removeProperty('height'));
  });
}

/*NAVIGATION */

function switchView(viewName) {
  const resolvedView = (isDesktop() && viewName === 'now-playing')
    ? 'tracklist'
    : viewName;

  state.activeView = resolvedView;

  if (!isDesktop()) {
    // Now Playing panel
    const npPanel = document.getElementById('view-now-playing');
    npPanel.classList.toggle('is-active', resolvedView === 'now-playing');

    // Right panel views
    document.querySelectorAll('.panel--right .view').forEach(v => {
      const match = v.id === `view-${resolvedView}`;
      v.classList.toggle('is-active', match);
      v.setAttribute('aria-hidden', match ? 'false' : 'true');
      v.style.pointerEvents = match ? 'auto' : '';
    });

    // Right panel itself needs pointer events when a right view is active
    const rightPanel = document.getElementById('panel-right');
    const rightActive = resolvedView !== 'now-playing';
    rightPanel.style.pointerEvents = rightActive ? 'auto' : 'none';
  }
  
  else {
    document.querySelectorAll('.panel--right .view').forEach(v => {
      const match = v.id === `view-${resolvedView}`;
      v.classList.toggle('is-active', match);
      v.setAttribute('aria-hidden', match ? 'false' : 'true');
    });
  }

  // Sync nav tab highlights (both sets) 
  allNavTabs.forEach(tab => {
    const tabView = tab.dataset.view;
    const active = (tabView === resolvedView) ||
                   (resolvedView === 'now-playing' && tabView === 'now-playing' && !isDesktop());
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });
}

/* API FETCH */

function mapAudiusTrack(t) {
  const artwork = (t.artwork?.['480x480'] || t.artwork?.['150x150'] || '');
  const streamUrl = t.id
    ? `${AUDIUS_HOST}/v1/tracks/${t.id}/stream?app_name=Nocturne`
    : '';
  return {
    id:       'a_' + t.id,
    title:    t.title              || 'Unknown Title',
    artist:   t.user?.name         || 'Unknown Artist',
    album:    t.album              || '',
    cover:    artwork,
    audioUrl: streamUrl,
  };
}

function mapItunesTrack(t) {
  return {
    id:       'i_' + t.trackId,
    title:    t.trackName           || 'Unknown Title',
    artist:   t.artistName          || 'Unknown Artist',
    album:    t.collectionName      || '',
    cover:    (t.artworkUrl100 || '').replace('100x100bb','320x320bb').replace('100x100','320x320'),
    audioUrl: t.previewUrl          || '',
  };
}

async function fetchAudius() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);         
  try {
    const res = await fetch(AUDIUS_API, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Audius HTTP ${res.status}`);
    const data = await res.json();
    const songs = (data.data || [])
      .filter(t => t.id)
      .map(mapAudiusTrack);
    if (!songs.length) throw new Error('Audius returned no tracks');
    return songs;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchItunes() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(ITUNES_API, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`iTunes HTTP ${res.status}`);
    const data = await res.json();
    const songs = (data.results || [])
      .filter(t => t.previewUrl && t.kind === 'song')
      .map(mapItunesTrack);
    if (!songs.length) throw new Error('iTunes returned no playable tracks');
    return songs;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPlaylist() {
  hideStatus();

  
  try {
    const songs = await fetchAudius();
    console.info(`Loaded ${songs.length} tracks from Audius.`);
    return songs;
  } catch (e) {
    console.warn('Audius failed:', e.message);
  }
/*
  //iTunes
  try {
    const songs = await fetchItunes();
    console.info(`Loaded ${songs.length} tracks from iTunes.`);
    return songs;
  } catch (e) {
    console.warn('iTunes failed:', e.message);
  }
*/
}

/* TRACK LIST RENDERING */
function renderTrackList() {
  tracklistSkeleton.style.display = 'none';
  tracklistEl.innerHTML = '';
  tracklistCount.textContent =
    `${state.playlist.length} song${state.playlist.length !== 1 ? 's' : ''}`;

  state.playlist.forEach((song, idx) => {
    const li = document.createElement('li');
    li.className = 'track-row';
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', idx === state.currentIndex ? 'true' : 'false');
    li.dataset.index = idx;
    if (idx === state.currentIndex) li.classList.add('is-active');

    li.innerHTML = `
      <div class="track-index">${idx + 1}</div>
      <div class="track-playing-icon" aria-hidden="true">
        <span class="tpb"></span><span class="tpb"></span><span class="tpb"></span>
      </div>
      <img class="track-thumb"
           src="${escapeHtml(song.cover || '')}"
           alt="${escapeHtml(song.title)} cover"
           loading="lazy"
           onerror="this.src='https://picsum.photos/seed/${song.id}/80/80'" />
      <div class="track-meta">
        <span class="track-meta__title">${escapeHtml(song.title)}</span>
        <span class="track-meta__artist">${escapeHtml(song.artist)}</span>
      </div>
      <span class="track-duration" id="track-dur-${idx}">—</span>
    `;

    li.addEventListener('click', () => onTrackRowClick(idx));
    tracklistEl.appendChild(li);
  });
}

function syncTrackListActive() {
  tracklistEl.querySelectorAll('.track-row').forEach((row, idx) => {
    const active = idx === state.currentIndex;
    row.classList.toggle('is-active', active);
    row.setAttribute('aria-selected', active ? 'true' : 'false');
  });
}

function scrollActiveIntoView() {
  const active = tracklistEl.querySelector('.track-row.is-active');
  if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function onTrackRowClick(idx) {
  loadSong(idx);
  play();
 
  if (!isDesktop()) switchView('now-playing');
}

/* PLAYLISTS  */


function buildPlaylists(songs) {
  const artistMap = new Map();

  songs.forEach((song, globalIndex) => {
    if (!artistMap.has(song.artist)) {
      artistMap.set(song.artist, new Map());
    }
    const albumMap = artistMap.get(song.artist);
    const albumKey = song.album || 'Singles';
    if (!albumMap.has(albumKey)) albumMap.set(albumKey, []);
    albumMap.get(albumKey).push({ song, globalIndex });
  });

  const folders = [...artistMap.entries()].map(([artist, albumMap]) => ({
    artist,
    albums: [...albumMap.entries()].map(([album, tracks]) => ({ album, tracks })),
    
    covers: [...new Set(
      [...albumMap.values()].flat().map(t => t.song.cover).filter(Boolean)
    )].slice(0, 4),
    totalTracks: [...albumMap.values()].flat().length,
  }));

  
  folders.sort((a, b) => {
    if (a.artist === 'Drake') return -1;
    if (b.artist === 'Drake') return 1;
    return a.artist.localeCompare(b.artist);
  });

  return folders;
}

function renderPlaylists() {
  plSkeleton.style.display = 'none';
  plFolderList.innerHTML   = '';

  const folders = buildPlaylists(state.playlist);
  const artistCount = folders.length;
  plSubtitle.textContent = `${artistCount} artist${artistCount !== 1 ? 's' : ''}`;

  folders.forEach(folder => {
    const folderEl = document.createElement('div');
    folderEl.className = 'pl-folder';
    folderEl.dataset.artist = folder.artist;

    
    const mosaicCount = Math.min(folder.covers.length, 4);
    const mosaicClass = `pl-folder__mosaic mosaic--${mosaicCount || 1}`;
    const mosaicImgs  = folder.covers
      .slice(0, 4)
      .map(src => `<img src="${escapeHtml(src)}" alt="" loading="lazy"
                        onerror="this.style.background='var(--surface-3)';this.src=''">`
      ).join('');

    const albumNames = folder.albums.map(a => a.album).join(' · ');

    
    folderEl.innerHTML = `
      <div class="pl-folder__hd" role="button"
           aria-expanded="false"
           aria-label="Toggle ${escapeHtml(folder.artist)} playlist">
        <div class="${mosaicClass}">${mosaicImgs}</div>
        <div class="pl-folder__info">
          <span class="pl-folder__name">${escapeHtml(folder.artist)}</span>
          <span class="pl-folder__meta">${folder.totalTracks} track${folder.totalTracks !== 1 ? 's' : ''} · ${escapeHtml(albumNames)}</span>
        </div>
        <button class="pl-folder__play-btn" aria-label="Play all ${escapeHtml(folder.artist)} tracks">
          <i class="ph-fill ph-play"></i>
        </button>
        <i class="ph ph-caret-down pl-folder__chevron"></i>
      </div>
      <div class="pl-folder__body">
        ${renderFolderBody(folder)}
      </div>
    `;

    
    const hd       = folderEl.querySelector('.pl-folder__hd');
    const body     = folderEl.querySelector('.pl-folder__body');
    const playBtn  = folderEl.querySelector('.pl-folder__play-btn');

    hd.addEventListener('click', e => {
      
      if (e.target.closest('.pl-folder__play-btn')) return;
      toggleFolder(folderEl, body);
    });

    playBtn.addEventListener('click', e => {
      e.stopPropagation();
      
      const firstIndex = folder.albums[0]?.tracks[0]?.globalIndex;
      if (firstIndex !== undefined) {
        loadSong(firstIndex);
        play();
        if (!isDesktop()) switchView('now-playing');
      }
    });

   
    body.addEventListener('click', e => {
      const row = e.target.closest('.pl-track-row');
      if (!row) return;
      const idx = parseInt(row.dataset.index, 10);
      if (!isNaN(idx)) {
        loadSong(idx);
        play();
        if (!isDesktop()) switchView('now-playing');
      }
    });

    plFolderList.appendChild(folderEl);
  });
}

function renderFolderBody(folder) {
  return folder.albums.map(({ album, tracks }) => {
    const rows = tracks.map(({ song, globalIndex }) => {
      const active = globalIndex === state.currentIndex;
      return `
        <div class="pl-track-row${active ? ' is-active' : ''}"
             data-index="${globalIndex}"
             role="option"
             aria-selected="${active}">
          <div class="track-index">${globalIndex + 1}</div>
          <div class="track-playing-icon" aria-hidden="true">
            <span class="tpb"></span><span class="tpb"></span><span class="tpb"></span>
          </div>
          <img class="track-thumb"
               src="${escapeHtml(song.cover || '')}"
               alt="${escapeHtml(song.title)}"
               loading="lazy"
               onerror="this.src='https://picsum.photos/seed/${song.id}/80/80'">
          <div class="track-meta">
            <span class="track-meta__title">${escapeHtml(song.title)}</span>
            <span class="track-meta__artist">${escapeHtml(song.artist)}</span>
          </div>
          <span class="track-duration" id="pl-dur-${globalIndex}">—</span>
        </div>`;
    }).join('');

    return `<div class="pl-album-label">${escapeHtml(album)}</div>${rows}`;
  }).join('');
}

function toggleFolder(folderEl, bodyEl) {
  const isOpen = folderEl.classList.contains('is-open');
  const hd     = folderEl.querySelector('.pl-folder__hd');

  if (isOpen) {
   
    bodyEl.style.maxHeight = bodyEl.scrollHeight + 'px';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        bodyEl.style.maxHeight = '0px';
      });
    });
    folderEl.classList.remove('is-open');
    hd.setAttribute('aria-expanded', 'false');
  } else {
   
    folderEl.classList.add('is-open');
    hd.setAttribute('aria-expanded', 'true');
    bodyEl.style.maxHeight = bodyEl.scrollHeight + 'px';
    
    bodyEl.addEventListener('transitionend', () => {
      if (folderEl.classList.contains('is-open')) {
        bodyEl.style.maxHeight = 'none';
      }
    }, { once: true });
  }
}

function syncPlaylistsActive() {
  plFolderList.querySelectorAll('.pl-track-row').forEach(row => {
    const active = parseInt(row.dataset.index, 10) === state.currentIndex;
    row.classList.toggle('is-active', active);
    row.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  state.playlist.forEach((_, idx) => {
    const el = document.getElementById(`pl-dur-${idx}`);
    const cached = document.getElementById(`track-dur-${idx}`);
    if (el && cached) el.textContent = cached.textContent;
  });
}

const durationCache = {};

async function prefetchDurations() {
  const BATCH = 4;
  for (let i = 0; i < state.playlist.length; i += BATCH) {
    await Promise.allSettled(
      state.playlist.slice(i, i + BATCH).map((song, bi) =>
        new Promise(resolve => {
          if (durationCache[song.id] !== undefined) {
            updateDurationEl(i + bi, durationCache[song.id]);
            return resolve();
          }
          const tmp = new Audio();
          tmp.preload = 'metadata';
          tmp.crossOrigin = 'anonymous';
          tmp.onloadedmetadata = () => {
            durationCache[song.id] = tmp.duration;
            updateDurationEl(i + bi, tmp.duration);
            tmp.src = '';
            resolve();
          };
          tmp.onerror = () => resolve();
          tmp.src = song.audioUrl;
        })
      )
    );
  }
}

function updateDurationEl(idx, secs) {
  const formatted = formatTime(secs);
  const el  = document.getElementById(`track-dur-${idx}`);
  const elPl = document.getElementById(`pl-dur-${idx}`);
  if (el)   el.textContent   = formatted;
  if (elPl) elPl.textContent = formatted;
}

/* LOAD SONG*/
function loadSong(index) {
  const song = state.playlist[index];
  if (!song) return;
  state.currentIndex = index;

  audio.src = song.audioUrl;
  audio.load();

  // Animate meta
  npMeta.classList.remove('changing');
  void npMeta.offsetWidth;
  npMeta.classList.add('changing');
  setTimeout(() => npMeta.classList.remove('changing'), 400);

  songTitle.textContent  = song.title;
  songArtist.textContent = song.artist;
  songAlbum.textContent  = song.album;
  eqTitle.textContent    = song.title;
  eqArtist.textContent   = song.artist;
  document.title = `${song.title} — ${song.artist} · Nocturne`;

  loadCoverArt(song);

  seekBar.value = 0;
  progressFill.style.width  = '0%';
  timeCurrent.textContent   = '0:00';
  timeTotal.textContent     = '0:00';

  syncTrackListActive();
  scrollActiveIntoView();
  syncPlaylistsActive();
}

function loadCoverArt(song) {
  coverArt.classList.remove('loaded');
  npCoverWrap.classList.remove('loaded');

  const apply = src => {
    coverArt.src = src;
    coverArt.alt = `${song.title} album art`;
    requestAnimationFrame(() => {
      coverArt.classList.add('loaded');
      npCoverWrap.classList.add('loaded');
    });
  };

  if (!song.cover) { apply(`https://picsum.photos/seed/${song.id}/320/320`); return; }

  const img = new Image();
  img.onload  = () => apply(song.cover);
  img.onerror = () => apply(`https://picsum.photos/seed/${song.id}/320/320`);
  img.src = song.cover;

  eqThumb.src = song.cover;
  eqThumb.onerror = () => { eqThumb.src = `https://picsum.photos/seed/${song.id}/80/80`; };
}

/* PLAYBACK */
async function play() {
  if (!state.playlist.length) return;
  try {
    initAudioContext();
    if (audioCtx && audioCtx.state === 'suspended') await audioCtx.resume();
    await audio.play();
  } catch (err) {
    console.error('Playback error:', err);
    showStatus(`Playback error: ${err.message}`);
    return;
  }
  state.isPlaying = true;
  appEl.classList.add('is-playing');
  hdrIndicator.classList.add('is-playing');
  setPlayIcon(true);
  startVisualizer();
}

function pause() {
  audio.pause();
  state.isPlaying = false;
  appEl.classList.remove('is-playing');
  hdrIndicator.classList.remove('is-playing');
  setPlayIcon(false);
  stopVisualizer();
}

function togglePlay() {
  state.isPlaying ? pause() : play();
}

function nextTrack() {
  let next;
  if (state.isShuffle) {
    do { next = Math.floor(Math.random() * state.playlist.length); }
    while (state.playlist.length > 1 && next === state.currentIndex);
  } else {
    next = (state.currentIndex + 1) % state.playlist.length;
  }
  loadSong(next);
  if (state.isPlaying) play();
}

function prevTrack() {
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  const prev = (state.currentIndex - 1 + state.playlist.length) % state.playlist.length;
  loadSong(prev);
  if (state.isPlaying) play();
}

/*UI HELPERS */
function setPlayIcon(playing) {
  const cls = playing ? 'ph-fill ph-pause' : 'ph-fill ph-play';
  playIcon.className   = cls;
  playIconEq.className = cls;
  btnPlay.setAttribute('aria-label',   playing ? 'Pause' : 'Play');
  btnPlayEq.setAttribute('aria-label', playing ? 'Pause' : 'Play');
}

function formatTime(secs) {
  if (!isFinite(secs) || isNaN(secs) || secs < 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function updateVolFill(vol) { volFill.style.width = (vol * 100) + '%'; }

function setVolIcon(vol) {
  if      (vol === 0)  volIcon.className = 'ph ph-speaker-slash';
  else if (vol < 0.35) volIcon.className = 'ph ph-speaker-none';
  else if (vol < 0.65) volIcon.className = 'ph ph-speaker-low';
  else                 volIcon.className = 'ph ph-speaker-high';
}

function showStatus(msg, isInfo = false) {
  statusMsg.textContent = msg;
  statusBanner.hidden = false;
  statusBanner.classList.toggle('status-banner--info', isInfo);
  // Auto-dismiss info messages after 5 s
  if (isInfo) setTimeout(hideStatus, 5000);
}
function hideStatus()    { statusBanner.hidden = true; }

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/*EQ BAND SLIDER LOGIC */

/**
 * Update the visual fill, knob position, and value label for one EQ band.
 * @param {HTMLInputElement} slider
 * @param {HTMLElement} fillEl
 * @param {HTMLElement} knobEl
 * @param {HTMLElement} valEl
 * @param {number} db   — current gain in dB (-12 … +12)
 */
function updateBandUI(slider, fillEl, knobEl, valEl, db) {
  const trackEl  = slider.closest('.eq-band__track');
  const trackH   = trackEl.offsetHeight;
  const range    = 24;           
  const centre   = trackH / 2;  

  const frac = (db - (-12)) / range;   
  const knobH = knobEl.offsetHeight || 24;
  const knobY = (1 - frac) * (trackH - knobH);

  knobEl.style.top = knobY + 'px';

  // Fill: from 0dB centre to current knob position
  if (db > 0) {
    const fillH = frac * (trackH - knobH) - (trackH / 2 - knobH / 2);
    const fillY = centre - Math.abs(fillH) - knobH / 2;
    fillEl.style.top    = fillY + 'px';
    fillEl.style.height = Math.abs(fillH) + 'px';
    fillEl.classList.remove('is-negative');
  } else if (db < 0) {
    const fillH = (0.5 - frac) * (trackH - knobH);
    fillEl.style.top    = centre - knobH / 2 + 'px';
    fillEl.style.height = Math.max(0, fillH) + 'px';
    fillEl.classList.add('is-negative');
  } else {
    fillEl.style.height = '0px';
  }

  
  const sign = db > 0 ? '+' : '';
  valEl.textContent = `${sign}${db.toFixed(1)} dB`;
  valEl.className = 'eq-band__value' +
    (db > 0 ? '' : db < 0 ? ' is-negative' : ' is-zero');

  
  slider.setAttribute('aria-valuetext', `${sign}${db.toFixed(1)} dB`);
}

/**
 * Apply a new dB gain to one band.
 * @param {'bass'|'mid'|'treble'} band
 * @param {number} db
 */
function applyBandGain(band, db) {
  
  if (!audioCtx) initAudioContext();

  if (band === 'bass'   && filterBass)   filterBass.gain.value   = db;
  if (band === 'mid'    && filterMid)    filterMid.gain.value    = db;
  if (band === 'treble' && filterTreble) filterTreble.gain.value = db;

  // Update UI
  const slider = band === 'bass' ? eqSliderBass : band === 'mid' ? eqSliderMid : eqSliderTreble;
  const fill   = band === 'bass' ? eqFillBass   : band === 'mid' ? eqFillMid   : eqFillTreble;
  const knob   = band === 'bass' ? eqKnobBass   : band === 'mid' ? eqKnobMid   : eqKnobTreble;
  const val    = band === 'bass' ? eqValBass     : band === 'mid' ? eqValMid    : eqValTreble;

  updateBandUI(slider, fill, knob, val, db);
}


function refreshAllBandUIs() {
  applyBandGain('bass',   parseFloat(eqSliderBass.value));
  applyBandGain('mid',    parseFloat(eqSliderMid.value));
  applyBandGain('treble', parseFloat(eqSliderTreble.value));
}

/* EVENT LISTENERS
 */

// Navigation
allNavTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    switchView(tab.dataset.view);
    if (tab.dataset.view === 'equaliser') {
      requestAnimationFrame(refreshAllBandUIs);
    }
  });
});

// Playback
btnPlay.addEventListener('click', togglePlay);
btnPlayEq.addEventListener('click', togglePlay);
btnNext.addEventListener('click', nextTrack);
btnPrev.addEventListener('click', prevTrack);

btnShuffle.addEventListener('click', () => {
  state.isShuffle = !state.isShuffle;
  btnShuffle.classList.toggle('active', state.isShuffle);
});

btnRepeat.addEventListener('click', () => {
  state.isRepeat = !state.isRepeat;
  btnRepeat.classList.toggle('active', state.isRepeat);
  audio.loop = state.isRepeat;
});

btnMute.addEventListener('click', () => {
  if (audio.volume > 0) {
    state.prevVolume = audio.volume;
    audio.volume = 0; volumeSlider.value = 0;
    updateVolFill(0); setVolIcon(0);
  } else {
    audio.volume = state.prevVolume || 0.8;
    volumeSlider.value = audio.volume;
    updateVolFill(audio.volume); setVolIcon(audio.volume);
  }
});

// Seek
seekBar.addEventListener('input', () => {
  const pct = seekBar.value / seekBar.max;
  progressFill.style.width = (pct * 100) + '%';
  progressTrack.style.setProperty('--thumb-pct', (pct * 100) + '%');
  if (isFinite(audio.duration)) audio.currentTime = pct * audio.duration;
});

// Volume
volumeSlider.addEventListener('input', () => {
  const vol = parseFloat(volumeSlider.value);
  audio.volume = vol;
  updateVolFill(vol);
  setVolIcon(vol);
});

// Status banner
statusClose.addEventListener('click', hideStatus);

//EQ band sliders 
[
  { slider: eqSliderBass,   band: 'bass'   },
  { slider: eqSliderMid,    band: 'mid'    },
  { slider: eqSliderTreble, band: 'treble' },
].forEach(({ slider, band }) => {
  slider.addEventListener('input', () => {
    applyBandGain(band, parseFloat(slider.value));
  });
});

eqResetBtn.addEventListener('click', () => {
  eqSliderBass.value   = 0;
  eqSliderMid.value    = 0;
  eqSliderTreble.value = 0;
  applyBandGain('bass',   0);
  applyBandGain('mid',    0);
  applyBandGain('treble', 0);
});

// Audio events
audio.addEventListener('timeupdate', () => {
  if (!isFinite(audio.duration) || audio.duration === 0) return;
  const pct = audio.currentTime / audio.duration;
  seekBar.value = Math.round(pct * parseFloat(seekBar.max));
  progressFill.style.width = (pct * 100) + '%';
  progressTrack.style.setProperty('--thumb-pct', (pct * 100) + '%');
  timeCurrent.textContent = formatTime(audio.currentTime);
});

audio.addEventListener('loadedmetadata', () => {
  seekBar.max = 1000;
  timeTotal.textContent = formatTime(audio.duration);
});

audio.addEventListener('ended', () => { if (!state.isRepeat) nextTrack(); });

audio.addEventListener('error', () => {
  const code = audio.error ? audio.error.code : '?';
  showStatus(`Track unavailable (code ${code}). Skipping…`);
  setTimeout(nextTrack, 1800);
});

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if (['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) return;
  switch (e.key) {
    case ' ': case 'k': e.preventDefault(); togglePlay(); break;
    case 'ArrowRight': case 'l':
      e.preventDefault();
      audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5); break;
    case 'ArrowLeft': case 'j':
      e.preventDefault();
      audio.currentTime = Math.max(0, audio.currentTime - 5); break;
    case 'ArrowUp':
      e.preventDefault();
      audio.volume = Math.min(1, audio.volume + 0.05);
      volumeSlider.value = audio.volume; updateVolFill(audio.volume); setVolIcon(audio.volume); break;
    case 'ArrowDown':
      e.preventDefault();
      audio.volume = Math.max(0, audio.volume - 0.05);
      volumeSlider.value = audio.volume; updateVolFill(audio.volume); setVolIcon(audio.volume); break;
    case 'n': nextTrack(); break;
    case 'p': prevTrack(); break;
    case 'm': btnMute.click(); break;
    case '1': if (!isDesktop()) switchView('now-playing'); break;
    case '2': switchView('equaliser'); break;
    case '3': switchView('tracklist'); break;
    case '4': switchView('playlists'); break;
  }
});

// Re-apply layout on resize 
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    
    switchView(state.activeView);
  }, 120);
});

/* INIT */
async function init() {
  // Build visualizer bar elements
  buildBars(vizMini,    BAR_COUNT_MINI);
  buildBars(vizLarge,   BAR_COUNT_LARGE);
  buildBars(vizReflect, BAR_COUNT_LARGE);
  refreshBarRefs();
  stopVisualizer();

  // Initial volume display
  audio.volume = parseFloat(volumeSlider.value);
  updateVolFill(audio.volume);
  setVolIcon(audio.volume);

  songTitle.textContent = 'Loading…';

  switchView('tracklist');

  // Fetch playlist
  const playlist = await fetchPlaylist();
  if (!playlist.length) {
    showStatus('No tracks available. Please try again later.');
    songTitle.textContent = 'No tracks found';
    return;
  }

  state.playlist = playlist;
  renderTrackList();
  renderPlaylists();
  loadSong(0);
  prefetchDurations();

  // Render EQ band knobs
  requestAnimationFrame(() => requestAnimationFrame(refreshAllBandUIs));
}

init();
