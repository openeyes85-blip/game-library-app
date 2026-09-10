/* =========================================================
   Nintendo Switch 게임 라이브러리 — 앱 로직
   데이터(GAMES, CATEGORIES)는 js/data.js 에서 로드됩니다.
   ========================================================= */
(function(){
  "use strict";

  /* ---------------------------------------------------------
     0. 저장소 (localStorage)
     --------------------------------------------------------- */
  const LS_KEYS = {
    cleared: 'gl_cleared_v1',      // string[] of game.id
    favorites: 'gl_favorites_v1',  // string[] of game.id
    state: 'gl_state_v1'           // {tab, category, listStatus, clearedStatus, sort:{list,cleared,fav}}
  };

  function loadSet(key){
    try{
      const raw = localStorage.getItem(key);
      if(!raw) return new Set();
      const arr = JSON.parse(raw);
      return new Set(Array.isArray(arr) ? arr : []);
    }catch(e){ return new Set(); }
  }
  function saveSet(key, set){
    try{ localStorage.setItem(key, JSON.stringify(Array.from(set))); }catch(e){}
  }
  function loadState(){
    const def = {
      tab: 'list',
      category: 'all',
      listStatus: 'all',
      clearedStatus: 'todo',
      sort: { list:'number', cleared:'number', fav:'number' },
      scroll: { list:0, categories:0, cleared:0, favorites:0 }
    };
    try{
      const raw = localStorage.getItem(LS_KEYS.state);
      if(!raw) return def;
      const parsed = JSON.parse(raw);
      return Object.assign({}, def, parsed, {
        sort: Object.assign({}, def.sort, parsed.sort||{}),
        scroll: Object.assign({}, def.scroll, parsed.scroll||{})
      });
    }catch(e){ return def; }
  }
  function saveState(){
    try{ localStorage.setItem(LS_KEYS.state, JSON.stringify(APP.state)); }catch(e){}
  }

  let cleared = loadSet(LS_KEYS.cleared);
  let favorites = loadSet(LS_KEYS.favorites);

  const APP = { state: loadState() };

  /* ---------------------------------------------------------
     1. 데이터 준비
     --------------------------------------------------------- */
  const CAT_MAP = {};
  CATEGORIES.forEach(c => { CAT_MAP[c.key] = c; });

  const GAME_MAP = {};
  GAMES.forEach(g => { GAME_MAP[g.id] = g; });

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

  const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  const STAR_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
  const STAR_OUTLINE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';

  /* ---------------------------------------------------------
     4. 목록(row) 렌더링 — 모바일
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
     5. 요약 바
     --------------------------------------------------------- */
  function renderSummary(){
    const c = counts(GAMES);
    const html = `전체 <b>${c.total}</b><span class="dot-sep">·</span>클리어 <span class="s-done">${c.done}</span><span class="dot-sep">·</span>미클리어 <span class="s-todo">${c.todo}</span>`;
    const mEl = document.getElementById('summaryBarMobile');
    const dEl = document.getElementById('summaryBarDesktop');
    if(mEl) mEl.innerHTML = html;
    if(dEl) dEl.innerHTML = html;
  }

  /* ---------------------------------------------------------
     6. 화면: 전체목록
     --------------------------------------------------------- */
  function buildChipRow(container, selectedKey, onSelect){
    const chips = [{key:'all', label:'전체', color:'#111827'}].concat(CATEGORIES);
    container.innerHTML = chips.map(c=>{
      const active = c.key === selectedKey;
      const cnt = c.key==='all' ? GAMES.length : GAMES.filter(g=>g.category===c.key).length;
      return `<div class="chip ${active?'active':''}" data-cat="${c.key}">
        <span class="dot" style="background:${active?'var(--accent)':c.color}"></span>
        <span>${escapeHtml(c.label)}</span>
        <span class="cnt">${cnt}</span>
      </div>`;
    }).join('');
    container.querySelectorAll('.chip').forEach(chip=>{
      chip.addEventListener('click', ()=> onSelect(chip.dataset.cat));
    });
  }

  function renderListScreen(){
    const container = document.getElementById('listContainer');
    const emptyEl = document.getElementById('listEmpty');
    const countEl = document.getElementById('listResultCount');

    buildChipRow(document.getElementById('chipRowList'), APP.state.category, (catKey)=>{
      APP.state.category = catKey;
      saveState();
      renderListScreen();
    });

    document.querySelectorAll('#segListStatus button').forEach(b=>{
      b.classList.toggle('active', b.dataset.v === APP.state.listStatus);
    });
    document.getElementById('sortSelectList').value = APP.state.sort.list;

    let list = filterByCategory(GAMES, APP.state.category);
    list = filterByStatus(list, APP.state.listStatus);
    list = sortGames(list, APP.state.sort.list);

    countEl.textContent = `${list.length}개 표시 중`;

    if(list.length === 0){
      container.innerHTML = '';
      emptyEl.classList.add('show');
    }else{
      emptyEl.classList.remove('show');
      renderGroupedList(container, list, { grouped: APP.state.category === 'all' });
    }
  }

  /* ---------------------------------------------------------
     7. 화면: 카테고리
     --------------------------------------------------------- */
  function renderCategoriesScreen(){
    const grid = document.getElementById('catGrid');
    grid.innerHTML = CATEGORIES.map(cat=>{
      const list = GAMES.filter(g=>g.category===cat.key);
      const c = counts(list);
      const pct = c.total ? Math.round(c.done / c.total * 100) : 0;
      return `<button class="cat-card" data-cat="${cat.key}">
        <div class="top-row">
          <span class="dot" style="background:${cat.color}"></span>
          <div class="name">${escapeHtml(cat.label)}</div>
        </div>
        <div class="stat"><span class="n">${c.total}</span><span class="of">개</span></div>
        <div class="of">${c.done} 클리어</div>
        <div class="prog-track"><div class="prog-fill" style="width:${pct}%; background:${cat.color}"></div></div>
      </button>`;
    }).join('');
    grid.querySelectorAll('.cat-card').forEach(card=>{
      card.addEventListener('click', ()=>{
        APP.state.category = card.dataset.cat;
        APP.state.listStatus = 'all';
        saveState();
        goToScreen('list');
        renderListScreen();
      });
    });
  }

  /* ---------------------------------------------------------
     8. 화면: 클리어
     --------------------------------------------------------- */
  function renderClearedScreen(){
    const container = document.getElementById('clearedContainer');
    const emptyEl = document.getElementById('clearedEmpty');
    const countEl = document.getElementById('clearedResultCount');

    document.querySelectorAll('#segClearedStatus button').forEach(b=>{
      b.classList.toggle('active', b.dataset.v === APP.state.clearedStatus);
    });
    document.getElementById('sortSelectCleared').value = APP.state.sort.cleared;

    let list = filterByStatus(GAMES, APP.state.clearedStatus);
    list = sortGames(list, APP.state.sort.cleared);
    countEl.textContent = `${list.length}개`;

    if(list.length === 0){
      container.innerHTML = '';
      emptyEl.classList.add('show');
    }else{
      emptyEl.classList.remove('show');
      renderGroupedList(container, list, { grouped:true });
    }
  }

  /* ---------------------------------------------------------
     9. 화면: 즐겨찾기
     --------------------------------------------------------- */
  function renderFavoritesScreen(){
    const container = document.getElementById('favContainer');
    const emptyEl = document.getElementById('favEmpty');
    const countEl = document.getElementById('favResultCount');

    document.getElementById('sortSelectFav').value = APP.state.sort.fav;

    let list = GAMES.filter(g=>isFav(g.id));
    list = sortGames(list, APP.state.sort.fav);
    countEl.textContent = `${list.length}개`;

    if(list.length === 0){
      container.innerHTML = '';
      emptyEl.classList.add('show');
    }else{
      emptyEl.classList.remove('show');
      renderGroupedList(container, list, { grouped:true });
    }
  }

  /* ---------------------------------------------------------
     10. 검색
     --------------------------------------------------------- */
  let prevScreenBeforeSearch = 'list';

  function runSearch(q){
    const container = document.getElementById('searchContainer');
    const emptyEl = document.getElementById('searchEmpty');
    const countEl = document.getElementById('searchResultCount');

    let list = filterBySearch(GAMES, q);
    list = sortGames(list, 'number');
    countEl.textContent = q ? `"${q}" 검색 결과 ${list.length}개` : '';

    if(!q || list.length === 0){
      container.innerHTML = '';
      emptyEl.classList.toggle('show', !!q);
    }else{
      emptyEl.classList.remove('show');
      // 검색 결과에는 카테고리 배지를 함께 표시
      container.innerHTML = list.map(g=>{
        const cat = CAT_MAP[g.category];
        const done = isCleared(g.id);
        const fav = isFav(g.id);
        return `
        <div class="row ${done?'cleared':''}" data-id="${g.id}">
          <div class="no">${g.number != null ? g.number : ''}</div>
          <div class="main">
            <span class="cat-dot" style="background:${cat?cat.color:'#999'}"></span>
            <div class="title">${escapeHtml(g.title)}</div>
            <button class="star-btn ${fav?'active':''}" data-action="fav" aria-label="즐겨찾기">${fav?STAR_SVG:STAR_OUTLINE_SVG}</button>
            <button class="check-btn" data-action="check" aria-label="클리어 체크">
              <span class="check-circle">${CHECK_SVG}</span>
            </button>
          </div>
        </div>`;
      }).join('');
    }
  }

  /* ---------------------------------------------------------
     11. 데스크톱(PC) 그리드
     --------------------------------------------------------- */
  function renderPcGrid(query){
    const grid = document.getElementById('pcGrid');
    const q = (query||'').trim().toLowerCase();
    grid.innerHTML = '';
    let anyVisible = false;

    CATEGORIES.forEach(cat=>{
      let list = GAMES.filter(g=>g.category===cat.key);
      if(q){
        list = list.filter(g=> g.title.toLowerCase().includes(q) || String(g.number).includes(q));
      }
      list = sortGames(list, APP.state.pcSort || 'number');
      if(q && list.length===0) return; // 검색 중엔 결과 없는 패널 숨김
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
            <button class="chk" data-action="check">${done?CHECK_SVG.replace('#fff','currentColor'):''}</button>
          </div>
        </div>`;
      }).join('');
      grid.appendChild(panel);
    });

    if(!anyVisible){
      grid.innerHTML = '<div class="pc-empty">검색 결과가 없습니다</div>';
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
        btn.innerHTML = done ? CHECK_SVG.replace('#fff','currentColor') : '';
      }else if(btn.dataset.action === 'fav'){
        toggleFav(id);
        const fav = isFav(id);
        btn.classList.toggle('active', fav);
        btn.innerHTML = fav ? STAR_SVG : STAR_OUTLINE_SVG;
      }
      renderSummary();
      renderCategoryGridSoft();
    });
  }

  function renderCategoryGridSoft(){
    // 카테고리 탭이 열려있을 때만 갱신 (성능 절약)
    if(APP.state.tab === 'categories') renderCategoriesScreen();
  }

  /* ---------------------------------------------------------
     12. 화면 전환
     --------------------------------------------------------- */
  const SCREEN_IDS = ['list','categories','cleared','favorites','search'];
  function goToScreen(name, opts){
    opts = opts || {};
    SCREEN_IDS.forEach(id=>{
      const s = document.getElementById('screen-'+id);
      if(s) s.classList.toggle('active', id===name);
    });
    document.querySelectorAll('.nav-btn').forEach(b=>{
      b.classList.toggle('active', b.dataset.screen === name);
    });
    if(name !== 'search'){
      APP.state.tab = name;
      saveState();
    }
    if(opts.restoreScroll && APP.state.scroll && APP.state.scroll[name]){
      // 콘텐츠가 렌더링된 다음 프레임에 스크롤 위치를 복원
      requestAnimationFrame(()=>{
        requestAnimationFrame(()=>{
          window.scrollTo({top: APP.state.scroll[name], behavior:'auto'});
        });
      });
    }else{
      window.scrollTo({top:0, behavior:'auto'});
    }
  }

  // 탭별 스크롤 위치 기억 (다음 접속 시 복원)
  let scrollSaveTimer = null;
  function initScrollMemory(){
    window.addEventListener('scroll', ()=>{
      const tab = APP.state.tab;
      if(!tab || tab === 'search') return;
      clearTimeout(scrollSaveTimer);
      scrollSaveTimer = setTimeout(()=>{
        APP.state.scroll = APP.state.scroll || {};
        APP.state.scroll[tab] = window.scrollY;
        saveState();
      }, 250);
    }, {passive:true});
    window.addEventListener('beforeunload', ()=>{
      const tab = APP.state.tab;
      if(!tab || tab === 'search') return;
      APP.state.scroll = APP.state.scroll || {};
      APP.state.scroll[tab] = window.scrollY;
      saveState();
    });
  }

  /* ---------------------------------------------------------
     13. 이벤트 바인딩
     --------------------------------------------------------- */
  function initNav(){
    document.getElementById('bottomNav').addEventListener('click', function(e){
      const btn = e.target.closest('.nav-btn');
      if(!btn) return;
      closeSearch();
      goToScreen(btn.dataset.screen);
      renderCurrentScreen();
    });
  }

  function renderCurrentScreen(){
    switch(APP.state.tab){
      case 'list': renderListScreen(); break;
      case 'categories': renderCategoriesScreen(); break;
      case 'cleared': renderClearedScreen(); break;
      case 'favorites': renderFavoritesScreen(); break;
    }
  }

  function initListControls(){
    document.getElementById('segListStatus').addEventListener('click', e=>{
      const b = e.target.closest('button'); if(!b) return;
      APP.state.listStatus = b.dataset.v;
      saveState();
      renderListScreen();
    });
    document.getElementById('sortSelectList').addEventListener('change', e=>{
      APP.state.sort.list = e.target.value;
      saveState();
      renderListScreen();
    });
    bindRowDelegation(document.getElementById('listContainer'), ()=>{
      renderSummary();
      renderCategoryGridSoft();
    });
  }

  function initClearedControls(){
    document.getElementById('segClearedStatus').addEventListener('click', e=>{
      const b = e.target.closest('button'); if(!b) return;
      APP.state.clearedStatus = b.dataset.v;
      saveState();
      renderClearedScreen();
    });
    document.getElementById('sortSelectCleared').addEventListener('change', e=>{
      APP.state.sort.cleared = e.target.value;
      saveState();
      renderClearedScreen();
    });
    bindRowDelegation(document.getElementById('clearedContainer'), ()=>{
      renderSummary();
      renderClearedScreen();
      renderCategoryGridSoft();
    });
  }

  function initFavControls(){
    document.getElementById('sortSelectFav').addEventListener('change', e=>{
      APP.state.sort.fav = e.target.value;
      saveState();
      renderFavoritesScreen();
    });
    bindRowDelegation(document.getElementById('favContainer'), ()=>{
      renderSummary();
      renderFavoritesScreen();
    });
  }

  function initSearchControls(){
    const btnSearch = document.getElementById('btnSearch');
    const searchRow = document.getElementById('searchRow');
    const input = document.getElementById('searchInput');
    const btnCancel = document.getElementById('btnSearchCancel');

    btnSearch.addEventListener('click', ()=>{
      searchRow.classList.add('open');
      input.focus();
      prevScreenBeforeSearch = APP.state.tab;
      goToScreenSearch();
    });
    btnCancel.addEventListener('click', closeSearch);
    input.addEventListener('input', ()=> runSearch(input.value));

    bindRowDelegation(document.getElementById('searchContainer'), ()=>{
      renderSummary();
      runSearch(input.value);
      renderCategoryGridSoft();
    });

    function goToScreenSearch(){
      SCREEN_IDS.forEach(id=>{
        const s = document.getElementById('screen-'+id);
        if(s) s.classList.toggle('active', id==='search');
      });
    }
  }
  function closeSearch(){
    const searchRow = document.getElementById('searchRow');
    const input = document.getElementById('searchInput');
    searchRow.classList.remove('open');
    input.value = '';
    goToScreen(prevScreenBeforeSearch);
    renderCurrentScreen();
  }

  function initPcControls(){
    const input = document.getElementById('pcSearchInput');
    if(!input) return;
    input.addEventListener('input', ()=> renderPcGrid(input.value));
    document.getElementById('pcBtnSort').addEventListener('click', function(){
      APP.state.pcSort = (APP.state.pcSort === 'title') ? 'number' : 'title';
      this.textContent = APP.state.pcSort === 'title' ? '가나다순' : '번호순';
      renderPcGrid(input.value);
    });
  }

  /* ---------------------------------------------------------
     14. 백업 / 복원 / 초기화
     --------------------------------------------------------- */
  function exportBackup(){
    const payload = {
      app: 'switch-game-library',
      version: 1,
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
        renderCurrentScreen();
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
    renderCurrentScreen();
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
     15. 뒤로가기(맨 위로) 버튼
     --------------------------------------------------------- */
  function initScrollTop(){
    const btn = document.getElementById('btnTop');
    window.addEventListener('scroll', ()=>{
      btn.classList.toggle('show', window.scrollY > 500);
    }, {passive:true});
    btn.addEventListener('click', ()=> window.scrollTo({top:0, behavior:'smooth'}));
  }

  /* ---------------------------------------------------------
     16. 설치(PWA) / 전체화면
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
     17. 초기화
     --------------------------------------------------------- */
  function restoreInitialUi(){
    // 마지막 탭 + 마지막 스크롤 위치 복원 (앱을 다시 열었을 때)
    goToScreen(APP.state.tab || 'list', { restoreScroll:true });
  }

  function init(){
    renderSummary();
    initNav();
    initListControls();
    initClearedControls();
    initFavControls();
    initSearchControls();
    initPcControls();
    initPcRowActions();
    initDataControls();
    initScrollTop();
    initScrollMemory();
    initInstall();
    initFullscreen();

    restoreInitialUi();
    renderCurrentScreen();
    renderPcGrid('');

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
