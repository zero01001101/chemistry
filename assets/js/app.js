
(() => {
  const DATA = window.CHEMISTRY_DATA;
  const STORE_KEY = 'chemistryEnglishSpecializedUserData.v1';
  const $app = document.getElementById('app');
  const $toast = document.getElementById('toast');

  const UA = navigator.userAgent || '';
  const IS_SAFARI = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(UA);
  const IS_IOS = /iphone|ipad|ipod/i.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const RecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  const speechEngine = { voices: [], ready: false, unlocked: false, lastVoice: null };
  let recognitionInstance = null;

  const defaultUserData = () => ({
    version: 1,
    savedAt: new Date().toISOString(),
    profile: { name: '', goal: 'Học tiếng Anh hóa học chuyên ngành' },
    progress: {},
    difficultTerms: [],
    masteredTerms: [],
    notes: {},
    customTerms: {},
    testHistory: [],
    listeningHistory: [],
    speakingHistory: [],
    audioSettings: { lang: 'en-US', rate: 0.86, pitch: 1.06, volume: 1, preferredVoice: '' },
    preferences: { theme: 'light' }
  });

  let userData = loadUserData();
  applyTheme(userData.preferences?.theme || 'light');
  initSpeechSystem();
  let route = { screen: 'splash', weekId: null, tab: 'learn' };
  let ui = { search: '', flashIndex: 0, flashFlipped: false, flashDirection: 'right', flashPointer: null, flashSwipeBlock: false, drawerOpen: false, controlPanelOpen: false, quiz: null, review: null, speaking: null, voicePanelOpen: false };

  function normalizeUserData(data = {}) {
    const defaults = defaultUserData();
    const merged = { ...defaults, ...data };
    merged.audioSettings = { ...defaults.audioSettings, ...(data.audioSettings || {}) };
    merged.preferences = { ...defaults.preferences, ...(data.preferences || {}) };
    merged.progress = data.progress || defaults.progress;
    merged.difficultTerms = Array.isArray(data.difficultTerms) ? data.difficultTerms : defaults.difficultTerms;
    merged.masteredTerms = Array.isArray(data.masteredTerms) ? data.masteredTerms : defaults.masteredTerms;
    merged.notes = data.notes || defaults.notes;
    merged.customTerms = data.customTerms || defaults.customTerms;
    merged.testHistory = Array.isArray(data.testHistory) ? data.testHistory : defaults.testHistory;
    merged.listeningHistory = Array.isArray(data.listeningHistory) ? data.listeningHistory : defaults.listeningHistory;
    merged.speakingHistory = Array.isArray(data.speakingHistory) ? data.speakingHistory : defaults.speakingHistory;
    return merged;
  }

  function loadUserData() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return defaultUserData();
      return normalizeUserData(JSON.parse(raw));
    } catch (err) {
      console.warn(err);
      return defaultUserData();
    }
  }

  function currentTheme() {
    return userData.preferences?.theme === 'dark' ? 'dark' : 'light';
  }

  function themeLabel() {
    return currentTheme() === 'dark' ? '☀️ Sáng' : '🌙 Tối';
  }

  function applyTheme(theme = 'light') {
    const safeTheme = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = safeTheme;
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', safeTheme === 'dark' ? '#07111f' : '#f8fbff');
  }

  function toggleTheme() {
    userData.preferences = userData.preferences || {};
    userData.preferences.theme = currentTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(userData.preferences.theme);
    persist();
    toast(userData.preferences.theme === 'dark' ? 'Đã bật mode tối' : 'Đã bật mode sáng');
    render();
  }

  function persist() {
    userData.savedAt = new Date().toISOString();
    localStorage.setItem(STORE_KEY, JSON.stringify(userData));
  }

  function toast(msg) {
    $toast.textContent = msg;
    $toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => $toast.classList.remove('show'), 2300);
  }

  function esc(s = '') {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function strip(s = '') {
    return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s;()\-–—]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function shuffle(arr) {
    return [...arr].sort(() => Math.random() - 0.5);
  }

  function sample(arr, n) {
    return shuffle(arr).slice(0, n);
  }

  function termKey(weekId, term) {
    return `${weekId}:${term.id || term.customId || term.english}`;
  }

  function getWeek(weekId) {
    return DATA.weeks.find(w => w.id === Number(weekId));
  }

  function allBaseTerms() {
    return DATA.weeks.flatMap(w => w.terms.map(t => ({ ...t, weekId: w.id, weekTitle: w.title })));
  }

  function getWeekTerms(week) {
    const custom = userData.customTerms[String(week.id)] || [];
    return [...week.terms, ...custom.map((t, idx) => ({ id: `C${idx + 1}`, customId: t.customId, english: t.english, vietnamese: t.vietnamese, note: t.note || 'Từ tự thêm vào file data cá nhân.', example: t.example || '', page: 'custom' }))];
  }

  function computeStats() {
    const totalTerms = DATA.weeks.reduce((a, w) => a + w.termCount, 0);
    const done = Object.values(userData.progress || {}).filter(Boolean).length;
    return { weeks: DATA.weeks.length, totalTerms, mastered: userData.masteredTerms.length, difficult: userData.difficultTerms.length, done };
  }

  function weekProgress(week) {
    const terms = getWeekTerms(week);
    if (!terms.length) return 0;
    const mastered = terms.filter(t => userData.masteredTerms.includes(termKey(week.id, t))).length;
    return Math.round(mastered / terms.length * 100);
  }

  function render() {
    if (route.screen === 'splash') return renderSplash();
    const drawer = renderDataDrawer();
    $app.innerHTML = `${renderTopbar()}${renderControlPanelOverlay()}<div class="layout compact-layout">${renderSidePanel()}<section class="main-content">${route.screen === 'home' ? renderHome() : renderWeek()}</section></div>${drawer}`;
    bindGlobal();
    if (route.screen === 'week') bindWeek();
  }

  function renderSplash() {
    const stats = computeStats();
    $app.innerHTML = `
      <section class="splash">
        <div class="splash-grid"></div>
        <div class="splash-card">
          <div>
            <span class="eyebrow">⚗️ English for Chemistry • GitHub Pages Ready</span>
            <h1 class="hero-title"><span class="gradient-text">Học tiếng Anh hóa học</span><br/>chuyên ngành theo tuần</h1>
            <p class="lead">Màn hình chờ → chọn tuần theo đúng folder trong ZIP → học bài, ôn tập, kiểm tra. Có flashcard, active recall, đọc giọng nữ chuẩn, bài nghe chọn đáp án, bài nói nhận micro, trắc nghiệm 4 đáp án, điền từ Anh↔Việt, giải thích lỗi sai sau khi nộp bài và lưu tiến độ bằng file data cá nhân.</p>
            <div class="hero-actions">
              <button class="btn primary" id="enterApp">Vào học →</button>
              <button class="btn theme-toggle" data-action="theme">${themeLabel()}</button>
              <a class="btn" href="${esc(DATA.guidePdf)}" target="_blank" rel="noreferrer">Lộ trình</a>
            </div>
            <div class="stat-strip">
              <div class="mini-stat"><strong>${stats.weeks}</strong><span>tuần/chủ đề</span></div>
              <div class="mini-stat"><strong>${stats.totalTerms}</strong><span>thuật ngữ đã trích</span></div>
              <div class="mini-stat"><strong>6+</strong><span>kiểu học/nghe/nói</span></div>
            </div>
          </div>
          <div class="atom-stage" aria-hidden="true">
            <div class="orbit o1"></div><div class="orbit o2"></div><div class="orbit o3"></div><div class="nucleus"></div>
          </div>
        </div>
      </section>`;
    document.getElementById('enterApp').addEventListener('click', () => { route.screen = 'home'; render(); });
    document.querySelectorAll('[data-action="theme"]').forEach(el => el.addEventListener('click', toggleTheme));
  }

  function renderTopbar() {
    return `<header class="topbar">
      <a class="brand" href="#" data-action="home"><span class="logo">⚗️</span><span>English Chemistry<br><small class="muted">${esc(DATA.meta.generatedAt || '')}</small></span></a>
      <div class="searchbar"><input id="globalSearch" value="${esc(ui.search)}" placeholder="Tìm tuần, từ tiếng Anh, nghĩa tiếng Việt, ghi chú..." /></div>
      <div class="nav-actions compact-nav">
        <button class="btn small icon-btn" data-action="home" aria-label="Trang chủ">⌂</button>
        <button class="btn small panel-toggle" data-action="panel" aria-label="Mở bảng điều khiển">☷ Bảng</button>
        <details class="action-menu top-menu">
          <summary class="btn small">☰ Menu</summary>
          <div class="menu-list">
            <button class="btn small" data-action="home">⌂ Trang chủ</button>
            <button class="btn small" data-action="panel">☷ Bảng điều khiển</button>
            <a class="btn small" href="${esc(DATA.guidePdf)}" target="_blank" rel="noreferrer">📄 Lộ trình</a>
            <button class="btn small theme-toggle" data-action="theme">${themeLabel()}</button>
            <button class="btn small" data-action="audioCheck">🔊 Test</button>
            <button class="btn small" data-action="data">💾 Data</button>
          </div>
        </details>
      </div>
    </header>`;
  }

  function renderControlPanelOverlay() {
    return `<div class="overlay control-overlay ${ui.controlPanelOpen ? 'open' : ''}" data-action="closePanel"></div>`;
  }

  function renderSidePanel() {
    const stats = computeStats();
    const weekButtons = DATA.weeks.map(w => `<button class="tab ${route.weekId === w.id ? 'active' : ''}" data-week="${w.id}">T${String(w.id).padStart(2, '0')}</button>`).join('');
    return `<aside class="panel control-panel ${ui.controlPanelOpen ? 'open' : ''}" aria-label="Bảng điều khiển">
      <div class="control-panel-head"><h2 style="margin:0">☷ Bảng</h2><button class="btn small icon-btn" data-action="closePanel" aria-label="Đóng bảng điều khiển">×</button></div>
      <p class="muted" style="line-height:1.6">Dữ liệu lấy từ ZIP gốc, gồm PDF gốc + thuật ngữ trích bảng + bài luyện/đáp án raw text.</p>
      <div class="grid cols-2" style="margin:14px 0">
        <div class="dash-card"><strong>${stats.totalTerms}</strong><span>từ vựng</span></div>
        <div class="dash-card"><strong>${stats.mastered}</strong><span>đã thuộc</span></div>
        <div class="dash-card"><strong>${stats.difficult}</strong><span>khó nhớ</span></div>
        <div class="dash-card"><strong>${userData.testHistory.length}</strong><span>lần kiểm tra</span></div>
      </div>
      <div class="audio-status">
        <b>Âm thanh:</b> ${speechSupportLabel()}<br>
        <b>Nói:</b> ${RecognitionCtor ? 'Có SpeechRecognition/webkitSpeechRecognition' : 'Không có nhận giọng nói, dùng nhập tay'}
      </div>
      <h3>Chọn tuần nhanh</h3>
      <div class="chip-row">${weekButtons}</div>
    </aside>`;
  }

  function renderHome() {
    const stats = computeStats();
    const q = strip(ui.search);
    let weeks = DATA.weeks;
    if (q) {
      weeks = weeks.filter(w => {
        const hay = strip(`${w.title} ${w.folder} ${w.terms.slice(0, 30).map(t => `${t.english} ${t.vietnamese}`).join(' ')}`);
        return hay.includes(q);
      });
    }
    return `<section class="section">
      <h1 class="section-title">Chọn tuần học</h1>
      <p class="muted">Mỗi tuần có 3 nhánh chính: <b>Học bài</b>, <b>Ôn tập</b>, <b>Kiểm tra</b>. Bấm vào tuần để mở.</p>
      <div class="dashboard">
        <div class="dash-card"><strong>${stats.weeks}</strong><span>folder tuần</span></div>
        <div class="dash-card"><strong>${stats.totalTerms}</strong><span>thuật ngữ trong data</span></div>
        <div class="dash-card"><strong>${stats.mastered}</strong><span>đã đánh dấu thuộc</span></div>
        <div class="dash-card"><strong>${stats.difficult}</strong><span>cần ôn lại</span></div>
      </div>
      <div class="grid cols-4">${weeks.map(renderWeekCard).join('')}</div>
      ${weeks.length ? '' : '<div class="empty">Không tìm thấy tuần/từ nào khớp.</div>'}
    </section>`;
  }

  function renderWeekCard(w) {
    const progress = weekProgress(w);
    return `<article class="card week-card" data-open-week="${w.id}">
      <span class="week-no">${String(w.id).padStart(2, '0')}</span>
      <h2 class="week-title">${esc(w.title)}</h2>
      <div class="chip-row"><span class="chip good">${w.termCount} từ</span><span class="chip">Học bài</span><span class="chip">Ôn tập</span><span class="chip warn">Kiểm tra</span></div>
      <div style="margin-top:18px"><div class="progress"><i style="width:${progress}%"></i></div><p class="muted">${progress}% đã thuộc</p></div>
    </article>`;
  }

  function renderWeek() {
    const week = getWeek(route.weekId) || DATA.weeks[0];
    route.weekId = week.id;
    const tab = route.tab || 'learn';
    return `<section class="section">
      <button class="btn small ghost" data-action="home">← Quay lại chọn tuần</button>
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:12px">
        <div><h1 class="section-title">Tuần ${String(week.id).padStart(2, '0')} — ${esc(week.title)}</h1><p class="muted">Folder: <span class="kbd">${esc(week.folder)}</span> • ${getWeekTerms(week).length} thuật ngữ</p></div>
        <div class="source-links compact-nav">
          <details class="action-menu doc-menu">
            <summary class="btn small">📄 Tài liệu</summary>
            <div class="menu-list">
              <a class="btn small" href="${esc(week.pdfs.vocabulary)}" target="_blank" rel="noreferrer">Từ vựng</a>
              <a class="btn small" href="${esc(week.pdfs.practice)}" target="_blank" rel="noreferrer">Bài luyện</a>
              ${week.pdfs.lookup ? `<a class="btn small" href="${esc(week.pdfs.lookup)}" target="_blank" rel="noreferrer">Mục lục A–Z</a>` : ''}
            </div>
          </details>
        </div>
      </div>
      <div class="tabs">
        <button class="tab ${tab==='learn'?'active':''}" data-tab="learn">📘 Học</button>
        <button class="tab ${tab==='review'?'active':''}" data-tab="review">🧠 Ôn</button>
        <button class="tab ${tab==='test'?'active':''}" data-tab="test">🧪 Thi</button>
        <button class="tab ${tab==='speaking'?'active':''}" data-tab="speaking">🎙️ Nói</button>
        <button class="tab ${tab==='source'?'active':''}" data-tab="source">📄 Gốc</button>
      </div>
      ${tab === 'learn' ? renderLearn(week) : tab === 'review' ? renderReview(week) : tab === 'test' ? renderTest(week) : tab === 'speaking' ? renderSpeaking(week) : renderSource(week)}
    </section>`;
  }

  function filteredTerms(week) {
    const terms = getWeekTerms(week);
    const q = strip(ui.search);
    if (!q) return terms;
    return terms.filter(t => strip(`${t.english} ${t.vietnamese} ${t.note} ${t.example}`).includes(q));
  }

  function renderLearn(week) {
    const terms = filteredTerms(week);
    if (ui.flashIndex >= terms.length) ui.flashIndex = 0;
    const t = terms[ui.flashIndex] || getWeekTerms(week)[0];
    const key = t ? termKey(week.id, t) : '';
    const mastered = userData.masteredTerms.includes(key);
    const difficult = userData.difficultTerms.includes(key);
    return `<div class="study-shell">
      <div class="card flashcard flip-${ui.flashDirection || 'right'} ${ui.flashFlipped ? 'flipped' : ''}" id="flashcard" role="button" tabindex="0" aria-label="Flashcard: bấm để lật random, vuốt để lật theo hướng">
        ${t ? `<div class="flash-inner">
          <div class="flash-face front"><span class="eyebrow">Mặt trước • English → Vietnamese</span><div class="big-term">${esc(t.english)}</div><p class="muted flash-hint">Bấm: lật random • Giữ cạnh thẻ rồi kéo để xoay quanh trục, kéo quá nửa rồi thả sẽ lật • ${ui.flashIndex + 1}/${terms.length}</p></div>
          <div class="flash-face back"><span class="eyebrow">Mặt sau • Nghĩa + ngữ cảnh</span><div class="big-term" style="font-size:34px">${esc(t.vietnamese)}</div><p class="term-note">${esc(t.note)}</p><p class="muted"><i>${esc(t.example)}</i></p></div>
        </div>` : '<div class="empty">Không có từ trong bộ lọc.</div>'}
      </div>
      <div class="card" style="padding:18px">
        <div class="flash-toolbar compact-toolbar" style="margin-bottom:12px">
          <button class="btn small icon-btn" data-flash="prev" aria-label="Từ trước">←</button>
          <button class="btn small primary" data-flash="flip">Lật</button>
          <button class="btn small icon-btn" data-flash="next" aria-label="Từ sau">→</button>
          <button class="btn small ${mastered?'success':''}" data-term-mark="mastered">${mastered?'Thuộc ✓':'Thuộc'}</button>
          <button class="btn small ${difficult?'danger':''}" data-term-mark="difficult">${difficult?'Khó !':'Khó'}</button>
          <details class="action-menu inline-menu">
            <summary class="btn small">🔊 Nghe</summary>
            <div class="menu-list">
              <button class="btn small" data-speak="${esc(t?.english || '')}" data-rate="0.86">Nữ chuẩn</button>
              <button class="btn small" data-speak="${esc(t?.english || '')}" data-rate="0.68">Đọc chậm</button>
              <button class="btn small" data-speak="${esc(t?.example || t?.english || '')}" data-rate="0.82">Ví dụ</button>
            </div>
          </details>
        </div>
        <div class="control"><label>Ghi chú riêng cho từ đang học</label><textarea id="noteInput" placeholder="Ví dụ mẹo nhớ, công thức liên quan, câu tự đặt...">${esc((userData.notes || {})[key] || '')}</textarea></div>
        <button class="btn small compact-fit" data-action="saveNote" data-term-key="${esc(key)}">💾 Lưu</button>
        ${renderVoicePanel()}
        <h3>Danh sách thuật ngữ</h3>
        <div class="term-list">${terms.map((row, i) => renderTermRow(week, row, i)).join('')}</div>
      </div>
    </div>`;
  }

  function renderTermRow(week, t, i) {
    const key = termKey(week.id, t);
    const mastered = userData.masteredTerms.includes(key);
    const difficult = userData.difficultTerms.includes(key);
    return `<div class="term-row" data-select-term="${i}">
      <div class="term-index">${esc(t.id)}</div>
      <div><div class="term-en">${esc(t.english)}</div><div class="term-vi">${esc(t.vietnamese)}</div><div class="term-note">${esc(t.note)}</div></div>
      <div class="two-actions"><span class="chip ${mastered?'good':''}">${mastered?'thuộc':'chưa'}</span>${difficult?'<span class="chip warn">khó</span>':''}</div>
    </div>`;
  }

  function renderReview(week) {
    const active = ui.review;
    return `<div class="grid cols-2">
      <div class="card method-card">
        <h2>Phương pháp học từ vựng hiện đại dễ nhớ</h2>
        <div class="grid">
          ${[
            ['Active Recall','Che nghĩa tiếng Việt, tự nói nghĩa + đặt câu trước khi xem đáp án. Não phải tự lôi kiến thức ra nên nhớ lâu hơn.'],
            ['Spaced Repetition 1–3–7–14','Ôn lại sau 1 ngày, 3 ngày, 7 ngày, 14 ngày. Từ nào sai đưa vào nhóm “Khó nhớ”.'],
            ['Leitner Box','Thuộc thì đẩy sang hộp xa hơn, sai thì kéo về hộp đầu. App dùng nút “Đã thuộc/Khó nhớ”.'],
            ['Dual Coding','Gắn mỗi từ với hình dung thí nghiệm, công thức, dụng cụ hoặc hiện tượng hóa học.'],
            ['Reverse Translation','Dịch Anh→Việt rồi đổi chiều Việt→Anh. Đây là cách chống học vẹt cực tốt.'],
            ['Context Sentence','Không học mỗi từ đơn. Đọc ví dụ trong data rồi tự viết 1 câu mới theo bài của mình.']
          ].map(m => `<div class="method-card card"><h3>${m[0]}</h3><p>${m[1]}</p></div>`).join('')}
        </div>
        <h3>Lịch ôn khuyến nghị</h3>
        <div class="timeline"><div class="step"><b>Hôm nay</b><br><span class="muted">học mới</span></div><div class="step"><b>+1 ngày</b><br><span class="muted">nhớ lại</span></div><div class="step"><b>+3 ngày</b><br><span class="muted">đảo chiều</span></div><div class="step"><b>+7 ngày</b><br><span class="muted">kiểm tra</span></div><div class="step"><b>+14 ngày</b><br><span class="muted">chốt</span></div></div>
      </div>
      <div class="card method-card">
        <h2>Ôn tập nhanh</h2>
        <p class="muted">Chế độ này hỏi từng câu và phản hồi ngay. Muốn chấm điểm đầy đủ thì sang tab Kiểm tra.</p>
        <div class="two-actions">
          <button class="btn primary" data-review-start="en-vi">Anh → Việt</button>
          <button class="btn primary" data-review-start="vi-en">Việt → Anh</button>
          <button class="btn" data-review-start="mixed">Trộn 2 chiều</button>
        </div>
        ${active ? renderReviewActive(week, active) : '<div class="empty" style="margin-top:16px">Chọn một chế độ để bắt đầu ôn.</div>'}
        <h3 style="margin-top:18px">Thêm từ riêng vào data cá nhân</h3>
        ${renderAddTermForm(week)}
      </div>
    </div>`;
  }

  function renderReviewActive(week, active) {
    const q = active.questions[active.index];
    if (!q) return '<div class="empty" style="margin-top:16px">Đã hết câu. Bấm chọn chế độ để ôn lại.</div>';
    return `<div class="quiz-question">
      <div class="question-head"><span class="chip">Câu ${active.index + 1}/${active.questions.length}</span><span class="chip warn">${esc(q.directionLabel)}</span></div>
      <div class="question-text">${esc(q.prompt)}</div>
      ${q.kind === 'mcq' ? `<div class="answers">${q.options.map(o => `<button class="answer" data-review-answer="${esc(o)}">${esc(o)}</button>`).join('')}</div>` : `<div class="control fill-input"><input id="reviewFill" placeholder="Nhập đáp án..." /></div><button class="btn small primary" data-review-fill-submit>Kiểm tra</button>`}
      ${active.feedback ? `<div class="explanation"><b>${active.feedback.ok ? 'Đúng rồi ✓' : 'Sai rồi ✗'}</b><br>Đáp án: <b>${esc(q.answer)}</b><br>${esc(q.explanation)}</div><button class="btn small" data-review-next>Câu tiếp →</button>` : ''}
    </div>`;
  }

  function renderAddTermForm(week) {
    return `<div class="grid">
      <div class="form-grid">
        <div class="control"><label>English term</label><input id="customEnglish" placeholder="VD: titration curve"></div>
        <div class="control"><label>Nghĩa tiếng Việt</label><input id="customVietnamese" placeholder="VD: đường cong chuẩn độ"></div>
      </div>
      <div class="control"><label>Giải thích</label><textarea id="customNote" placeholder="Ghi chú/cách dùng..."></textarea></div>
      <div class="control"><label>Ví dụ ngữ cảnh</label><textarea id="customExample" placeholder="A titration curve shows..."></textarea></div>
      <button class="btn success compact-fit" data-add-custom-term="${week.id}">+ Thêm từ</button>
    </div>`;
  }

  function renderTest(week) {
    if (ui.quiz && ui.quiz.weekId === week.id) return renderQuiz(week);
    return `<div class="card quiz-board">
      <h2>Tạo bài kiểm tra</h2>
      <p class="muted">Tự sinh câu hỏi từ toàn bộ từ vựng của tuần. Có trắc nghiệm 4 đáp án, điền từ Anh↔Việt, nghe tiếng Anh rồi chọn nghĩa, và phần nói riêng có chấm phát âm. Sau khi nộp sẽ hiện đáp án, câu sai và giải thích từng câu.</p>
      <div class="form-grid">
        <div class="control"><label>Kiểu câu</label><select id="quizKind"><option value="full">Trộn tất cả: trắc nghiệm + điền + nghe</option><option value="mixed">Trộn trắc nghiệm + điền từ</option><option value="listen">Nghe xong chọn đáp án</option><option value="mcq">Chỉ trắc nghiệm 4 đáp án</option><option value="fill">Chỉ điền từ</option></select></div>
        <div class="control"><label>Chiều dịch</label><select id="quizDirection"><option value="mixed">Trộn Anh→Việt + Việt→Anh</option><option value="en-vi">English → Vietnamese</option><option value="vi-en">Vietnamese → English</option></select></div>
        <div class="control"><label>Số câu</label><input id="quizCount" type="number" min="5" max="100" value="20"></div>
        <div class="control"><label>Nguồn câu</label><select id="quizScope"><option value="week">Tuần hiện tại</option><option value="all">Tất cả 24 tuần</option><option value="difficult">Chỉ từ khó nhớ</option></select></div>
      </div>
      <button class="btn primary compact-fit" data-start-quiz="${week.id}">Bắt đầu</button>
    </div>`;
  }

  function renderQuiz(week) {
    const quiz = ui.quiz;
    if (quiz.submitted) return renderQuizResults(week, quiz);
    return `<div class="card quiz-board">
      <div class="question-head"><h2 style="margin:0">Bài kiểm tra tuần ${String(week.id).padStart(2, '0')}</h2><span class="chip warn">${quiz.questions.length} câu</span></div>
      ${quiz.questions.map((q, i) => `<div class="quiz-question" data-q="${i}">
        <div class="question-head"><span class="chip">Câu ${i + 1}</span><span class="chip">${esc(q.kind === 'listen' ? 'Nghe chọn đáp án' : q.kind === 'mcq' ? 'Trắc nghiệm 4 đáp án' : 'Điền từ')}</span><span class="chip warn">${esc(q.directionLabel)}</span></div>
        ${renderQuizQuestionInput(q, i, quiz)}
      </div>`).join('')}
      <div class="two-actions compact-toolbar"><button class="btn primary" data-submit-quiz>Nộp</button><button class="btn danger" data-cancel-quiz>Hủy</button></div>
    </div>`;
  }

  function renderQuizResults(week, quiz) {
    const correct = quiz.results.filter(r => r.ok).length;
    const percent = Math.round(correct / quiz.questions.length * 100);
    return `<div class="card quiz-board">
      <div class="score-hero"><div class="score-circle" style="--score:${percent}%">${percent}%</div><div><h2 style="margin:0">Kết quả: ${correct}/${quiz.questions.length} câu đúng</h2><p class="muted">Câu sai đã được ghi rõ đáp án và giải thích. Từ sai tự động đưa vào nhóm “Khó nhớ”.</p></div></div>
      ${quiz.questions.map((q, i) => {
        const r = quiz.results[i];
        return `<div class="quiz-question">
          <div class="question-head"><span class="chip ${r.ok ? 'good' : 'warn'}">${r.ok ? 'Đúng' : 'Sai'} • Câu ${i + 1}</span><span class="chip">${esc(q.directionLabel)}</span></div>
          <div class="question-text">${esc(q.kind === 'listen' ? 'Audio: ' + q.audioText : q.prompt)}</div>
          ${q.kind === 'mcq' || q.kind === 'listen' ? `<div class="answers">${q.options.map(o => `<div class="answer ${o === q.answer ? 'correct' : (quiz.answers[i] === o ? 'wrong' : '')}">${esc(o)}</div>`).join('')}</div>` : ''}
          <div class="explanation">
            <b>Đáp án đúng:</b> ${esc(q.answer)}<br>
            <b>Bạn trả lời:</b> ${esc(quiz.answers[i] || '(bỏ trống)')}<br>
            <b>Giải thích:</b> ${esc(q.explanation)}<br>
            ${q.example ? `<b>Ví dụ:</b> <i>${esc(q.example)}</i>` : ''}
          </div>
        </div>`;
      }).join('')}
      <div class="two-actions compact-toolbar"><button class="btn primary" data-new-quiz>Bài mới</button><button class="btn" data-action="data">Data</button></div>
    </div>`;
  }


  function renderQuizQuestionInput(q, i, quiz) {
    if (q.kind === 'listen') {
      return `<div class="listen-card">
        <div class="speaker-pulse">🔊</div>
        <div><div class="question-text">Nghe phát âm tiếng Anh rồi chọn nghĩa đúng</div><p class="muted">Safari/iPhone chặn tự phát âm thanh nên bấm nút nghe. Có thể bấm nghe lại nhiều lần.</p></div>
        <div class="two-actions compact-toolbar"><button class="btn primary" data-speak="${esc(q.audioText)}" data-rate="0.78">▶ Nghe</button><button class="btn icon-btn" data-speak-stop aria-label="Dừng âm">⏹</button></div>
      </div><div class="answers">${q.options.map((o, oi) => `<button class="answer ${quiz.answers[i] === o ? 'selected' : ''}" data-quiz-answer="${i}" data-value="${esc(o)}">${String.fromCharCode(65+oi)}. ${esc(o)}</button>`).join('')}</div>`;
    }
    if (q.kind === 'mcq') {
      return `<div class="question-text">${esc(q.prompt)}</div><div class="answers">${q.options.map((o, oi) => `<button class="answer ${quiz.answers[i] === o ? 'selected' : ''}" data-quiz-answer="${i}" data-value="${esc(o)}">${String.fromCharCode(65+oi)}. ${esc(o)}</button>`).join('')}</div>`;
    }
    return `<div class="question-text">${esc(q.prompt)}</div><div class="control fill-input"><input data-fill-answer="${i}" value="${esc(quiz.answers[i] || '')}" placeholder="Gõ đáp án ${q.direction === 'en-vi' ? 'tiếng Việt' : 'tiếng Anh'}..." /></div>`;
  }

  function renderVoicePanel() {
    const voices = speechEngine.voices || [];
    const selected = userData.audioSettings.preferredVoice || selectVoice()?.voiceURI || '';
    const voiceOptions = voices.filter(v => /^en/i.test(v.lang || '')).map(v => `<option value="${esc(v.voiceURI)}" ${v.voiceURI === selected ? 'selected' : ''}>${esc(v.name)} • ${esc(v.lang)}${v.localService ? ' • local' : ''}</option>`).join('');
    return `<div class="audio-panel">
      <div><b>🔊 Đọc chuẩn nữ</b><p class="muted">Ưu tiên giọng nữ tiếng Anh như Samantha/Ava/Victoria/Jenny/Aria/Zira nếu máy có. Nếu trình duyệt không có giọng nữ, app tự chọn giọng English rõ nhất.</p></div>
      <div class="form-grid">
        <div class="control"><label>Chọn voice English</label><select id="voiceSelect"><option value="">Tự chọn giọng nữ tốt nhất</option>${voiceOptions}</select></div>
        <div class="control"><label>Tương thích</label><div class="compat-line">${speechSupportLabel()} ${IS_SAFARI || IS_IOS ? '• Safari/iOS: luôn bấm nút để phát âm.' : ''}</div></div>
      </div>
      <div class="two-actions compact-toolbar"><button class="btn small" data-audio-unlock>Khởi động</button><button class="btn small" data-speak="chemistry, molecule, titration, equilibrium" data-rate="0.8">Nghe thử</button><button class="btn small icon-btn" data-speak-stop aria-label="Dừng âm">⏹</button></div>
    </div>`;
  }

  function renderSpeaking(week) {
    const terms = filteredTerms(week).length ? filteredTerms(week) : getWeekTerms(week);
    ensureSpeakingState(week);
    if (ui.speaking.index >= terms.length) ui.speaking.index = 0;
    const term = terms[ui.speaking.index] || getWeekTerms(week)[0];
    if (!term) return '<div class="empty">Tuần này chưa có từ để luyện nói.</div>';
    const target = speakingTarget(term, ui.speaking.mode);
    const supportsSpeech = !!RecognitionCtor;
    const attempts = (userData.speakingHistory || []).filter(x => x.weekId === week.id).slice(-5).reverse();
    return `<div class="speaking-layout">
      <div class="card speaking-card">
        <div class="question-head"><div><h2 style="margin:0">🎙️ Luyện nói tiếng Anh</h2><p class="muted">Bấm nghe mẫu nữ → bấm nói → đọc thật rõ → app nhận transcript, chấm độ giống và chỉ ra từ thiếu/sai.</p></div><span class="chip warn">${supportsSpeech ? 'Micro ready' : 'Fallback nhập tay'}</span></div>
        <div class="mode-row">
          <button class="tab ${ui.speaking.mode === 'term' ? 'active' : ''}" data-speaking-mode="term">Thuật ngữ</button>
          <button class="tab ${ui.speaking.mode === 'example' ? 'active' : ''}" data-speaking-mode="example">Ví dụ</button>
          <button class="tab ${ui.speaking.mode === 'translate' ? 'active' : ''}" data-speaking-mode="translate">Việt→Anh</button>
        </div>
        <div class="speak-target">
          <span class="eyebrow">${esc(ui.speaking.mode === 'translate' ? 'Nhìn nghĩa Việt và nói thuật ngữ tiếng Anh' : 'Target English')}</span>
          <div class="big-term">${esc(ui.speaking.mode === 'translate' ? term.vietnamese : target)}</div>
          <p class="muted">Đáp án chuẩn: <b>${esc(target)}</b></p>
          <p class="term-note">${esc(term.note || '')}</p>
        </div>
        <div class="speak-toolbar compact-toolbar">
          <button class="btn icon-btn" data-speaking-next="-1" data-dir="-1" aria-label="Từ trước">←</button>
          <button class="btn primary" data-speak="${esc(target)}" data-rate="0.76">🔊 Mẫu</button>
          <button class="btn success" data-speaking-start ${supportsSpeech ? '' : 'disabled'}>🎙️ Nói</button>
          <button class="btn icon-btn" data-speaking-next="1" data-dir="1" aria-label="Từ sau">→</button>
          <details class="action-menu inline-menu">
            <summary class="btn">⋯</summary>
            <div class="menu-list"><button class="btn danger" data-speaking-stop>⏹ Dừng</button></div>
          </details>
        </div>
        ${renderSpeechFeedback(target, supportsSpeech)}
      </div>
      <div class="card method-card">
        <h2>Tối ưu nhận giọng nói</h2>
        <div class="speech-tips">
          <div><b>1. Bấm từng lượt ngắn</b><span>Safari nhận tốt hơn khi mỗi lần nói 3–8 giây.</span></div>
          <div><b>2. Để micro gần miệng</b><span>Giảm nhạc, quạt, tiếng nền; nói rõ âm cuối.</span></div>
          <div><b>3. HTTPS/GitHub Pages</b><span>Micro chỉ chạy ổn trên HTTPS hoặc localhost.</span></div>
          <div><b>4. Safari/iPhone</b><span>Dùng Safari thật, không dùng WebView/PWA nếu SpeechRecognition bị tắt.</span></div>
        </div>
        <h3>Lịch sử nói gần đây</h3>
        ${attempts.length ? attempts.map(a => `<div class="attempt-row"><b>${a.score}%</b><span>${esc(a.target)}</span><small>${esc(a.transcript || '')}</small></div>`).join('') : '<div class="empty">Chưa có lượt luyện nói.</div>'}
      </div>
    </div>`;
  }

  function renderSpeechFeedback(target, supportsSpeech) {
    const st = ui.speaking || {};
    const fallback = supportsSpeech ? '' : `<div class="explanation"><b>Trình duyệt này không hỗ trợ nhận giọng nói.</b><br>Vẫn luyện được bằng cách nghe mẫu, tự nói, rồi nhập câu bạn vừa nói để app so độ giống.</div>`;
    return `<div class="speech-box ${st.listening ? 'listening' : ''}">
      <div class="mic-orb">${st.listening ? '●' : '🎙️'}</div>
      <div>
        <b>${esc(st.status || (supportsSpeech ? 'Sẵn sàng nhận micro' : 'Chế độ nhập tay'))}</b>
        <p class="muted">Transcript: ${esc(st.transcript || '(chưa có)')}</p>
      </div>
    </div>
    ${st.feedback ? `<div class="score-hero speech-score"><div class="score-circle" style="--score:${st.feedback.score}%">${st.feedback.score}%</div><div><h3 style="margin:0">${esc(st.feedback.level)}</h3><p class="muted">${esc(st.feedback.message)}</p><div class="explanation"><b>Thiếu/sai:</b> ${esc(st.feedback.missing.join(', ') || 'Không đáng kể')}<br><b>Từ thừa/nghe nhầm:</b> ${esc(st.feedback.extra.join(', ') || 'Không đáng kể')}<br><b>Transcript tốt nhất:</b> ${esc(st.feedback.bestTranscript)}</div></div></div>` : ''}
    ${fallback}
    <div class="manual-speech"><div class="control"><label>Fallback/kiểm tra tay</label><input id="manualSpeechInput" value="${esc(st.transcript || '')}" placeholder="Gõ transcript hoặc câu bạn vừa nói..."></div><button class="btn small compact-fit" data-speaking-manual>Chấm</button></div>`;
  }

  function renderSource(week) {
    return `<div class="grid cols-2">
      <div class="card method-card"><h2>PDF gốc</h2><p class="muted">Các file PDF từ ZIP được giữ nguyên trong project để không mất dữ liệu gốc.</p><div class="source-links compact-toolbar"><a class="btn small" href="${esc(week.pdfs.vocabulary)}" target="_blank" rel="noreferrer">Từ vựng</a><a class="btn small" href="${esc(week.pdfs.practice)}" target="_blank" rel="noreferrer">Bài luyện</a>${week.pdfs.lookup ? `<a class="btn small" href="${esc(week.pdfs.lookup)}" target="_blank" rel="noreferrer">A-Z</a>` : ''}</div></div>
      <div class="card method-card"><h2>Bảng thuật ngữ đã trích</h2><p class="muted">${getWeekTerms(week).length} dòng dùng để sinh flashcard/trắc nghiệm/điền từ.</p><div class="raw-box">${esc(week.terms.map(t => `${t.id}. ${t.english} = ${t.vietnamese}\n${t.note}\n${t.example}`).join('\n\n'))}</div></div>
      <div class="card method-card"><h2>Raw text bài luyện + đáp án</h2><div class="raw-box">${esc(week.practiceText)}</div></div>
      <div class="card method-card"><h2>Raw text PDF từ vựng</h2><div class="raw-box">${esc(week.vocabularyText)}</div></div>
      ${week.extraTexts.map(e => `<div class="card method-card"><h2>${esc(e.name)}</h2><div class="raw-box">${esc(e.text)}</div></div>`).join('')}
    </div>`;
  }

  function renderDataDrawer() {
    return `<div class="overlay ${ui.drawerOpen ? 'open' : ''}" data-action="closeDrawer"></div>
      <aside class="drawer panel ${ui.drawerOpen ? 'open' : ''}">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><h2 style="margin:0">Data & lưu tiến độ</h2><button class="btn small" data-action="closeDrawer">Đóng</button></div>
        <p class="muted">Frontend static trên GitHub Pages không tự ghi đè file trong repo. App tự lưu vào trình duyệt bằng localStorage, và có nút xuất/nhập file <span class="kbd">data.json</span>. Trên Chrome/Edge có thể ghi ra file cục bộ bằng File System Access API.</p>
        <table class="mini-table"><tr><td>Đã lưu lúc</td><td>${esc(userData.savedAt || 'chưa có')}</td></tr><tr><td>Đã thuộc</td><td>${userData.masteredTerms.length}</td></tr><tr><td>Từ khó</td><td>${userData.difficultTerms.length}</td></tr><tr><td>Lịch sử kiểm tra</td><td>${userData.testHistory.length}</td></tr><tr><td>Lượt luyện nói</td><td>${(userData.speakingHistory || []).length}</td></tr><tr><td>Lượt bài nghe</td><td>${(userData.listeningHistory || []).length}</td></tr></table>
        <div class="two-actions">
          <button class="btn success" data-export-data>Xuất</button>
          <button class="btn" data-write-file>Ghi</button>
          <label class="btn">Nhập<input id="importData" type="file" accept="application/json" hidden></label>
          <button class="btn danger" data-reset-data>Xóa</button>
        </div>
        <h3>Gần đây</h3>
        <div class="raw-box">${esc(JSON.stringify({savedAt:userData.savedAt, mastered:userData.masteredTerms.length, difficult:userData.difficultTerms.length, recentTests:userData.testHistory.slice(-5)}, null, 2))}</div>
      </aside>`;
  }

  function bindGlobal() {
    document.querySelectorAll('[data-action="home"]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); route = { screen: 'home', weekId: null, tab: 'learn' }; ui.quiz = null; ui.controlPanelOpen = false; render(); }));
    document.querySelectorAll('[data-action="data"]').forEach(el => el.addEventListener('click', () => { ui.drawerOpen = true; ui.controlPanelOpen = false; render(); }));
    document.querySelectorAll('[data-action="panel"]').forEach(el => el.addEventListener('click', () => { ui.controlPanelOpen = !ui.controlPanelOpen; ui.drawerOpen = false; render(); }));
    document.querySelectorAll('[data-action="closePanel"]').forEach(el => el.addEventListener('click', () => { ui.controlPanelOpen = false; render(); }));
    document.querySelectorAll('[data-action="theme"]').forEach(el => el.addEventListener('click', toggleTheme));
    document.querySelectorAll('[data-action="audioCheck"]').forEach(el => el.addEventListener('click', () => speak('Audio system ready. This is a standard English female voice test.', {rate:0.82, pitch:1.08})));
    document.querySelectorAll('[data-audio-unlock]').forEach(el => el.addEventListener('click', () => unlockSpeech(false)));
    document.querySelectorAll('[data-action="closeDrawer"]').forEach(el => el.addEventListener('click', () => { ui.drawerOpen = false; render(); }));
    document.querySelectorAll('[data-week]').forEach(el => el.addEventListener('click', () => openWeek(Number(el.dataset.week))));
    document.querySelectorAll('[data-open-week]').forEach(el => el.addEventListener('click', () => openWeek(Number(el.dataset.openWeek))));
    const search = document.getElementById('globalSearch');
    if (search) search.addEventListener('input', e => { ui.search = e.target.value; clearTimeout(ui.searchTimer); ui.searchTimer = setTimeout(render, 160); });
    document.querySelectorAll('[data-export-data]').forEach(el => el.addEventListener('click', exportData));
    document.querySelectorAll('[data-write-file]').forEach(el => el.addEventListener('click', writeLocalFile));
    document.querySelectorAll('[data-reset-data]').forEach(el => el.addEventListener('click', () => { if (confirm('Xóa toàn bộ tiến độ, ghi chú, từ tự thêm và lịch sử kiểm tra?')) { userData = defaultUserData(); applyTheme(userData.preferences.theme); persist(); toast('Đã xóa tiến độ'); render(); } }));
    const importInput = document.getElementById('importData');
    if (importInput) importInput.addEventListener('change', importData);
  }

  function bindWeek() {
    const week = getWeek(route.weekId);
    document.querySelectorAll('[data-tab]').forEach(el => el.addEventListener('click', () => { route.tab = el.dataset.tab; ui.quiz = null; ui.review = null; if (el.dataset.tab !== 'speaking') stopSpeechRecognition(false); render(); }));
    document.querySelectorAll('[data-flash]').forEach(el => el.addEventListener('click', () => handleFlash(el.dataset.flash, week)));
    const flash = document.getElementById('flashcard');
    if (flash) setupFlashGestures(flash);
    document.querySelectorAll('[data-select-term]').forEach(el => el.addEventListener('click', () => { ui.flashIndex = Number(el.dataset.selectTerm); ui.flashFlipped = false; render(); }));
    document.querySelectorAll('[data-term-mark]').forEach(el => el.addEventListener('click', e => { e.stopPropagation(); markCurrentTerm(week, el.dataset.termMark); }));
    document.querySelectorAll('[data-action="saveNote"]').forEach(el => el.addEventListener('click', () => saveNote(el.dataset.termKey)));
    document.querySelectorAll('[data-speak]').forEach(el => el.addEventListener('click', e => { e.stopPropagation(); speak(el.dataset.speak, { rate: Number(el.dataset.rate || userData.audioSettings.rate), pitch: Number(el.dataset.pitch || userData.audioSettings.pitch), lang: el.dataset.lang || 'en-US' }); }));
    document.querySelectorAll('[data-speak-stop]').forEach(el => el.addEventListener('click', e => { e.stopPropagation(); stopSpeakingAudio(); }));
    const voiceSelect = document.getElementById('voiceSelect');
    if (voiceSelect) voiceSelect.addEventListener('change', e => { userData.audioSettings.preferredVoice = e.target.value; persist(); toast('Đã đổi giọng đọc'); render(); });
    document.querySelectorAll('[data-speaking-next]').forEach(el => el.addEventListener('click', () => nextSpeakingTerm(week, Number(el.dataset.dir || 1))));
    document.querySelectorAll('[data-speaking-start]').forEach(el => el.addEventListener('click', () => startSpeakingPractice(week)));
    document.querySelectorAll('[data-speaking-stop]').forEach(el => el.addEventListener('click', () => stopSpeechRecognition()));
    document.querySelectorAll('[data-speaking-manual]').forEach(el => el.addEventListener('click', () => submitManualSpeech(week)));
    document.querySelectorAll('[data-speaking-mode]').forEach(el => el.addEventListener('click', () => { ensureSpeakingState(week); ui.speaking.mode = el.dataset.speakingMode; ui.speaking.transcript = ''; ui.speaking.feedback = null; render(); }));
    document.querySelectorAll('[data-review-start]').forEach(el => el.addEventListener('click', () => startReview(week, el.dataset.reviewStart)));
    document.querySelectorAll('[data-review-answer]').forEach(el => el.addEventListener('click', () => submitReviewAnswer(el.dataset.reviewAnswer)));
    document.querySelectorAll('[data-review-fill-submit]').forEach(el => el.addEventListener('click', () => { const v = document.getElementById('reviewFill')?.value || ''; submitReviewAnswer(v); }));
    document.querySelectorAll('[data-review-next]').forEach(el => el.addEventListener('click', () => { ui.review.feedback = null; ui.review.index += 1; render(); }));
    document.querySelectorAll('[data-add-custom-term]').forEach(el => el.addEventListener('click', () => addCustomTerm(Number(el.dataset.addCustomTerm))));
    document.querySelectorAll('[data-start-quiz]').forEach(el => el.addEventListener('click', () => startQuiz(week)));
    document.querySelectorAll('[data-quiz-answer]').forEach(el => el.addEventListener('click', () => { ui.quiz.answers[Number(el.dataset.quizAnswer)] = el.dataset.value; render(); }));
    document.querySelectorAll('[data-fill-answer]').forEach(el => el.addEventListener('input', () => { ui.quiz.answers[Number(el.dataset.fillAnswer)] = el.value; }));
    document.querySelectorAll('[data-submit-quiz]').forEach(el => el.addEventListener('click', submitQuiz));
    document.querySelectorAll('[data-cancel-quiz]').forEach(el => el.addEventListener('click', () => { ui.quiz = null; render(); }));
    document.querySelectorAll('[data-new-quiz]').forEach(el => el.addEventListener('click', () => { ui.quiz = null; render(); }));
  }

  function openWeek(id) {
    ui.controlPanelOpen = false;
    route = { screen: 'week', weekId: id, tab: 'learn' };
    ui.flashIndex = 0;
    ui.flashFlipped = false;
    ui.flashDirection = 'right';
    ui.quiz = null;
    ui.review = null;
    render();
  }

  function randomFlipDirection() {
    return ['left', 'right', 'up', 'down'][Math.floor(Math.random() * 4)];
  }

  function setFlashDirectionClass(flash, direction) {
    flash.classList.remove('flip-left', 'flip-right', 'flip-up', 'flip-down');
    flash.classList.add(`flip-${direction}`);
  }

  function flipFlash(direction = randomFlipDirection()) {
    const flash = document.getElementById('flashcard');
    ui.flashDirection = direction;
    ui.flashFlipped = !ui.flashFlipped;
    if (!flash) return render();

    const wasFlipped = flash.classList.contains('flipped');
    if (wasFlipped && !flash.classList.contains(`flip-${direction}`)) {
      flash.classList.add('no-transition');
      setFlashDirectionClass(flash, direction);
      flash.offsetHeight;
      flash.classList.remove('no-transition');
    } else {
      setFlashDirectionClass(flash, direction);
    }
    requestAnimationFrame(() => flash.classList.toggle('flipped', ui.flashFlipped));
  }

  function setupFlashGestures(flash) {
    const clickSlop = 8;
    const maxLiveAngle = 178;
    const commitAngle = 180;

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    const clearHingeVisual = (animated = true) => {
      flash.classList.toggle('hinge-snap', animated);
      flash.classList.remove(
        'hinge-ready', 'hinge-dragging', 'hinge-commit',
        'hinge-left', 'hinge-right', 'hinge-up', 'hinge-down',
        'hinge-axis-x', 'hinge-axis-y'
      );
      flash.style.setProperty('--hinge-rotate-x', '0deg');
      flash.style.setProperty('--hinge-rotate-y', '0deg');
      flash.style.setProperty('--hinge-progress', '0');
      flash.style.setProperty('--hinge-grab-x', '50%');
      flash.style.setProperty('--hinge-grab-y', '50%');
      window.setTimeout(() => flash.classList.remove('hinge-snap'), animated ? 360 : 0);
    };

    const currentBaseAngles = () => {
      if (!flash.classList.contains('flipped')) return { x: 0, y: 0 };
      if (flash.classList.contains('flip-up')) return { x: 180, y: 0 };
      if (flash.classList.contains('flip-down')) return { x: -180, y: 0 };
      if (flash.classList.contains('flip-left')) return { x: 0, y: 180 };
      return { x: 0, y: -180 };
    };

    const pickAxisFromGrab = (x, y, rect) => {
      const rx = (x - rect.left) / rect.width;
      const ry = (y - rect.top) / rect.height;
      const edgeBand = 0.32;
      const distances = [
        { axis: 'y', side: 'left', value: rx },
        { axis: 'y', side: 'right', value: 1 - rx },
        { axis: 'x', side: 'up', value: ry },
        { axis: 'x', side: 'down', value: 1 - ry }
      ].sort((a, b) => a.value - b.value);
      const nearest = distances[0];
      if (nearest.value <= edgeBand) return nearest;
      return { axis: null, side: 'center', value: nearest.value };
    };

    const pickAxisFromMove = (dx, dy) => {
      if (Math.abs(dx) >= Math.abs(dy)) return { axis: 'y', side: dx < 0 ? 'left' : 'right' };
      return { axis: 'x', side: dy < 0 ? 'up' : 'down' };
    };

    const thresholdForAxis = (axis) => {
      const rect = flash.getBoundingClientRect();
      const base = axis === 'y' ? rect.width : rect.height;
      return Math.max(92, base * 0.5);
    };

    const directionFromAxis = (axis, axisDelta) => {
      if (axis === 'y') return axisDelta < 0 ? 'left' : 'right';
      return axisDelta < 0 ? 'up' : 'down';
    };

    const applyHinge = (dx, dy, forceCommit = false) => {
      const pointer = ui.flashPointer;
      if (!pointer) return { direction: 'right', progress: 0, axis: 'y' };

      let axis = pointer.axis;
      if (!axis) {
        const picked = pickAxisFromMove(dx, dy);
        axis = picked.axis;
        pointer.axis = axis;
        pointer.grabSide = picked.side;
      }

      const axisDelta = axis === 'y' ? dx : dy;
      const threshold = thresholdForAxis(axis);
      const progress = Math.min(1, Math.abs(axisDelta) / threshold);
      const direction = directionFromAxis(axis, axisDelta || (pointer.grabSide === 'left' || pointer.grabSide === 'up' ? -1 : 1));
      const base = pointer.baseAngles || { x: 0, y: 0 };
      const liveAngle = forceCommit
        ? (direction === 'left' || direction === 'up' ? commitAngle : -commitAngle)
        : clamp((axisDelta / threshold) * commitAngle, -maxLiveAngle, maxLiveAngle);

      const rotateX = axis === 'x' ? base.x - liveAngle : base.x;
      const rotateY = axis === 'y' ? base.y - liveAngle : base.y;

      flash.classList.add('hinge-dragging', `hinge-axis-${axis}`);
      flash.classList.remove('hinge-left', 'hinge-right', 'hinge-up', 'hinge-down', axis === 'x' ? 'hinge-axis-y' : 'hinge-axis-x');
      flash.classList.add(`hinge-${direction}`);
      flash.style.setProperty('--hinge-rotate-x', `${rotateX}deg`);
      flash.style.setProperty('--hinge-rotate-y', `${rotateY}deg`);
      flash.style.setProperty('--hinge-progress', progress.toFixed(3));
      return { direction, progress, axis, rotateX, rotateY };
    };

    const start = (x, y, ev = null) => {
      if (ev && ev.button !== undefined && ev.button !== 0) return;
      const rect = flash.getBoundingClientRect();
      const picked = pickAxisFromGrab(x, y, rect);
      ui.flashPointer = {
        x,
        y,
        lastX: x,
        lastY: y,
        rect,
        axis: picked.axis,
        grabSide: picked.side,
        baseAngles: currentBaseAngles(),
        dragging: false,
        pointerId: ev?.pointerId ?? null
      };
      flash.classList.add('hinge-ready');
      flash.style.setProperty('--hinge-grab-x', `${clamp(x - rect.left, 0, rect.width)}px`);
      flash.style.setProperty('--hinge-grab-y', `${clamp(y - rect.top, 0, rect.height)}px`);
      if (ev?.pointerId !== undefined && flash.setPointerCapture) {
        try { flash.setPointerCapture(ev.pointerId); } catch (_) {}
      }
    };

    const move = (x, y, ev = null) => {
      if (!ui.flashPointer) return;
      const dx = x - ui.flashPointer.x;
      const dy = y - ui.flashPointer.y;
      ui.flashPointer.lastX = x;
      ui.flashPointer.lastY = y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) <= clickSlop && !ui.flashPointer.dragging) return;
      ui.flashPointer.dragging = true;
      ev?.preventDefault?.();
      applyHinge(dx, dy);
    };

    const end = (x, y, ev = null) => {
      const pointer = ui.flashPointer;
      if (!pointer) return;
      const dx = x - pointer.x;
      const dy = y - pointer.y;
      const wasDragging = pointer.dragging || Math.max(Math.abs(dx), Math.abs(dy)) > clickSlop;
      ui.flashPointer = null;
      flash.classList.remove('hinge-ready');
      if (ev?.pointerId !== undefined && flash.releasePointerCapture) {
        try { flash.releasePointerCapture(ev.pointerId); } catch (_) {}
      }

      if (!wasDragging) {
        clearHingeVisual(false);
        return;
      }

      ev?.preventDefault?.();
      ui.flashSwipeBlock = true;
      clearTimeout(ui.flashSwipeTimer);
      ui.flashSwipeTimer = setTimeout(() => { ui.flashSwipeBlock = false; }, 460);

      ui.flashPointer = pointer;
      const result = applyHinge(dx, dy);
      ui.flashPointer = null;

      if (result.progress >= 1) {
        flash.classList.remove('hinge-dragging');
        flash.classList.add('hinge-commit');
        ui.flashPointer = pointer;
        applyHinge(dx, dy, true);
        ui.flashPointer = null;
        window.setTimeout(() => {
          clearHingeVisual(false);
          flipFlash(result.direction);
        }, 125);
      } else {
        clearHingeVisual(true);
      }
    };

    const cancel = () => {
      ui.flashPointer = null;
      flash.classList.remove('hinge-ready');
      clearHingeVisual(true);
    };

    flash.addEventListener('click', e => {
      if (ui.flashSwipeBlock) { e.preventDefault(); e.stopPropagation(); return; }
      flipFlash(randomFlipDirection());
    });
    flash.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flipFlash(randomFlipDirection()); }
    });

    if (window.PointerEvent) {
      flash.addEventListener('pointerdown', e => start(e.clientX, e.clientY, e));
      flash.addEventListener('pointermove', e => move(e.clientX, e.clientY, e));
      flash.addEventListener('pointerup', e => end(e.clientX, e.clientY, e));
      flash.addEventListener('pointercancel', cancel);
      flash.addEventListener('lostpointercapture', () => { if (ui.flashPointer?.dragging) cancel(); });
    } else {
      flash.addEventListener('touchstart', e => { const t = e.changedTouches[0]; if (t) start(t.clientX, t.clientY, e); }, { passive: false });
      flash.addEventListener('touchmove', e => { const t = e.changedTouches[0]; if (t) move(t.clientX, t.clientY, e); }, { passive: false });
      flash.addEventListener('touchend', e => { const t = e.changedTouches[0]; if (t) end(t.clientX, t.clientY, e); }, { passive: false });
      flash.addEventListener('touchcancel', cancel, { passive: true });
      flash.addEventListener('mousedown', e => start(e.clientX, e.clientY, e));
      window.addEventListener('mousemove', e => move(e.clientX, e.clientY, e));
      window.addEventListener('mouseup', e => end(e.clientX, e.clientY, e));
    }
  }

  function handleFlash(action, week) {
    const terms = filteredTerms(week);
    if (!terms.length) return;
    if (action === 'flip') return flipFlash(randomFlipDirection());
    if (action === 'next') { ui.flashIndex = (ui.flashIndex + 1) % terms.length; ui.flashFlipped = false; ui.flashDirection = 'right'; }
    if (action === 'prev') { ui.flashIndex = (ui.flashIndex - 1 + terms.length) % terms.length; ui.flashFlipped = false; ui.flashDirection = 'left'; }
    render();
  }

  function currentTerm(week) {
    return filteredTerms(week)[ui.flashIndex] || getWeekTerms(week)[0];
  }

  function toggleInList(listName, key, forceAdd = null) {
    const set = new Set(userData[listName] || []);
    const shouldAdd = forceAdd === null ? !set.has(key) : forceAdd;
    shouldAdd ? set.add(key) : set.delete(key);
    userData[listName] = [...set];
  }

  function markCurrentTerm(week, kind) {
    const t = currentTerm(week);
    if (!t) return;
    const key = termKey(week.id, t);
    if (kind === 'mastered') toggleInList('masteredTerms', key);
    if (kind === 'difficult') toggleInList('difficultTerms', key);
    persist();
    toast(kind === 'mastered' ? 'Đã cập nhật trạng thái thuộc' : 'Đã cập nhật nhóm khó nhớ');
    render();
  }

  function saveNote(key) {
    const v = document.getElementById('noteInput')?.value || '';
    userData.notes[key] = v;
    persist();
    toast('Đã lưu ghi chú vào data cá nhân');
  }

  function initSpeechSystem() {
    if (!('speechSynthesis' in window)) return;
    const refresh = () => {
      speechEngine.voices = speechSynthesis.getVoices() || [];
      speechEngine.ready = speechEngine.voices.length > 0;
    };
    refresh();
    if (typeof speechSynthesis.onvoiceschanged !== 'undefined') speechSynthesis.onvoiceschanged = refresh;
    setTimeout(refresh, 250);
    setTimeout(refresh, 900);
  }

  function speechSupportLabel() {
    const tts = 'speechSynthesis' in window ? 'Có đọc âm' : 'Không đọc âm';
    const voices = speechEngine.voices?.length ? `${speechEngine.voices.length} voice` : 'đang tải voice';
    return `${tts} • ${voices}${IS_SAFARI || IS_IOS ? ' • Safari/iOS safe mode' : ''}`;
  }

  function unlockSpeech(silent = false) {
    initSpeechSystem();
    speechEngine.unlocked = true;
    if ('speechSynthesis' in window) {
      try { speechSynthesis.resume(); } catch (err) {}
    }
    if (!silent) toast('Đã khởi động hệ thống âm thanh');
  }

  function selectVoice(lang = 'en-US') {
    const voices = speechEngine.voices.length ? speechEngine.voices : (window.speechSynthesis ? speechSynthesis.getVoices() : []);
    if (!voices.length) return null;
    const preferred = userData.audioSettings?.preferredVoice;
    if (preferred) {
      const exact = voices.find(v => v.voiceURI === preferred);
      if (exact) return exact;
    }
    const english = voices.filter(v => /^en([-_]|$)/i.test(v.lang || ''));
    const pool = english.length ? english : voices;
    const femaleHints = ['samantha','ava','victoria','allison','susan','karen','moira','tessa','veena','zira','jenny','aria','sonia','female','google us english'];
    return pool.find(v => femaleHints.some(h => (v.name || '').toLowerCase().includes(h))) ||
      pool.find(v => /en-US/i.test(v.lang || '')) || pool[0];
  }

  function splitSpeechText(text, maxLen = 150) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return [];
    const parts = clean.match(/[^.!?;:]+[.!?;:]?|[^.!?;:]+$/g) || [clean];
    const chunks = [];
    for (const part of parts) {
      let p = part.trim();
      while (p.length > maxLen) {
        const cut = Math.max(p.lastIndexOf(' ', maxLen), 60);
        chunks.push(p.slice(0, cut).trim());
        p = p.slice(cut).trim();
      }
      if (p) chunks.push(p);
    }
    return chunks.slice(0, 12);
  }

  function stopSpeakingAudio() {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    toast('Đã dừng âm thanh');
  }

  function speak(text, opts = {}) {
    if (!('speechSynthesis' in window) || !window.SpeechSynthesisUtterance) return toast('Trình duyệt không hỗ trợ đọc âm. Hãy dùng Chrome/Edge/Safari mới.');
    const chunks = splitSpeechText(text, IS_SAFARI || IS_IOS ? 115 : 160);
    if (!chunks.length) return toast('Không có nội dung để đọc.');
    unlockSpeech(true);
    const voice = selectVoice(opts.lang || userData.audioSettings.lang || 'en-US');
    speechSynthesis.cancel();
    chunks.forEach((chunk, idx) => {
      const u = new SpeechSynthesisUtterance(chunk);
      u.lang = opts.lang || userData.audioSettings.lang || 'en-US';
      u.rate = Number(opts.rate || userData.audioSettings.rate || 0.86);
      u.pitch = Number(opts.pitch || userData.audioSettings.pitch || 1.06);
      u.volume = Number(opts.volume || userData.audioSettings.volume || 1);
      if (voice) u.voice = voice;
      u.onerror = () => idx === 0 && toast('Trình duyệt chặn hoặc lỗi phát âm. Bấm lại nút nghe sau khi đã tương tác trang.');
      speechSynthesis.speak(u);
    });
  }

  function makeQuestion(term, direction, kind, pool) {
    let finalKind = kind;
    if (kind === 'full') finalKind = sample(['mcq', 'fill', 'listen'], 1)[0];
    if (kind === 'mixed') finalKind = Math.random() > 0.55 ? 'mcq' : 'fill';

    if (finalKind === 'listen') {
      const answer = term.vietnamese;
      const opts = sample(pool.filter(t => t.vietnamese && t.vietnamese !== answer), 3).map(t => t.vietnamese);
      while (opts.length < 3) opts.push('Không có đáp án');
      return {
        termKey: `${term.weekId || route.weekId}:${term.id || term.customId || term.english}`,
        term,
        kind: 'listen',
        direction: 'listen-en-vi',
        directionLabel: 'Nghe English → chọn nghĩa',
        prompt: 'Nghe audio và chọn nghĩa tiếng Việt đúng',
        audioText: term.english,
        answer,
        options: shuffle([answer, ...opts]).slice(0, 4),
        explanation: `Bạn nghe cụm tiếng Anh “${term.english}”. Nghĩa đúng là “${term.vietnamese}”. ${term.note || 'Nghe nhiều lần rồi tự đọc lại để tăng phản xạ.'}`,
        example: term.example || ''
      };
    }

    const dir = direction === 'mixed' ? (Math.random() > 0.5 ? 'en-vi' : 'vi-en') : direction;
    const prompt = dir === 'en-vi' ? term.english : term.vietnamese;
    const answer = dir === 'en-vi' ? term.vietnamese : term.english;
    const distractorField = dir === 'en-vi' ? 'vietnamese' : 'english';
    const opts = sample(pool.filter(t => t[distractorField] && t[distractorField] !== answer), 3).map(t => t[distractorField]);
    while (opts.length < 3) opts.push('Không có đáp án');
    const options = shuffle([answer, ...opts]).slice(0, 4);
    return {
      termKey: `${term.weekId || route.weekId}:${term.id || term.customId || term.english}`,
      term,
      kind: finalKind,
      direction: dir,
      directionLabel: dir === 'en-vi' ? 'Anh → Việt' : 'Việt → Anh',
      prompt,
      answer,
      options,
      explanation: `${term.english} = ${term.vietnamese}. ${term.note || 'Hãy học kèm ngữ cảnh và tự đặt câu để nhớ lâu hơn.'}`,
      example: term.example || ''
    };
  }

  function poolForQuiz(week, scope) {
    if (scope === 'all') return DATA.weeks.flatMap(w => getWeekTerms(w).map(t => ({ ...t, weekId: w.id, weekTitle: w.title })));
    if (scope === 'difficult') {
      const all = DATA.weeks.flatMap(w => getWeekTerms(w).map(t => ({ ...t, weekId: w.id, weekTitle: w.title })));
      return all.filter(t => userData.difficultTerms.includes(termKey(t.weekId, t)));
    }
    return getWeekTerms(week).map(t => ({ ...t, weekId: week.id, weekTitle: week.title }));
  }

  function startQuiz(week) {
    const kind = document.getElementById('quizKind').value;
    const direction = document.getElementById('quizDirection').value;
    const count = Math.max(5, Math.min(100, Number(document.getElementById('quizCount').value || 20)));
    const scope = document.getElementById('quizScope').value;
    let pool = poolForQuiz(week, scope);
    if (pool.length < 4) return toast('Không đủ từ để tạo bài kiểm tra.');
    const selected = sample(pool, Math.min(count, pool.length));
    ui.quiz = { weekId: week.id, kind, direction, scope, questions: selected.map(t => makeQuestion(t, direction, kind, pool)), answers: {}, submitted: false, results: [] };
    render();
  }

  function normalizeAnswer(v) {
    return strip(v).replace(/[;；]/g, ';').replace(/\s*;\s*/g, ';');
  }

  function isCorrect(user, answer) {
    const u = normalizeAnswer(user);
    const a = normalizeAnswer(answer);
    if (!u) return false;
    if (u === a) return true;
    // accept when the user types one part of a semicolon-separated answer exactly enough
    return a.split(';').some(part => u === part.trim()) || u.split(';').some(part => part.trim() === a);
  }

  function submitQuiz() {
    const quiz = ui.quiz;
    quiz.results = quiz.questions.map((q, i) => {
      const ans = quiz.answers[i] || '';
      const ok = isCorrect(ans, q.answer);
      if (!ok) toggleInList('difficultTerms', q.termKey, true);
      else toggleInList('masteredTerms', q.termKey, true);
      return { ok, userAnswer: ans, correctAnswer: q.answer };
    });
    quiz.submitted = true;
    const correct = quiz.results.filter(r => r.ok).length;
    userData.testHistory.push({ date: new Date().toISOString(), weekId: quiz.weekId, scope: quiz.scope, kind: quiz.kind, direction: quiz.direction, total: quiz.questions.length, correct, percent: Math.round(correct / quiz.questions.length * 100) });
    if (quiz.questions.some(q => q.kind === 'listen')) userData.listeningHistory.push({ date: new Date().toISOString(), weekId: quiz.weekId, total: quiz.questions.filter(q => q.kind === 'listen').length, correct: quiz.questions.filter((q, i) => q.kind === 'listen' && quiz.results[i].ok).length });
    persist();
    toast('Đã chấm bài và lưu kết quả');
    render();
  }

  function startReview(week, mode) {
    const pool = getWeekTerms(week).map(t => ({ ...t, weekId: week.id, weekTitle: week.title }));
    const questions = sample(pool, Math.min(20, pool.length)).map(t => makeQuestion(t, mode, Math.random() > .5 ? 'mcq' : 'fill', pool));
    ui.review = { mode, index: 0, questions, feedback: null };
    render();
  }

  function submitReviewAnswer(answer) {
    const q = ui.review.questions[ui.review.index];
    const ok = isCorrect(answer, q.answer);
    ui.review.feedback = { ok, answer };
    if (!ok) toggleInList('difficultTerms', q.termKey, true); else toggleInList('masteredTerms', q.termKey, true);
    persist();
    render();
  }

  function addCustomTerm(weekId) {
    const english = document.getElementById('customEnglish')?.value.trim();
    const vietnamese = document.getElementById('customVietnamese')?.value.trim();
    const note = document.getElementById('customNote')?.value.trim();
    const example = document.getElementById('customExample')?.value.trim();
    if (!english || !vietnamese) return toast('Cần nhập English term và nghĩa tiếng Việt.');
    const key = String(weekId);
    userData.customTerms[key] = userData.customTerms[key] || [];
    userData.customTerms[key].push({ customId: `custom-${Date.now()}`, english, vietnamese, note, example, createdAt: new Date().toISOString() });
    persist();
    toast('Đã thêm từ vào data cá nhân');
    render();
  }


  function ensureSpeakingState(week) {
    if (!ui.speaking || ui.speaking.weekId !== week.id) {
      ui.speaking = { weekId: week.id, index: 0, mode: 'term', transcript: '', status: '', listening: false, feedback: null, alternatives: [] };
    }
  }

  function speakingTarget(term, mode) {
    if (!term) return '';
    if (mode === 'example') return term.example || `The term is ${term.english}.`;
    return term.english;
  }

  function nextSpeakingTerm(week, dir = 1) {
    const terms = filteredTerms(week).length ? filteredTerms(week) : getWeekTerms(week);
    ensureSpeakingState(week);
    if (!terms.length) return toast('Tuần này chưa có từ để luyện nói.');
    ui.speaking.index = (ui.speaking.index + dir + terms.length) % terms.length;
    ui.speaking.transcript = '';
    ui.speaking.feedback = null;
    ui.speaking.status = '';
    render();
  }

  function startSpeakingPractice(week) {
    ensureSpeakingState(week);
    if (!RecognitionCtor) return toast('Trình duyệt này không hỗ trợ nhận giọng nói. Dùng Chrome/Edge/Safari mới hoặc nhập tay.');
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return toast('Micro cần HTTPS hoặc localhost. Up GitHub Pages là được.');
    stopSpeechRecognition(false);
    const speakingTerms = filteredTerms(week).length ? filteredTerms(week) : getWeekTerms(week);
    const term = speakingTerms[ui.speaking.index] || speakingTerms[0];
    const target = speakingTarget(term, ui.speaking.mode);
    try {
      const rec = new RecognitionCtor();
      recognitionInstance = rec;
      rec.lang = 'en-US';
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 5;
      ui.speaking.status = 'Đang nghe... nói rõ, chậm, đủ âm cuối.';
      ui.speaking.listening = true;
      ui.speaking.transcript = '';
      ui.speaking.feedback = null;
      rec.onresult = ev => {
        let interim = '';
        let finalText = '';
        let alternatives = [];
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const result = ev.results[i];
          const texts = Array.from(result).map(a => ({ transcript: a.transcript.trim(), confidence: a.confidence || 0 }));
          alternatives = alternatives.concat(texts);
          if (result.isFinal) finalText += result[0].transcript + ' '; else interim += result[0].transcript + ' ';
        }
        ui.speaking.transcript = (finalText || interim).trim();
        ui.speaking.alternatives = alternatives;
        if (finalText.trim()) finishSpeechAttempt(week, target, alternatives, finalText.trim());
        else render();
      };
      rec.onerror = ev => {
        ui.speaking.listening = false;
        ui.speaking.status = speechErrorMessage(ev.error);
        render();
      };
      rec.onend = () => {
        if (ui.speaking) {
          ui.speaking.listening = false;
          if (!ui.speaking.transcript) ui.speaking.status = 'Không nghe thấy tiếng. Kiểm tra quyền micro rồi bấm nói lại.';
          render();
        }
      };
      rec.start();
      render();
    } catch (err) {
      ui.speaking.listening = false;
      ui.speaking.status = 'Không khởi động được micro: ' + err.message;
      render();
    }
  }

  function stopSpeechRecognition(showToast = true) {
    if (recognitionInstance) {
      try { recognitionInstance.stop(); } catch (err) { try { recognitionInstance.abort(); } catch (e) {} }
      recognitionInstance = null;
    }
    if (ui.speaking) ui.speaking.listening = false;
    if (showToast) { toast('Đã dừng nhận giọng nói'); render(); }
  }

  function speechErrorMessage(code) {
    const map = {
      'not-allowed': 'Trình duyệt chặn micro. Hãy cho phép quyền Microphone rồi thử lại.',
      'service-not-allowed': 'Dịch vụ nhận giọng nói bị chặn. Trên Safari cần bật Siri/Dictation và dùng Safari thật.',
      'no-speech': 'Không nghe thấy tiếng. Nói gần micro hơn và thử lại.',
      'audio-capture': 'Không tìm thấy micro hoặc micro đang bị ứng dụng khác dùng.',
      'network': 'Lỗi mạng khi nhận giọng nói. Kiểm tra internet rồi thử lại.',
      'aborted': 'Lượt nhận giọng nói đã bị dừng.'
    };
    return map[code] || `Lỗi nhận giọng nói: ${code || 'không rõ'}`;
  }

  function submitManualSpeech(week) {
    ensureSpeakingState(week);
    const speakingTerms = filteredTerms(week).length ? filteredTerms(week) : getWeekTerms(week);
    const term = speakingTerms[ui.speaking.index] || speakingTerms[0];
    const target = speakingTarget(term, ui.speaking.mode);
    const typed = document.getElementById('manualSpeechInput')?.value || '';
    finishSpeechAttempt(week, target, [{ transcript: typed, confidence: 1 }], typed);
  }

  function finishSpeechAttempt(week, target, alternatives, transcript) {
    ensureSpeakingState(week);
    const candidates = alternatives && alternatives.length ? alternatives : [{ transcript, confidence: 0 }];
    const scored = candidates.map(c => ({ ...c, analysis: analyzePronunciation(target, c.transcript) })).sort((a, b) => b.analysis.score - a.analysis.score);
    const best = scored[0] || { transcript, analysis: analyzePronunciation(target, transcript) };
    ui.speaking.transcript = best.transcript || transcript;
    ui.speaking.feedback = { ...best.analysis, bestTranscript: best.transcript || transcript };
    ui.speaking.status = 'Đã nhận xong. Xem điểm và sửa phần thiếu/sai.';
    ui.speaking.listening = false;
    userData.speakingHistory = userData.speakingHistory || [];
    userData.speakingHistory.push({ date: new Date().toISOString(), weekId: week.id, target, transcript: ui.speaking.transcript, score: ui.speaking.feedback.score, mode: ui.speaking.mode });
    if (ui.speaking.feedback.score >= 78) {
      const speakingTerms = filteredTerms(week).length ? filteredTerms(week) : getWeekTerms(week);
      const term = speakingTerms[ui.speaking.index] || speakingTerms[0];
      if (term) toggleInList('masteredTerms', termKey(week.id, term), true);
    }
    persist();
    render();
  }

  function normalizeSpeechText(s = '') {
    return String(s).toLowerCase()
      .replace(/β/g, ' beta ').replace(/α/g, ' alpha ').replace(/γ/g, ' gamma ')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\bzero\b/g, '0').replace(/\bone\b/g, '1').replace(/\btwo\b/g, '2').replace(/\bthree\b/g, '3')
      .replace(/\s+/g, ' ').trim();
  }

  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
    for (let j = 1; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) dp[i][j] = Math.min(dp[i-1][j] + 1, dp[i][j-1] + 1, dp[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
    return dp[m][n];
  }

  function similarity(a, b) {
    a = normalizeSpeechText(a); b = normalizeSpeechText(b);
    if (!a && !b) return 1; if (!a || !b) return 0;
    return Math.max(0, 1 - levenshtein(a, b) / Math.max(a.length, b.length));
  }

  function analyzePronunciation(target, heard) {
    const targetNorm = normalizeSpeechText(target);
    const heardNorm = normalizeSpeechText(heard);
    const targetWords = targetNorm.split(' ').filter(Boolean);
    const heardWords = heardNorm.split(' ').filter(Boolean);
    const used = new Set();
    const missing = [];
    let wordScore = 0;
    targetWords.forEach(tw => {
      let best = { idx: -1, sim: 0 };
      heardWords.forEach((hw, idx) => {
        if (used.has(idx)) return;
        const sim = similarity(tw, hw);
        if (sim > best.sim) best = { idx, sim };
      });
      if (best.sim >= 0.72) { used.add(best.idx); wordScore += best.sim; } else missing.push(tw);
    });
    const extra = heardWords.filter((_, idx) => !used.has(idx));
    const phraseScore = similarity(targetNorm, heardNorm);
    const tokenScore = targetWords.length ? wordScore / targetWords.length : 0;
    const score = Math.round(Math.max(phraseScore * 100, tokenScore * 100));
    let level = 'Cần nói lại';
    let message = 'Nói chậm hơn, rõ từng âm tiết và âm cuối.';
    if (score >= 90) { level = 'Rất tốt'; message = 'Phát âm gần đúng mục tiêu. Có thể tăng tốc độ nói.'; }
    else if (score >= 78) { level = 'Đạt'; message = 'Đã nhận đúng phần lớn. Sửa các từ thiếu/sai bên dưới.'; }
    else if (score >= 55) { level = 'Tạm được'; message = 'Có vài từ đúng nhưng hệ thống nghe chưa rõ. Nghe mẫu rồi đọc lại.'; }
    return { score, level, message, missing, extra };
  }

  function snapshot() {
    return { exportedAt: new Date().toISOString(), app: DATA.meta.title, source: DATA.meta.source, compatibility: { speechSynthesis: 'speechSynthesis' in window, speechRecognition: !!RecognitionCtor, safariMode: IS_SAFARI || IS_IOS }, userData };
  }

  function exportData() {
    persist();
    const blob = new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chemistry-learning-data-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('Đã xuất file data.json');
  }

  async function writeLocalFile() {
    if (!window.showSaveFilePicker) {
      exportData();
      return toast('Trình duyệt không hỗ trợ ghi file trực tiếp, đã chuyển sang tải xuống.');
    }
    try {
      persist();
      const handle = await window.showSaveFilePicker({ suggestedName: 'data.json', types: [{ description: 'JSON data', accept: { 'application/json': ['.json'] } }] });
      const writable = await handle.createWritable();
      await writable.write(JSON.stringify(snapshot(), null, 2));
      await writable.close();
      toast('Đã ghi data vào file cục bộ');
    } catch (err) {
      if (err.name !== 'AbortError') toast('Không ghi được file: ' + err.message);
    }
  }

  function importData(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        userData = normalizeUserData(parsed.userData || parsed);
        applyTheme(userData.preferences?.theme || 'light');
        persist();
        toast('Đã nhập data và khôi phục tiến độ');
        render();
      } catch (err) { toast('File data.json không hợp lệ'); }
    };
    reader.readAsText(file, 'utf-8');
  }

  render();
})();
