/* =========================================================
   Nintendo Switch 게임 라이브러리 — 앱 로직
   데이터(GAMES, CATEGORIES)는 js/data.js 에서 로드됩니다.
   단일 화면 구조: 카테고리 칩 + 상태 필터 + 즐겨찾기 토글이
   모두 하나의 목록 위에서 동작합니다.
   ========================================================= */
(function(){
  "use strict";

  /* ---------------------------------------------------------
     0. 저장소 (localStorage)
     --------------------------------------------------------- */
  const LS_KEYS = {
    cleared: 'gl_cleared_v1',      // string[] of game.id
    favorites: 'gl_favorites_v1',  // string[] of game.id
    state: 'gl_state_v2'           // {category, status, favoritesOnly, sort, pcSort, pcFavOnly, scroll}
  };

  function loadSet(key){
    try{
      const raw = localStorage.getItem(key);
      if(!raw) return null; // null = 저장된 적 없음 (최초 실행)
      const arr = JSON.parse(raw);
      return new Set(Array.isArray(arr) ? arr : []);
    }catch(e){ return null; }
  }
  function saveSet(key, set){
    try{ localStorage.setItem(key, JSON.stringify(Array.from(set))); }catch(e){}
  }
  function loadState(){
    const def = {
      category: 'all',
      status: 'all',
      favoritesOnly: false,
      sort: 'number',
      pcSort: 'number',
      pcFavOnly: false,
      scroll: 0
    };
    try{
      const raw = localStorage.getItem(LS_KEYS.state);
      if(!raw) return def;
      const parsed = JSON.parse(raw);
      return Object.assign({}, def, parsed);
    }catch(e){ return def; }
  }
  function saveState(){
    try{ localStorage.setItem(LS_KEYS.state, JSON.stringify(APP.state)); }catch(e){}
  }

  let cleared = loadSet(LS_KEYS.cleared);
  let favorites = loadSet(LS_KEYS.favorites);

  // 최초 실행(저장된 기록이 전혀 없음)이면, 원본 Excel의 "엔딩" 완료 표시를
  // 기본 클리어 상태로 미리 채워준다. 이후에는 사용자의 체크가 항상 우선한다.
  if(cleared === null){
    cleared = new Set(GAMES.filter(g => g.d0).map(g => g.id));
    saveSet(LS_KEYS.cleared, cleared);
  }
  if(favorites === null){
    favorites = new Set();
    saveSet(LS_KEYS.favorites, favorites);
  }

  const APP = { state: loadState() };

  /* ---------------------------------------------------------
     1. 데이터 준비
     --------------------------------------------------------- */
  const CAT_MAP = {};
  CATEGORIES.forEach(c => { CAT_MAP[c.key] = c; });

  function isCleared(id){ return cleared.has(id); }
  function isFav(id){ return favorites.has(id); }

  function toggleCleared(id){
    if(cleared.has(id)) cleared.delete(id); else cleared.add(id);
    saveSet(LS_KEYS.cleared, cleared);
  }
  function toggleFav(id){
    if(favorites.has(id)) favorites.delete(id); else favorites.add(id);
    saveSet(LS_KEYS.favorites, favorites);
  }

  function counts(list){
    const total = list.length;
    let done = 0;
    for(const g of list){ if(isCleared(g.id)) done++; }
    return { total, done, todo: total - done };
  }

  /* ---------------------------------------------------------
     2. 정렬 / 필터
     --------------------------------------------------------- */
  function sortGames(list, mode){
    const arr = list.slice();
    if(mode === 'title'){
      arr.sort((a,b)=> a.title.localeCompare(b.title, 'ko'));
    }else{
      arr.sort((a,b)=> (a.number||0) - (b.number||0));
    }
    return arr;
  }

  function filterByCategory(list, catKey){
    if(!catKey || catKey === 'all') return list;
    return list.filter(g => g.category === catKey);
  }
  function filterByStatus(list, status){
    if(status === 'done') return list.filter(g=>isCleared(g.id));
    if(status === 'todo') return list.filter(g=>!isCleared(g.id));
    return list;
  }
  function filterByFavorites(list, favOnly){
    if(!favOnly) return list;
    return list.filter(g=>isFav(g.id));
  }
  function filterBySearch(list, q){
    if(!q) return list;
    const needle = q.trim().toLowerCase();
    if(!needle) return list;
    return list.filter(g =>
      g.title.toLowerCase().includes(needle) ||
      String(g.number).includes(needle)
    );
  }

  /* ---------------------------------------------------------
     3. DOM 유틸
     --------------------------------------------------------- */
  function el(tag, cls, html){
    const e = document.createElement(tag);
    if(cls) e.className = cls;
    if(html !== undefined) e.innerHTML = html;
    return e;
  }
  function escapeHtml(s){
    return String(s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="#0b1f14" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  const STAR_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
  const STAR_OUTLINE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';

  /* ---------------------------------------------------------
     4. 목록(row) 렌더링
     --------------------------------------------------------- */
  function buildRowHTML(g){
    const done = isCleared(g.id);
    const fav = isFav(g.id);
    return `
      <div class="row ${done?'cleared':''}" data-id="${g.id}">
        <div class="no">${g.number != null ? g.number : ''}</div>
        <div class="main">
          <div class="title">${escapeHtml(g.title)}</div>
          <button class="star-btn ${fav?'active':''}" data-action="fav" aria-label="즐겨찾기">${fav?STAR_SVG:STAR_OUTLINE_SVG}</button>
          <button class="check-btn" data-action="check" aria-label="클리어 체크">
            <span class="check-circle">${CHECK_SVG}</span>
          </button>
        </div>
      </div>`;
  }

  function renderGroupedList(container, list, opts){
    opts = opts || {};
    container.innerHTML = '';
    if(list.length === 0) return;

    if(opts.grouped === false){
      const wrap = el('div','row-list');
      wrap.innerHTML = list.map(buildRowHTML).join('');
      container.appendChild(wrap);
      return;
    }

    const byCategory = {};
    list.forEach(g=>{
      (byCategory[g.category] = byCategory[g.category] || []).push(g);
    });

    const frag = document.createDocumentFragment();
    CATEGORIES.forEach(cat=>{
      const items = byCategory[cat.key];
      if(!items || items.length===0) return;
      const head = el('div','section-head',
        `<span class="dot" style="background:${cat.color}"></span>
         <h3>${escapeHtml(cat.label)}</h3>
         <span class="sub">${items.length}개</span>`);
      frag.appendChild(head);
      const wrap = el('div','row-list');
      wrap.style.setProperty('--cat-color', cat.color);
      wrap.innerHTML = items.map(buildRowHTML).join('');
      frag.appendChild(wrap);
    });
    container.appendChild(frag);
  }

  // 행 클릭 위임 (체크 / 즐겨찾기)
  function bindRowDelegation(container, onChange){
    container.addEventListener('click', function(e){
      const btn = e.target.closest('[data-action]');
      if(!btn) return;
      const rowEl = btn.closest('.row');
      if(!rowEl) return;
      const id = rowEl.dataset.id;
      const action = btn.dataset.action;
      if(action === 'check'){
        toggleCleared(id);
        const nowDone = isCleared(id);
        rowEl.classList.toggle('cleared', nowDone);
      }else if(action === 'fav'){
        toggleFav(id);
        const nowFav = isFav(id);
        btn.classList.toggle('active', nowFav);
        btn.innerHTML = nowFav ? STAR_SVG : STAR_OUTLINE_SVG;
      }
      if(typeof onChange === 'function') onChange();
    });

    // 터치 강조 효과
    container.addEventListener('pointerdown', function(e){
      const rowEl = e.target.closest('.row');
      if(!rowEl || e.target.closest('[data-action]')) return;
      rowEl.classList.add('touch');
      setTimeout(()=>rowEl.classList.remove('touch'), 260);
    });
  }

  /* ---------------------------------------------------------
     5. 요약 바 (히어로 카드)
     --------------------------------------------------------- */
  function renderSummary(){
    const c = counts(GAMES);
    const pct = c.total ? Math.round(c.done / c.total * 100) : 0;

    const ring = document.getElementById('heroRing');
    if(ring){
      ring.style.background = `conic-gradient(var(--accent) ${pct}%, var(--ring-track) 0)`;
    }
    const pctEl = document.getElementById('heroPct');
    if(pctEl) pctEl.textContent = pct + '%';
    const t = document.getElementById('statTotal'); if(t) t.textContent = c.total;
    const d = document.getElementById('statDone'); if(d) d.textContent = c.done;
    const td = document.getElementById('statTodo'); if(td) td.textContent = c.todo;

    const html = `전체 <b>${c.total}</b><span class="dot-sep">·</span>클리어 <span class="s-done">${c.done}</span><span class="dot-sep">·</span>미클리어 <span class="s-todo">${c.todo}</span>`;
    const dEl = document.getElementById('summaryBarDesktop');
    if(dEl) dEl.innerHTML = html;
  }

  /* ---------------------------------------------------------
     6. 메인 목록 화면 (단일 화면)
     --------------------------------------------------------- */
  function buildChipRow(container, selectedKey, onSelect){
    const chips = [{key:'all', label:'전체', color:'var(--accent)'}].concat(CATEGORIES);
    container.innerHTML = chips.map(c=>{
      const active = c.key === selectedKey;
      const cnt = c.key==='all' ? GAMES.length : GAMES.filter(g=>g.category===c.key).length;
      return `<div class="chip ${active?'active':''}" data-cat="${c.key}" style="--cat-color:${c.color}">
        <span class="dot"></span>
        <span>${escapeHtml(c.label)}</span>
        <span class="cnt">${cnt}</span>
      </div>`;
    }).join('');
    container.querySelectorAll('.chip').forEach(chip=>{
      chip.addEventListener('click', ()=> onSelect(chip.dataset.cat));
    });
  }

  let searchQuery = '';

  function renderList(){
    const container = document.getElementById('listContainer');
    const emptyEl = document.getElementById('listEmpty');
    const countEl = document.getElementById('listResultCount');

    buildChipRow(document.getElementById('chipRowList'), APP.state.category, (catKey)=>{
      APP.state.category = catKey;
      saveState();
      renderList();
    });

    document.querySelectorAll('#segListStatus button').forEach(b=>{
      b.classList.toggle('active', b.dataset.v === APP.state.status);
    });
    document.getElementById('sortSelectList').value = APP.state.sort;

    const favBtn = document.getElementById('btnFavToggle');
    if(favBtn) favBtn.classList.toggle('active', APP.state.favoritesOnly);

    let list = filterByCategory(GAMES, APP.state.category);
    list = filterByStatus(list, APP.state.status);
    list = filterByFavorites(list, APP.state.favoritesOnly);
    list = filterBySearch(list, searchQuery);
    list = sortGames(list, APP.state.sort);

    if(searchQuery){
      countEl.textContent = `"${searchQuery}" 검색 결과 ${list.length}개`;
    }else if(APP.state.favoritesOnly){
      countEl.textContent = `즐겨찾기 ${list.length}개`;
    }else{
      countEl.textContent = `${list.length}개 표시 중`;
    }

    if(list.length === 0){
      container.innerHTML = '';
      emptyEl.classList.add('show');
      emptyEl.innerHTML = APP.state.favoritesOnly
        ? '<div class="big">⭐</div>즐겨찾기한 게임이 없어요<br>별표를 눌러 추가해보세요'
        : (searchQuery ? '<div class="big">🔍</div>검색 결과가 없어요' : '<div class="big">🎮</div>조건에 맞는 게임이 없어요');
    }else{
      emptyEl.classList.remove('show');
      const grouped = APP.state.category === 'all' && !searchQuery;
      renderGroupedList(container, list, { grouped });
    }
  }

  /* ---------------------------------------------------------
     7. 데스크톱(PC) 그리드
     --------------------------------------------------------- */
  function renderPcGrid(query){
    const grid = document.getElementById('pcGrid');
    const q = (query||'').trim().toLowerCase();
    grid.innerHTML = '';
    let anyVisible = false;

    CATEGORIES.forEach(cat=>{
      let list = GAMES.filter(g=>g.category===cat.key);
      if(APP.state.pcFavOnly){
        list = list.filter(g=>isFav(g.id));
      }
      if(q){
        list = list.filter(g=> g.title.toLowerCase().includes(q) || String(g.number).includes(q));
      }
      list = sortGames(list, APP.state.pcSort || 'number');
      if((q || APP.state.pcFavOnly) && list.length===0) return; // 필터 중엔 결과 없는 패널 숨김
      anyVisible = true;

      const c = counts(GAMES.filter(g=>g.category===cat.key));
      const panel = el('div','pc-panel');
      panel.innerHTML = `
        <div class="pc-panel-head" style="--cat-color:${cat.color}">
          <span class="name">${escapeHtml(cat.label)}</span>
          <span class="count">${c.done}/${c.total}</span>
        </div>
        <div class="pc-panel-body"></div>`;
      const body = panel.querySelector('.pc-panel-body');
      body.innerHTML = list.map(g=>{
        const done = isCleared(g.id);
        const fav = isFav(g.id);
        return `<div class="pc-row ${done?'cleared':''}" data-id="${g.id}">
          <div class="no">${g.number!=null?g.number:''}</div>
          <div class="t" title="${escapeHtml(g.title)}">${escapeHtml(g.title)}</div>
          <div class="actions">
            <button class="star ${fav?'active':''}" data-action="fav">${fav?STAR_SVG:STAR_OUTLINE_SVG}</button>
            <button class="chk" data-action="check">${done?CHECK_SVG.replace('#0b1f14','currentColor'):''}</button>
          </div>
        </div>`;
      }).join('');
      grid.appendChild(panel);
    });

    if(!anyVisible){
      grid.innerHTML = '<div class="pc-empty">해당하는 게임이 없습니다</div>';
    }
  }

  function initPcRowActions(){
    const pcGrid = document.getElementById('pcGrid');
    pcGrid.addEventListener('click', function(e){
      const btn = e.target.closest('[data-action]');
      if(!btn) return;
      const rowEl = btn.closest('.pc-row');
      const id = rowEl.dataset.id;
      if(btn.dataset.action === 'check'){
        toggleCleared(id);
        const done = isCleared(id);
        rowEl.classList.toggle('cleared', done);
        btn.innerHTML = done ? CHECK_SVG.replace('#0b1f14','currentColor') : '';
      }else if(btn.dataset.action === 'fav'){
        toggleFav(id);
        const fav = isFav(id);
        btn.classList.toggle('active', fav);
        btn.innerHTML = fav ? STAR_SVG : STAR_OUTLINE_SVG;
      }
      renderSummary();
    });
  }

  /* ---------------------------------------------------------
     8. 즐겨찾기 토글 (상단 버튼 하나)
     --------------------------------------------------------- */
  function initFavToggle(){
    const btn = document.getElementById('btnFavToggle');
    if(!btn) return;
    btn.addEventListener('click', ()=>{
      APP.state.favoritesOnly = !APP.state.favoritesOnly;
      saveState();
      renderList();
    });
  }

  /* ---------------------------------------------------------
     9. 검색 (같은 목록에 바로 필터 적용)
     --------------------------------------------------------- */
  function initSearchControls(){
    const btnSearch = document.getElementById('btnSearch');
    const searchRow = document.getElementById('searchRow');
    const input = document.getElementById('searchInput');
    const btnCancel = document.getElementById('btnSearchCancel');

    btnSearch.addEventListener('click', ()=>{
      const opening = !searchRow.classList.contains('open');
      searchRow.classList.toggle('open', opening);
      if(opening) input.focus();
    });
    btnCancel.addEventListener('click', ()=>{
      searchRow.classList.remove('open');
      input.value = '';
      searchQuery = '';
      renderList();
    });
    input.addEventListener('input', ()=>{
      searchQuery = input.value;
      renderList();
    });
  }

  /* ---------------------------------------------------------
     10. 설정 패널 (백업/복원/초기화)
     --------------------------------------------------------- */
  function initSettingsToggle(){
    const btn = document.getElementById('btnSettings');
    const panel = document.getElementById('settingsPanel');
    if(!btn || !panel) return;
    btn.addEventListener('click', ()=>{
      const open = panel.classList.toggle('open');
      btn.classList.toggle('active', open);
    });
  }

  /* ---------------------------------------------------------
     11. 목록 화면 컨트롤
     --------------------------------------------------------- */
  function initListControls(){
    document.getElementById('segListStatus').addEventListener('click', e=>{
      const b = e.target.closest('button'); if(!b) return;
      APP.state.status = b.dataset.v;
      saveState();
      renderList();
    });
    document.getElementById('sortSelectList').addEventListener('change', e=>{
      APP.state.sort = e.target.value;
      saveState();
      renderList();
    });
    bindRowDelegation(document.getElementById('listContainer'), ()=>{
      renderSummary();
    });
  }

  function initPcControls(){
    const input = document.getElementById('pcSearchInput');
    if(!input) return;
    input.addEventListener('input', ()=> renderPcGrid(input.value));
    document.getElementById('pcBtnSort').addEventListener('click', function(){
      APP.state.pcSort = (APP.state.pcSort === 'title') ? 'number' : 'title';
      this.textContent = APP.state.pcSort === 'title' ? '가나다순' : '번호순';
      saveState();
      renderPcGrid(input.value);
    });
    const favBtn = document.getElementById('pcBtnFav');
    if(favBtn){
      favBtn.addEventListener('click', function(){
        APP.state.pcFavOnly = !APP.state.pcFavOnly;
        this.classList.toggle('active', APP.state.pcFavOnly);
        saveState();
        renderPcGrid(input.value);
      });
    }
  }

  /* ---------------------------------------------------------
     12. 백업 / 복원 / 초기화
     --------------------------------------------------------- */
  function exportBackup(){
    const payload = {
      app: 'switch-game-library',
      version: 2,
      exportedAt: new Date().toISOString(),
      cleared: Array.from(cleared),
      favorites: Array.from(favorites),
      state: APP.state
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0,10);
    a.href = url;
    a.download = `game-library-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 2000);
  }

  function importBackup(file){
    const reader = new FileReader();
    reader.onload = function(){
      try{
        const data = JSON.parse(reader.result);
        cleared = new Set(Array.isArray(data.cleared)?data.cleared:[]);
        favorites = new Set(Array.isArray(data.favorites)?data.favorites:[]);
        saveSet(LS_KEYS.cleared, cleared);
        saveSet(LS_KEYS.favorites, favorites);
        if(data.state && typeof data.state === 'object'){
          APP.state = Object.assign({}, APP.state, data.state);
          saveState();
        }
        renderSummary();
        renderList();
        renderPcGrid('');
        alert('복원이 완료되었습니다.');
      }catch(err){
        alert('백업 파일을 읽을 수 없습니다. 올바른 JSON 파일인지 확인해주세요.');
      }
    };
    reader.readAsText(file);
  }

  function resetProgress(){
    if(!confirm('클리어 기록과 즐겨찾기를 모두 초기화할까요?\n이 작업은 되돌릴 수 없습니다.')) return;
    cleared = new Set();
    favorites = new Set();
    saveSet(LS_KEYS.cleared, cleared);
    saveSet(LS_KEYS.favorites, favorites);
    renderSummary();
    renderList();
    renderPcGrid('');
  }

  function initDataControls(){
    document.getElementById('btnBackup').addEventListener('click', exportBackup);
    document.getElementById('btnReset').addEventListener('click', resetProgress);
    document.getElementById('btnRestore').addEventListener('click', ()=>{
      document.getElementById('restoreFile').click();
    });
    document.getElementById('restoreFile').addEventListener('change', e=>{
      if(e.target.files[0]) importBackup(e.target.files[0]);
      e.target.value = '';
    });

    const pcBackup = document.getElementById('pcBtnBackup');
    const pcRestore = document.getElementById('pcBtnRestore');
    const pcRestoreFile = document.getElementById('pcRestoreFile');
    if(pcBackup) pcBackup.addEventListener('click', exportBackup);
    if(pcRestore) pcRestore.addEventListener('click', ()=> pcRestoreFile.click());
    if(pcRestoreFile) pcRestoreFile.addEventListener('change', e=>{
      if(e.target.files[0]) importBackup(e.target.files[0]);
      e.target.value = '';
    });
  }

  /* ---------------------------------------------------------
     13. 스크롤 위치 기억 + 맨 위로 버튼
     --------------------------------------------------------- */
  let scrollSaveTimer = null;
  function initScrollMemory(){
    window.addEventListener('scroll', ()=>{
      clearTimeout(scrollSaveTimer);
      scrollSaveTimer = setTimeout(()=>{
        APP.state.scroll = window.scrollY;
        saveState();
      }, 250);
    }, {passive:true});
    window.addEventListener('beforeunload', ()=>{
      APP.state.scroll = window.scrollY;
      saveState();
    });
  }

  function initScrollTop(){
    const btn = document.getElementById('btnTop');
    window.addEventListener('scroll', ()=>{
      btn.classList.toggle('show', window.scrollY > 500);
    }, {passive:true});
    btn.addEventListener('click', ()=> window.scrollTo({top:0, behavior:'smooth'}));
  }

  /* ---------------------------------------------------------
     14. 설치(PWA) / 전체화면
     --------------------------------------------------------- */
  let deferredPrompt = null;
  function initInstall(){
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    window.addEventListener('beforeinstallprompt', (e)=>{
      e.preventDefault();
      deferredPrompt = e;
      if(!isStandalone){
        document.getElementById('btnInstall').classList.remove('hide');
        const pcBtn = document.getElementById('pcBtnInstall');
        if(pcBtn) pcBtn.classList.remove('hide');
      }
    });
    async function doInstall(){
      if(!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      document.getElementById('btnInstall').classList.add('hide');
      const pcBtn = document.getElementById('pcBtnInstall');
      if(pcBtn) pcBtn.classList.add('hide');
    }
    document.getElementById('btnInstall').addEventListener('click', doInstall);
    const pcBtn = document.getElementById('pcBtnInstall');
    if(pcBtn) pcBtn.addEventListener('click', doInstall);
  }

  function initFullscreen(){
    const btn = document.getElementById('btnFullscreen');
    if(!btn) return;
    btn.addEventListener('click', ()=>{
      if(!document.fullscreenElement){
        if(document.documentElement.requestFullscreen){
          document.documentElement.requestFullscreen().catch(()=>{});
        }
      }else{
        if(document.exitFullscreen) document.exitFullscreen().catch(()=>{});
      }
    });
  }

  /* ---------------------------------------------------------
     15. 초기화
     --------------------------------------------------------- */
  function init(){
    renderSummary();
    initListControls();
    initFavToggle();
    initSearchControls();
    initSettingsToggle();
    initPcControls();
    initPcRowActions();
    initDataControls();
    initScrollTop();
    initScrollMemory();
    initInstall();
    initFullscreen();

    renderList();
    renderPcGrid('');

    // 이전 스크롤 위치 복원 (렌더링 이후 다음 프레임에)
    if(APP.state.scroll){
      requestAnimationFrame(()=>{
        requestAnimationFrame(()=>{
          window.scrollTo({top: APP.state.scroll, behavior:'auto'});
        });
      });
    }

    if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)){
      window.addEventListener('load', ()=>{
        navigator.serviceWorker.register('sw.js').catch(()=>{});
      });
    }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }

})();
