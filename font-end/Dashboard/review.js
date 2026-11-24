(() => {
  "use strict";

  const SRS_KEY = "lexitag-srs-v1";
  const SAVED_DICT_KEY = "lexitag-dict-saved-v1";
  const HISTORY_KEY = "lexitag-review-history-v1";
  const DAY_MS = 24 * 60 * 60 * 1000;

  const SEED_WORDS = [
    "peaceful", "environment", "achieve", "opportunity",
    "comfortable", "discover", "improve", "knowledge",
    "necessary", "recognize", "schedule", "valuable"
  ];

  const MODE_LABELS = {
    srs: "Ôn thẻ SRS (SM-2)",
    quiz: "Trắc nghiệm 4 đáp án",
    typing: "Gõ từ (Typing)",
    dictation: "Nghe chép chính tả"
  };

  const rawDict = Array.isArray(window.OXFORD_DICTIONARY) ? window.OXFORD_DICTIONARY : [];
  const DICT = rawDict.filter((d) => d && d.w && d.vi);
  const BY_ID = new Map(DICT.map((d) => [d.id, d]));

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeRegex(str) {
    return String(str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function cleanAnswerTarget(word) {
    return String(word || "").replace(/\s*\(.*\)$/, "").trim();
  }

  // Fisher-Yates Shuffle
  function shuffle(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // Levenshtein distance
  function levenshtein(a, b) {
    if (a === b) return 0;
    const al = a.length;
    const bl = b.length;
    if (!al) return bl;
    if (!bl) return al;
    let prev = Array.from({ length: bl + 1 }, (_, j) => j);
    let curr = new Array(bl + 1);
    for (let i = 1; i <= al; i++) {
      curr[0] = i;
      for (let j = 1; j <= bl; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      }
      [prev, curr] = [curr, prev];
    }
    return prev[bl];
  }

  // Check if two strings differ by a single adjacent transposition (e.g. paeceful vs peaceful)
  function isAdjacentTransposition(a, b) {
    if (a.length !== b.length || a.length < 2) return false;
    const diffs = [];
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) diffs.push(i);
    }
    if (diffs.length !== 2) return false;
    const [i, j] = diffs;
    return j === i + 1 && a[i] === b[j] && a[j] === b[i];
  }

  // Soundex + phonetic key for Dictation feedback (e.g., fone ~ phone, nite ~ night)
  function soundex(raw) {
    let s = String(raw || "").toLowerCase().replace(/[^a-z]/g, "");
    if (!s) return "";
    // Normalize common English phonetic equivalents before Soundex
    s = s
      .replace(/^kn/, "n")
      .replace(/^wr/, "r")
      .replace(/^ps/, "s")
      .replace(/ph/g, "f")
      .replace(/ght/g, "t")
      .replace(/gh$/g, "f")
      .replace(/ck/g, "k")
      .replace(/tion/g, "shn")
      .replace(/ce/g, "se")
      .replace(/ci/g, "si")
      .replace(/c/g, "k");

    const map = {
      b: "1", f: "1", p: "1", v: "1",
      c: "2", g: "2", j: "2", k: "2", q: "2", s: "2", x: "2", z: "2",
      d: "3", t: "3",
      l: "4",
      m: "5", n: "5",
      r: "6"
    };
    const first = s[0].toUpperCase();
    let res = first;
    let prev = map[s[0]] || "";
    for (let i = 1; i < s.length && res.length < 4; i++) {
      const code = map[s[i]] || "";
      if (code && code !== prev) res += code;
      prev = code;
    }
    return res.padEnd(4, "0");
  }

  function isPhoneticallySimilar(input, target) {
    const a = input.toLowerCase().replace(/[^a-z]/g, "");
    const b = target.toLowerCase().replace(/[^a-z]/g, "");
    if (!a || !b || a === b) return false;
    return soundex(a) === soundex(b);
  }

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore quota error
    }
  }

  function initSrsStore() {
    const existing = loadJson(SRS_KEY, null);
    if (existing && typeof existing === "object" && Object.keys(existing).length > 0) {
      return existing;
    }
    const store = {};
    const now = Date.now();
    const seedBoxes = [1, 1, 1, 2, 2, 2, 3, 3, 4, 4, 2, 3];
    SEED_WORDS.forEach((word, idx) => {
      const found = DICT.find((d) => d.w.toLowerCase() === word);
      if (found) {
        const box = seedBoxes[idx % seedBoxes.length];
        store[found.id] = {
          id: found.id,
          box,
          ef: 2.5,
          reps: Math.max(0, box - 1),
          intervalDays: box === 1 ? 0 : box === 2 ? 1 : box === 3 ? 4 : 9,
          dueAt: now - 60000,
          lastReviewedAt: now - DAY_MS
        };
      }
    });
    // Fallback if dictionary wasn't loaded
    if (Object.keys(store).length === 0) {
      DICT.slice(0, 12).forEach((d, idx) => {
        store[d.id] = {
          id: d.id,
          box: (idx % 3) + 1,
          ef: 2.5,
          reps: idx % 3,
          intervalDays: idx % 3,
          dueAt: now - 60000,
          lastReviewedAt: now - DAY_MS
        };
      });
    }
    saveJson(SRS_KEY, store);
    return store;
  }

  let srsStore = initSrsStore();
  let reviewHistory = loadJson(HISTORY_KEY, []);
  if (!Array.isArray(reviewHistory)) reviewHistory = [];

  const state = {
    mode: "srs", // srs | quiz | typing | dictation
    source: "due", // due | saved | A1 | A2 | B1 | B2 | ALL
    size: 10,
    accent: "en-US",
    boxFilter: 0, // 0 = all boxes, 1..5 = specific Leitner box
    queue: [],
    index: 0,
    flipped: false,
    answered: false,
    correctCount: 0,
    totalAnswered: 0,
    missedMap: new Map(),
    hintCount: 0,
    showDictationMeaning: false,
    retryUsed: false,
    quizOptions: [],
    quizSelectedIdx: -1,
    feedback: null, // { type: 'ok'|'warn'|'info'|'err', title, detail }
    finished: false,
    startedAt: 0,
    elapsedSec: 0,
    timerId: 0
  };

  let toastTimer = 0;

  function showToast(msg) {
    const el = document.getElementById("profileToast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
  }

  function speakText(text, rate = 1.0) {
    if (!text || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = state.accent;
      utter.rate = rate;
      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find((v) => v.lang === state.accent) ||
        voices.find((v) => v.lang && v.lang.startsWith("en"));
      if (preferred) utter.voice = preferred;
      window.speechSynthesis.speak(utter);
    } catch {
      // ignore TTS errors
    }
  }

  function getSrsRecord(id) {
    return (
      srsStore[id] || {
        id,
        box: 1,
        ef: 2.5,
        reps: 0,
        intervalDays: 0,
        dueAt: Date.now(),
        lastReviewedAt: 0
      }
    );
  }

  // Compute SM-2 transition without mutating
  function computeSm2Next(rec, rating) {
    let { box, ef, reps, intervalDays } = rec;
    if (rating === "again") {
      return {
        box: 1,
        ef: Math.max(1.3, +(ef - 0.2).toFixed(2)),
        reps: 0,
        intervalDays: 0,
        label: "10 phút",
        dueAt: Date.now() + 10 * 60 * 1000
      };
    }
    if (rating === "hard") {
      const nextInt = Math.max(1, Math.round((intervalDays || 1) * 1.2));
      return {
        box: Math.max(1, box),
        ef: Math.max(1.3, +(ef - 0.15).toFixed(2)),
        reps: Math.max(1, reps),
        intervalDays: nextInt,
        label: `${nextInt} ngày`,
        dueAt: Date.now() + nextInt * DAY_MS
      };
    }
    if (rating === "good") {
      const nextReps = reps + 1;
      const nextInt =
        nextReps === 1 ? 1 : nextReps === 2 ? 6 : Math.max(1, Math.round(intervalDays * ef));
      return {
        box: Math.min(5, box + 1),
        ef,
        reps: nextReps,
        intervalDays: nextInt,
        label: `${nextInt} ngày`,
        dueAt: Date.now() + nextInt * DAY_MS
      };
    }
    // easy
    const nextReps = reps + 1;
    const nextInt =
      nextReps === 1 ? 4 : Math.max(2, Math.round((intervalDays || 3) * ef * 1.3));
    return {
      box: Math.min(5, box + 2),
      ef: +(ef + 0.15).toFixed(2),
      reps: nextReps,
      intervalDays: nextInt,
      label: `${nextInt} ngày`,
      dueAt: Date.now() + nextInt * DAY_MS
    };
  }

  function applySrsUpdate(id, rating) {
    const rec = getSrsRecord(id);
    const next = computeSm2Next(rec, rating);
    srsStore[id] = {
      id,
      box: next.box,
      ef: next.ef,
      reps: next.reps,
      intervalDays: next.intervalDays,
      dueAt: next.dueAt,
      lastReviewedAt: Date.now()
    };
    saveJson(SRS_KEY, srsStore);
    renderLeitnerAndHeaderStats();
    return next;
  }

  function getSavedWordItems() {
    const ids = loadJson(SAVED_DICT_KEY, []);
    if (!Array.isArray(ids)) return [];
    return ids.map((id) => BY_ID.get(id)).filter(Boolean);
  }

  function getDueWordItems() {
    const now = Date.now();
    const due = Object.values(srsStore)
      .filter((r) => r.dueAt <= now)
      .sort((a, b) => a.box - b.box || a.dueAt - b.dueAt)
      .map((r) => BY_ID.get(r.id))
      .filter(Boolean);
    return due;
  }

  function getBoxWordItems(boxNum) {
    return Object.values(srsStore)
      .filter((r) => r.box === boxNum)
      .map((r) => BY_ID.get(r.id))
      .filter(Boolean);
  }

  function buildWordPool() {
    if (state.boxFilter > 0 && state.mode === "srs") {
      return shuffle(getBoxWordItems(state.boxFilter));
    }
    if (state.source === "due") {
      const due = getDueWordItems();
      if (due.length > 0) return due.slice(0, state.size);
      // If all due cards completed, offer tracked words or Oxford fallback
      const tracked = Object.values(srsStore)
        .sort((a, b) => a.box - b.box || a.dueAt - b.dueAt)
        .map((r) => BY_ID.get(r.id))
        .filter(Boolean);
      return tracked.slice(0, state.size);
    }
    if (state.source === "saved") {
      return shuffle(getSavedWordItems()).slice(0, state.size);
    }
    if (["A1", "A2", "B1", "B2"].includes(state.source)) {
      const filtered = DICT.filter((d) => d.lv === state.source);
      return shuffle(filtered).slice(0, state.size);
    }
    return shuffle(DICT).slice(0, state.size);
  }

  function buildQuizOptions(item) {
    const targetMeaning = item.vi.trim().toLowerCase();
    const sameLevelPos = DICT.filter(
      (d) => d.id !== item.id && d.lv === item.lv && d.pos === item.pos && d.vi.trim().toLowerCase() !== targetMeaning
    );
    const sameLevel = DICT.filter(
      (d) => d.id !== item.id && d.lv === item.lv && d.vi.trim().toLowerCase() !== targetMeaning
    );
    const fallback = DICT.filter((d) => d.id !== item.id && d.vi.trim().toLowerCase() !== targetMeaning);

    const distractors = [];
    const seenVi = new Set([targetMeaning]);
    for (const pool of [sameLevelPos, sameLevel, fallback]) {
      const mixed = shuffle(pool);
      for (let i = 0; i < mixed.length && distractors.length < 3; i++) {
        const viKey = mixed[i].vi.trim().toLowerCase();
        if (!seenVi.has(viKey)) {
          seenVi.add(viKey);
          distractors.push(mixed[i]);
        }
      }
      if (distractors.length >= 3) break;
    }

    return shuffle([
      { text: item.vi, isCorrect: true },
      ...distractors.map((d) => ({ text: d.vi, isCorrect: false }))
    ]);
  }

  function maskWordInExample(example, word) {
    const clean = cleanAnswerTarget(word);
    const safeEx = escapeHtml(example);
    if (!clean) return safeEx;
    const blank = `<span class="rv-cloze-blank">${"_".repeat(Math.max(4, Math.min(12, clean.length)))}</span>`;
    const re = new RegExp(`\\b${escapeRegex(clean)}[a-z']*\\b`, "gi");
    if (re.test(safeEx)) {
      return safeEx.replace(re, blank);
    }
    return safeEx;
  }

  function highlightWordInExample(example, word) {
    const clean = cleanAnswerTarget(word);
    const safeEx = escapeHtml(example);
    if (!clean) return safeEx;
    const re = new RegExp(`\\b(${escapeRegex(clean)}[a-z']*)\\b`, "gi");
    return safeEx.replace(re, "<mark>$1</mark>");
  }

  function formatDuration(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function stopTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = 0;
    }
  }

  function startTimer() {
    stopTimer();
    state.startedAt = Date.now();
    state.elapsedSec = 0;
    state.timerId = setInterval(() => {
      const view = document.getElementById("viewReview");
      if (!view || !view.classList.contains("active") || state.finished) return;
      state.elapsedSec++;
      const el = document.getElementById("rvTimerVal");
      if (el) el.textContent = formatDuration(state.elapsedSec);
    }, 1000);
  }

  function prepareCurrentQuestion() {
    state.flipped = false;
    state.answered = false;
    state.feedback = null;
    state.hintCount = 0;
    state.showDictationMeaning = false;
    state.retryUsed = false;
    state.quizSelectedIdx = -1;

    const item = state.queue[state.index];
    if (!item) return;

    if (state.mode === "quiz") {
      state.quizOptions = buildQuizOptions(item);
    } else if (state.mode === "dictation") {
      const view = document.getElementById("viewReview");
      if (view && view.classList.contains("active")) {
        setTimeout(() => speakText(cleanAnswerTarget(item.w), 1.0), 180);
      }
    }
  }

  function startSession(customQueue = null) {
    state.queue = Array.isArray(customQueue) ? customQueue.slice() : buildWordPool();
    state.index = 0;
    state.correctCount = 0;
    state.totalAnswered = 0;
    state.sessionXp = 0;
    state.awardedIds = new Set();
    state.missedMap = new Map();
    state.finished = false;
    if (state.queue.length > 0) {
      prepareCurrentQuestion();
      startTimer();
    } else {
      stopTimer();
    }
    renderLeitnerAndHeaderStats();
    renderStage();
  }

  function awardItemXp(itemId) {
    if (!state.awardedIds) state.awardedIds = new Set();
    if (state.awardedIds.has(itemId)) return 0;
    state.awardedIds.add(itemId);
    state.sessionXp = (state.sessionXp || 0) + 10;
    if (window.LexiTagXP && typeof window.LexiTagXP.add === "function") {
      window.LexiTagXP.add(10);
    }
    return 10;
  }

  function finishSession() {
    state.finished = true;
    stopTimer();
    const total = Math.max(1, state.totalAnswered);
    const accuracy = Math.round((state.correctCount / total) * 100);
    const bonusXp = accuracy >= 80 && (state.sessionXp || 0) > 0 ? 20 : 0;
    state.sessionXp = (state.sessionXp || 0) + bonusXp;
    const xp = state.sessionXp;

    const seenWordIds = new Set();
    const sessionWords = [];
    for (const qItem of state.queue) {
      if (!qItem || seenWordIds.has(qItem.id)) continue;
      seenWordIds.add(qItem.id);
      sessionWords.push({
        id: qItem.id,
        w: qItem.w,
        ipa: qItem.ipa || "",
        vi: qItem.vi || "",
        ok: !state.missedMap.has(qItem.id)
      });
    }

    if (window.LexiTagXP && typeof window.LexiTagXP.add === "function") {
      if (bonusXp > 0) {
        window.LexiTagXP.add(bonusXp, `Thưởng đạt ${accuracy}% phiên ôn tập`);
      } else if (xp > 0) {
        showToast(`Hoàn thành phiên ôn tập: +${xp} XP (Tổng: ${window.LexiTagXP.get().toLocaleString("en-US")} XP)`);
      }
    }

    const entry = {
      mode: state.mode,
      modeLabel: MODE_LABELS[state.mode] || state.mode,
      correct: state.correctCount,
      total,
      accuracy,
      xp,
      duration: formatDuration(state.elapsedSec),
      at: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
      words: sessionWords
    };
    reviewHistory = [entry, ...reviewHistory].slice(0, 8);
    saveJson(HISTORY_KEY, reviewHistory);

    if (window.LexiTagHistory && typeof window.LexiTagHistory.record === "function") {
      window.LexiTagHistory.record({
        type: state.mode,
        title: entry.modeLabel,
        correct: state.correctCount,
        total,
        accuracy,
        xp,
        duration: entry.duration,
        timeLabel: entry.at,
        words: sessionWords
      });
    }

    if (window.LexiTagNotif && typeof window.LexiTagNotif.push === "function") {
      window.LexiTagNotif.push({
        title: `Hoàn thành ${entry.modeLabel} (+${xp} XP)`,
        body: `Đạt ${state.correctCount}/${total} câu đúng (${accuracy}%) trong ${entry.duration}. Nhấn để xem lại trong Lịch sử.`,
        icon: accuracy >= 80 ? "verified" : "school",
        tone: accuracy >= 80 ? "green" : "amber",
        target: "history"
      });
    }
    renderStage();
  }

  function nextQuestion() {
    if (state.index + 1 >= state.queue.length) {
      finishSession();
      return;
    }
    state.index++;
    prepareCurrentQuestion();
    renderStage();
  }

  function renderLeitnerAndHeaderStats() {
    const dueCount = getDueWordItems().length;
    const savedCount = getSavedWordItems().length;
    const masteredCount = Object.values(srsStore).filter((r) => r.box >= 5).length;

    const dueEl = document.getElementById("rvDueCount");
    const masteredEl = document.getElementById("rvMasteredCount");
    const savedOpt = document.getElementById("rvSavedSourceOpt");
    if (dueEl) dueEl.textContent = String(dueCount);
    if (masteredEl) masteredEl.textContent = String(masteredCount);
    if (savedOpt) savedOpt.textContent = `Sổ từ đã lưu (${savedCount} từ)`;

    const leitnerBar = document.getElementById("rvLeitnerBar");
    if (!leitnerBar) return;
    leitnerBar.hidden = state.mode !== "srs";

    const boxMeta = [
      { box: 1, title: "Hộp 1", sub: "Mới / Hay quên" },
      { box: 2, title: "Hộp 2", sub: "Ôn 1–2 ngày" },
      { box: 3, title: "Hộp 3", sub: "Ôn 4–6 ngày" },
      { box: 4, title: "Hộp 4", sub: "Nhớ khá chắc" },
      { box: 5, title: "Hộp 5", sub: "Thành thạo" }
    ];

    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    Object.values(srsStore).forEach((r) => {
      const b = Math.min(5, Math.max(1, r.box || 1));
      counts[b]++;
    });

    leitnerBar.innerHTML = boxMeta
      .map(
        (m) => `
        <button class="rv-leitner-card${m.box === 5 ? " mastered" : ""}${state.boxFilter === m.box ? " active" : ""}" type="button" data-rv-box="${m.box}" title="Nhấn để lọc ôn các từ thuộc ${m.title}">
          <strong>${counts[m.box]}</strong>
          <span>${m.title}</span>
          <small>${m.sub}</small>
        </button>`
      )
      .join("");
  }

  function renderHistory() {
    const list = document.getElementById("rvHistoryList");
    if (!list) return;
    if (!reviewHistory.length) {
      list.innerHTML = `<div class="rv-history-row"><small>Chưa có phiên ôn tập nào trong hôm nay. Hãy hoàn thành một phiên để ghi nhận kết quả!</small></div>`;
      return;
    }
    list.innerHTML = reviewHistory
      .map(
        (h) => `
        <div class="rv-history-row">
          <div>
            <strong>${escapeHtml(h.modeLabel)}</strong>
            <small> · ${h.correct}/${h.total} câu đúng · ${escapeHtml(h.duration)} · Lúc ${escapeHtml(h.at)}</small>
          </div>
          <span class="rv-score-pill ${h.accuracy >= 80 ? "pass" : "retry"}">${h.accuracy}% · +${h.xp} XP</span>
        </div>`
      )
      .join("");
  }

  function renderSummary(stage) {
    const total = Math.max(1, state.totalAnswered);
    const accuracy = Math.round((state.correctCount / total) * 100);
    const passed = accuracy >= 80;
    const xp = state.sessionXp || 0;
    const missed = Array.from(state.missedMap.values());

    stage.innerHTML = `
      <div class="rv-summary">
        <div class="rv-summary-badge ${passed ? "pass" : "retry"}">
          <span class="material-symbols-outlined">${passed ? "verified" : "refresh"}</span>
          <span>${passed ? "Đạt chuẩn ≥ 80% · Mở khóa tiến độ!" : "Dưới 80% · Nên ôn lại các từ sai"}</span>
        </div>
        <h2>Hoàn thành phiên ${escapeHtml(MODE_LABELS[state.mode])}</h2>
        <p class="rv-summary-sub">Toàn bộ tiến độ SM-2 &amp; Hộp Leitner của bạn đã được lưu tự động.</p>

        <div class="rv-summary-metrics">
          <div class="rv-sum-box">
            <strong>${accuracy}%</strong>
            <span>Độ chính xác</span>
          </div>
          <div class="rv-sum-box">
            <strong>${state.correctCount} / ${total}</strong>
            <span>Trả lời đúng</span>
          </div>
          <div class="rv-sum-box">
            <strong>+${xp} XP</strong>
            <span>Điểm thưởng</span>
          </div>
          <div class="rv-sum-box">
            <strong>${formatDuration(state.elapsedSec)}</strong>
            <span>Thời gian</span>
          </div>
        </div>

        ${
          missed.length
            ? `<div style="text-align:left;">
                <strong style="font-size:13.5px; color:var(--text-title);">Các từ cần ôn lại (${missed.length} từ):</strong>
                <div class="rv-missed-list">
                  ${missed
                    .map(
                      (m) => `
                      <div class="rv-missed-item">
                        <div>
                          <strong>${escapeHtml(m.w)}</strong> <small style="color:var(--text-muted);">${escapeHtml(m.ipa)}</small>
                          <div><span>${escapeHtml(m.vi)}</span></div>
                        </div>
                        <button class="rv-btn-outline" type="button" data-rv-speak="${escapeHtml(cleanAnswerTarget(m.w))}">
                          <span class="material-symbols-outlined">volume_up</span>
                        </button>
                      </div>`
                    )
                    .join("")}
                </div>
              </div>`
            : `<p style="color:var(--soft-green-fg); font-weight:700; margin-bottom:18px;">Tuyệt vời! Bạn không làm sai từ nào trong phiên này 🎉</p>`
        }

        <div class="rv-summary-actions">
          ${
            missed.length
              ? `<button class="rv-btn-primary" type="button" id="rvRetryMissedBtn">
                  <span class="material-symbols-outlined">replay</span>
                  <span>Ôn lại ${missed.length} từ sai</span>
                </button>`
              : ""
          }
          <button class="${missed.length ? "rv-btn-outline" : "rv-btn-primary"}" type="button" id="rvNewSessionBtn">
            <span class="material-symbols-outlined">play_arrow</span>
            <span>Bắt đầu phiên mới</span>
          </button>
        </div>
      </div>
    `;

    const retryBtn = document.getElementById("rvRetryMissedBtn");
    const newBtn = document.getElementById("rvNewSessionBtn");
    if (retryBtn) retryBtn.addEventListener("click", () => startSession(missed));
    if (newBtn) newBtn.addEventListener("click", () => startSession());
  }

  function renderEmptyStage(stage) {
    const isSaved = state.source === "saved";
    stage.innerHTML = `
      <div class="rv-summary" style="padding: 28px 12px;">
        <span class="material-symbols-outlined" style="font-size:44px; color:var(--text-subtle);">inventory_2</span>
        <h2 style="margin-top:8px;">${
          isSaved
            ? "Sổ từ đã lưu đang trống"
            : state.boxFilter > 0
              ? `Hộp Leitner ${state.boxFilter} chưa có từ nào`
              : "Không có từ phù hợp nguồn đã chọn"
        }</h2>
        <p class="rv-summary-sub">${
          isSaved
            ? "Hãy sang mục Tra từ và nhấn biểu tượng dấu trang để lưu từ cần ôn, hoặc chọn nguồn Oxford 3000."
            : "Bạn có thể bỏ lọc Hộp Leitner hoặc chuyển sang nguồn Oxford 3000 A1–B2 để luyện tập ngay."
        }</p>
        <div class="rv-summary-actions">
          ${
            isSaved
              ? `<button class="rv-btn-outline" type="button" onclick="switchTab('dictionary')">
                  <span class="material-symbols-outlined">find_in_page</span>
                  <span>Mở Tra từ</span>
                </button>`
              : ""
          }
          <button class="rv-btn-primary" type="button" id="rvSwitchToA1Btn">
            <span class="material-symbols-outlined">bolt</span>
            <span>Ôn nhanh 10 từ Oxford A1–B2</span>
          </button>
        </div>
      </div>
    `;
    const btn = document.getElementById("rvSwitchToA1Btn");
    if (btn) {
      btn.addEventListener("click", () => {
        state.boxFilter = 0;
        state.source = "ALL";
        const sel = document.getElementById("rvSourceSelect");
        if (sel) sel.value = "ALL";
        startSession();
      });
    }
  }

  function renderStage() {
    const stage = document.getElementById("rvStageCard");
    if (!stage) return;

    if (state.finished) {
      renderSummary(stage);
      return;
    }

    if (!state.queue.length || !state.queue[state.index]) {
      renderEmptyStage(stage);
      return;
    }

    const item = state.queue[state.index];
    const total = state.queue.length;
    const pct = Math.round(((state.index + (state.answered ? 1 : 0)) / total) * 100);
    const headerBar = `
      <div class="rv-progress-row">
        <span>Câu / Thẻ <strong>${state.index + 1}</strong> / ${total} · ${escapeHtml(MODE_LABELS[state.mode])}</span>
        <div class="rv-progress-meta">
          <span>Đúng: <strong style="color:var(--soft-green-fg);">${state.correctCount}</strong></span>
          <span class="rv-timer-chip">
            <span class="material-symbols-outlined">timer</span>
            <span id="rvTimerVal">${formatDuration(state.elapsedSec)}</span>
          </span>
        </div>
      </div>
      <div class="rv-progress-track">
        <div class="rv-progress-fill" style="width: ${pct}%;"></div>
      </div>
    `;

    if (state.mode === "srs") {
      renderSrsMode(stage, headerBar, item);
    } else if (state.mode === "quiz") {
      renderQuizMode(stage, headerBar, item);
    } else if (state.mode === "typing") {
      renderTypingMode(stage, headerBar, item);
    } else {
      renderDictationMode(stage, headerBar, item);
    }
  }

  // ===== MODE 1: SRS SM-2 =====
  function renderSrsMode(stage, headerBar, item) {
    const rec = getSrsRecord(item.id);
    const pAgain = computeSm2Next(rec, "again");
    const pHard = computeSm2Next(rec, "hard");
    const pGood = computeSm2Next(rec, "good");
    const pEasy = computeSm2Next(rec, "easy");
    const cleanW = cleanAnswerTarget(item.w);

    stage.innerHTML = `
      ${headerBar}
      <div class="rv-srs-wrap">
        <div class="rv-flashcard-scene" id="rvFlashcardScene">
          <div class="rv-flashcard${state.flipped ? " flipped" : ""}" id="rvFlashcard">
            <div class="rv-face front">
              <div class="rv-face-top">
                <div class="rv-tags">
                  <span class="rv-tag level">${escapeHtml(item.lv)}</span>
                  ${item.pos ? `<span class="rv-tag">${escapeHtml(item.pos)}</span>` : ""}
                  <span class="rv-tag box">Hộp Leitner ${rec.box}</span>
                </div>
                <span class="rv-hint-label">Nhấn thẻ hoặc phím Space để lật</span>
              </div>

              <div class="rv-front-center">
                <h2 class="rv-word-big">${escapeHtml(item.w)}</h2>
                <p class="rv-ipa-big">${escapeHtml(item.ipa || "")}</p>
                <div class="rv-audio-row">
                  <button class="rv-btn-outline" type="button" data-rv-speak="${escapeHtml(cleanW)}">
                    <span class="material-symbols-outlined">volume_up</span>
                    <span>Nghe (${state.accent === "en-GB" ? "UK" : "US"})</span>
                  </button>
                  <button class="rv-btn-outline" type="button" data-rv-speak-slow="${escapeHtml(cleanW)}">
                    <span class="material-symbols-outlined">slow_motion_video</span>
                    <span>Chậm 0.7×</span>
                  </button>
                </div>
              </div>

              <div class="rv-face-top">
                <span class="rv-hint-label">Chủ đề: ${escapeHtml(item.tp)}</span>
                <span class="rv-hint-label">EF: ${rec.ef}</span>
              </div>
            </div>

            <div class="rv-face back">
              <div class="rv-face-top">
                <div class="rv-tags">
                  <span class="rv-tag level">${escapeHtml(item.w)} ${escapeHtml(item.ipa)}</span>
                  <span class="rv-tag box">Hộp ${rec.box}</span>
                </div>
                <button class="rv-btn-outline" type="button" data-rv-speak="${escapeHtml(cleanW)}" style="min-height:32px; padding:0 10px;">
                  <span class="material-symbols-outlined">volume_up</span>
                </button>
              </div>

              <div class="rv-back-body">
                <div>
                  <span class="rv-hint-label" style="text-transform:uppercase; font-weight:700;">Nghĩa tiếng Việt</span>
                  <h3 class="rv-meaning-big">${escapeHtml(item.vi)}</h3>
                </div>
                ${
                  item.en
                    ? `<div class="rv-example-card">
                        <p class="rv-example-en">${highlightWordInExample(item.en, item.w)}</p>
                        ${item.ev ? `<p class="rv-example-vi">${escapeHtml(item.ev)}</p>` : ""}
                      </div>`
                    : ""
                }
              </div>

              <div class="rv-face-top">
                <span class="rv-hint-label">Tự đánh giá mức độ nhớ bên dưới (phím 1–4)</span>
              </div>
            </div>
          </div>
        </div>

        <div class="rv-sm2-bar">
          ${
            !state.flipped
              ? `<div class="rv-flip-prompt">
                  <button class="rv-btn-primary" type="button" id="rvFlipBtn" style="min-width:220px;">
                    <span class="material-symbols-outlined">flip</span>
                    <span>Hiện đáp án (Space)</span>
                  </button>
                </div>`
              : `<div class="rv-sm2-grid">
                  <button class="rv-rate-btn rv-rate-again" type="button" data-rv-rate="again">
                    <strong>1 · Again</strong>
                    <small>Quên · ${pAgain.label}</small>
                  </button>
                  <button class="rv-rate-btn rv-rate-hard" type="button" data-rv-rate="hard">
                    <strong>2 · Hard</strong>
                    <small>Khó · ${pHard.label}</small>
                  </button>
                  <button class="rv-rate-btn rv-rate-good" type="button" data-rv-rate="good">
                    <strong>3 · Good</strong>
                    <small>Nhớ · ${pGood.label}</small>
                  </button>
                  <button class="rv-rate-btn rv-rate-easy" type="button" data-rv-rate="easy">
                    <strong>4 · Easy</strong>
                    <small>Rất dễ · ${pEasy.label}</small>
                  </button>
                </div>`
          }
        </div>
      </div>
    `;

    const scene = document.getElementById("rvFlashcardScene");
    const flipBtn = document.getElementById("rvFlipBtn");
    if (scene) {
      scene.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        state.flipped = !state.flipped;
        renderStage();
      });
    }
    if (flipBtn) {
      flipBtn.addEventListener("click", () => {
        state.flipped = true;
        renderStage();
      });
    }
    stage.querySelectorAll("[data-rv-rate]").forEach((btn) => {
      btn.addEventListener("click", () => handleSrsRate(btn.dataset.rvRate));
    });
  }

  function handleSrsRate(rating) {
    const item = state.queue[state.index];
    if (!item) return;
    const next = applySrsUpdate(item.id, rating);
    state.totalAnswered++;

    if (rating === "again") {
      state.missedMap.set(item.id, item);
      // Re-queue at end of current session if not already repeated excessively
      if (state.queue.length < state.size + 6) {
        state.queue.push(item);
      }
      showToast(`"${item.w}" về Hộp 1 — sẽ ôn lại cuối phiên!`);
    } else {
      state.correctCount++;
      const gained = awardItemXp(item.id);
      showToast(`"${item.w}" → Hộp ${next.box} (ôn lại sau ${next.label})${gained ? ` · +${gained} XP` : ""}`);
    }
    nextQuestion();
  }

  // ===== MODE 2: MULTIPLE CHOICE QUIZ =====
  function renderQuizMode(stage, headerBar, item) {
    const cleanW = cleanAnswerTarget(item.w);
    const keys = ["A", "B", "C", "D"];

    stage.innerHTML = `
      ${headerBar}
      <div class="rv-quiz-wrap">
        <div class="rv-prompt-box">
          <p class="rv-prompt-eyebrow">Chọn nghĩa tiếng Việt đúng của từ (${escapeHtml(item.lv)} · ${escapeHtml(item.pos || "vocab")})</p>
          <h2 class="rv-prompt-word">${escapeHtml(item.w)}</h2>
          <p class="rv-prompt-sub">${escapeHtml(item.ipa || "")}</p>
          <div class="rv-audio-row">
            <button class="rv-btn-outline" type="button" data-rv-speak="${escapeHtml(cleanW)}">
              <span class="material-symbols-outlined">volume_up</span>
              <span>Nghe phát âm</span>
            </button>
          </div>
        </div>

        <div class="rv-options-grid">
          ${state.quizOptions
            .map((opt, idx) => {
              let cls = "";
              if (state.answered) {
                if (opt.isCorrect) cls = " correct";
                else if (idx === state.quizSelectedIdx) cls = " wrong";
              }
              return `
                <button class="rv-option-btn${cls}" type="button" data-rv-opt="${idx}" ${state.answered ? "disabled" : ""}>
                  <span class="rv-option-key">${keys[idx]}</span>
                  <span>${escapeHtml(opt.text)}</span>
                </button>`;
            })
            .join("")}
        </div>

        ${renderFeedbackHtml(item)}
      </div>
    `;

    stage.querySelectorAll("[data-rv-opt]").forEach((btn) => {
      btn.addEventListener("click", () => handleQuizChoice(Number(btn.dataset.rvOpt)));
    });
    bindNextBtn();
  }

  function handleQuizChoice(idx) {
    if (state.answered) return;
    const item = state.queue[state.index];
    const opt = state.quizOptions[idx];
    if (!item || !opt) return;

    state.answered = true;
    state.quizSelectedIdx = idx;
    state.totalAnswered++;

    if (opt.isCorrect) {
      state.correctCount++;
      applySrsUpdate(item.id, "good");
      const gained = awardItemXp(item.id);
      state.feedback = {
        type: "ok",
        title: `Chính xác!${gained ? ` +${gained} XP` : ""}`,
        detail: item.en ? `Ví dụ: "${item.en}" — ${item.ev}` : `${item.w}: ${item.vi}`
      };
    } else {
      state.missedMap.set(item.id, item);
      applySrsUpdate(item.id, "again");
      state.feedback = {
        type: "err",
        title: "Chưa đúng rồi!",
        detail: `Đáp án đúng là: "${item.vi}". Từ này đã được đưa về Hộp 1 để bạn ôn lại.`
      };
    }
    renderStage();
  }

  // ===== MODE 3: TYPING MODE =====
  function renderTypingMode(stage, headerBar, item) {
    const target = cleanAnswerTarget(item.w);
    const hintText =
      state.hintCount > 0
        ? target
            .split("")
            .map((ch, idx) => (idx < state.hintCount || ch === " " || ch === "-" ? ch : "_"))
            .join(" ")
        : "";

    stage.innerHTML = `
      ${headerBar}
      <div class="rv-input-wrap">
        <div class="rv-prompt-box">
          <p class="rv-prompt-eyebrow">Gõ từ tiếng Anh tương ứng (${escapeHtml(item.lv)} · ${escapeHtml(item.pos || "vocab")})</p>
          <h2 class="rv-prompt-word" style="font-size:26px;">${escapeHtml(item.vi)}</h2>
          ${
            item.en
              ? `<p class="rv-cloze-sentence">${maskWordInExample(item.en, item.w)}</p>`
              : ""
          }
          ${
            hintText
              ? `<p class="rv-prompt-sub" style="letter-spacing:0.12em; margin-top:10px;">Gợi ý: ${escapeHtml(hintText)}</p>`
              : ""
          }
        </div>

        <form class="rv-typing-form" id="rvTypingForm">
          <input
            type="text"
            class="rv-typing-input"
            id="rvTypingInput"
            placeholder="Nhập từ tiếng Anh..."
            autocomplete="off"
            spellcheck="false"
            ${state.answered ? "disabled" : ""}
          >
          <button class="rv-btn-primary" type="submit" ${state.answered ? "disabled" : ""}>
            <span class="material-symbols-outlined">check_circle</span>
            <span>Kiểm tra</span>
          </button>
        </form>

        <div class="rv-typing-tools">
          <button class="rv-btn-outline" type="button" id="rvHintBtn" ${state.answered ? "disabled" : ""}>
            <span class="material-symbols-outlined">lightbulb</span>
            <span>Gợi ý chữ cái</span>
          </button>
          <button class="rv-btn-outline" type="button" id="rvGiveUpBtn" ${state.answered ? "disabled" : ""}>
            <span class="material-symbols-outlined">visibility</span>
            <span>Hiện đáp án</span>
          </button>
        </div>

        ${renderFeedbackHtml(item)}
      </div>
    `;

    bindTypingEvents(item, false);
    bindNextBtn();
  }

  // ===== MODE 4: DICTATION MODE =====
  function renderDictationMode(stage, headerBar, item) {
    const target = cleanAnswerTarget(item.w);
    const hintText =
      state.hintCount > 0
        ? target
            .split("")
            .map((ch, idx) => (idx < state.hintCount || ch === " " || ch === "-" ? ch : "_"))
            .join(" ")
        : "";

    stage.innerHTML = `
      ${headerBar}
      <div class="rv-input-wrap">
        <div class="rv-prompt-box">
          <p class="rv-prompt-eyebrow">Nghe phát âm và chép lại chính tả (${escapeHtml(item.lv)} · ${escapeHtml(item.pos || "vocab")})</p>
          <button class="rv-dictation-speaker" type="button" data-rv-speak="${escapeHtml(target)}" title="Nghe lại phát âm">
            <span class="material-symbols-outlined">volume_up</span>
          </button>
          <div class="rv-audio-row" style="margin-top:4px;">
            <button class="rv-btn-outline" type="button" data-rv-speak="${escapeHtml(target)}">
              <span class="material-symbols-outlined">replay</span>
              <span>Nghe lại (${state.accent === "en-GB" ? "UK" : "US"})</span>
            </button>
            <button class="rv-btn-outline" type="button" data-rv-speak-slow="${escapeHtml(target)}">
              <span class="material-symbols-outlined">slow_motion_video</span>
              <span>Nghe chậm 0.7×</span>
            </button>
          </div>
          ${
            state.showDictationMeaning
              ? `<p class="rv-cloze-sentence">Gợi ý nghĩa: <strong>${escapeHtml(item.vi)}</strong> ${escapeHtml(item.ipa)}</p>`
              : ""
          }
          ${
            hintText
              ? `<p class="rv-prompt-sub" style="letter-spacing:0.12em; margin-top:10px;">Gợi ý: ${escapeHtml(hintText)}</p>`
              : ""
          }
        </div>

        <form class="rv-typing-form" id="rvTypingForm">
          <input
            type="text"
            class="rv-typing-input"
            id="rvTypingInput"
            placeholder="Gõ lại từ tiếng Anh bạn vừa nghe..."
            autocomplete="off"
            spellcheck="false"
            ${state.answered ? "disabled" : ""}
          >
          <button class="rv-btn-primary" type="submit" ${state.answered ? "disabled" : ""}>
            <span class="material-symbols-outlined">check_circle</span>
            <span>Kiểm tra</span>
          </button>
        </form>

        <div class="rv-typing-tools">
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button class="rv-btn-outline" type="button" id="rvHintBtn" ${state.answered ? "disabled" : ""}>
              <span class="material-symbols-outlined">lightbulb</span>
              <span>Gợi ý chữ cái</span>
            </button>
            <button class="rv-btn-outline" type="button" id="rvToggleMeaningBtn" ${state.answered ? "disabled" : ""}>
              <span class="material-symbols-outlined">translate</span>
              <span>${state.showDictationMeaning ? "Ẩn nghĩa" : "Xem nghĩa gợi ý"}</span>
            </button>
          </div>
          <button class="rv-btn-outline" type="button" id="rvGiveUpBtn" ${state.answered ? "disabled" : ""}>
            <span class="material-symbols-outlined">visibility</span>
            <span>Hiện đáp án</span>
          </button>
        </div>

        ${renderFeedbackHtml(item)}
      </div>
    `;

    bindTypingEvents(item, true);
    bindNextBtn();
  }

  function bindTypingEvents(item, isDictation) {
    const form = document.getElementById("rvTypingForm");
    const input = document.getElementById("rvTypingInput");
    const hintBtn = document.getElementById("rvHintBtn");
    const giveUpBtn = document.getElementById("rvGiveUpBtn");
    const toggleMeaningBtn = document.getElementById("rvToggleMeaningBtn");

    if (input && !state.answered) {
      setTimeout(() => input.focus(), 40);
    }

    if (hintBtn) {
      hintBtn.addEventListener("click", () => {
        const target = cleanAnswerTarget(item.w);
        state.hintCount = Math.min(target.length - 1, state.hintCount + 1);
        renderStage();
      });
    }

    if (toggleMeaningBtn) {
      toggleMeaningBtn.addEventListener("click", () => {
        state.showDictationMeaning = !state.showDictationMeaning;
        renderStage();
      });
    }

    if (giveUpBtn) {
      giveUpBtn.addEventListener("click", () => {
        if (state.answered) return;
        const target = cleanAnswerTarget(item.w);
        state.answered = true;
        state.totalAnswered++;
        state.missedMap.set(item.id, item);
        applySrsUpdate(item.id, "again");
        state.feedback = {
          type: "err",
          title: `Đáp án đúng: ${target} ${item.ipa}`,
          detail: `${item.vi}${item.en ? ` · VD: "${item.en}"` : ""}`
        };
        speakText(target, 1.0);
        renderStage();
      });
    }

    if (form && input) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (state.answered) {
          nextQuestion();
          return;
        }
        const typed = input.value.trim();
        if (!typed) {
          showToast("Hãy nhập từ trước khi kiểm tra.");
          return;
        }
        evaluateTypedAnswer(typed, item, isDictation);
      });
    }
  }

  function evaluateTypedAnswer(typed, item, isDictation) {
    const target = cleanAnswerTarget(item.w);
    const a = typed.toLowerCase();
    const b = target.toLowerCase();

    // 1. Exact match
    if (a === b) {
      state.answered = true;
      state.totalAnswered++;
      state.correctCount++;
      applySrsUpdate(item.id, "good");
      const gained = awardItemXp(item.id);
      state.feedback = {
        type: "ok",
        title: `Chính xác! "${target}" ${item.ipa}${gained ? ` (+${gained} XP)` : ""}`,
        detail: `${item.vi}${item.en ? ` · VD: "${item.en}"` : ""}`
      };
      speakText(target, 1.0);
      renderStage();
      return;
    }

    // 2. Dictation phonetic match (Soundex) — e.g. fone vs phone
    if (isDictation && isPhoneticallySimilar(a, b)) {
      state.answered = true;
      state.totalAnswered++;
      state.missedMap.set(item.id, item);
      applySrsUpdate(item.id, "hard");
      state.feedback = {
        type: "info",
        title: "Tai bạn nghe rất chuẩn! Nhưng chính tả hơi khác một chút.",
        detail: `Bạn gõ "${typed}" — chính tả chuẩn của từ này là: "${target}" ${item.ipa} (${item.vi}).`
      };
      speakText(target, 1.0);
      renderStage();
      return;
    }

    // 3. Adjacent transposition (e.g. paeceful vs peaceful) — give 1 gentle retry!
    if (isAdjacentTransposition(a, b) && !state.retryUsed) {
      state.retryUsed = true;
      state.feedback = {
        type: "warn",
        title: "Bạn bị đảo lộn vị trí 2 chữ cái liền kề!",
        detail: `Bạn vừa gõ "${typed}". Kiểm tra lại thứ tự chữ cái và gõ lại lần nữa nhé!`
      };
      renderStage();
      const inp = document.getElementById("rvTypingInput");
      if (inp) {
        inp.value = typed;
        inp.focus();
      }
      return;
    }

    // 4. Off by 1 character (Levenshtein === 1) — give 1 gentle retry!
    if (levenshtein(a, b) === 1 && !state.retryUsed) {
      state.retryUsed = true;
      state.feedback = {
        type: "warn",
        title: "Gần đúng rồi! Bạn đang sai 1 ký tự.",
        detail: `Bạn vừa gõ "${typed}". Hãy kiểm tra kỹ chính tả và thử gõ lại nhé!`
      };
      renderStage();
      const inp = document.getElementById("rvTypingInput");
      if (inp) {
        inp.value = typed;
        inp.focus();
      }
      return;
    }

    // 5. Wrong answer
    state.answered = true;
    state.totalAnswered++;
    state.missedMap.set(item.id, item);
    applySrsUpdate(item.id, "again");
    state.feedback = {
      type: "err",
      title: `Chưa chính xác (bạn gõ "${typed}")`,
      detail: `Đáp án đúng là: "${target}" ${item.ipa} — ${item.vi}.`
    };
    speakText(target, 1.0);
    renderStage();
  }

  function renderFeedbackHtml(item) {
    if (!state.feedback) return "";
    const fb = state.feedback;
    const isLast = state.index + 1 >= state.queue.length;
    return `
      <div class="rv-feedback ${fb.type}">
        <div class="rv-feedback-body">
          <strong>${escapeHtml(fb.title)}</strong>
          <p>${escapeHtml(fb.detail)}</p>
        </div>
        ${
          state.answered
            ? `<button class="rv-btn-primary" type="button" id="rvNextBtn">
                <span>${isLast ? "Xem kết quả" : "Câu tiếp theo"}</span>
                <span class="material-symbols-outlined">arrow_forward</span>
              </button>`
            : ""
        }
      </div>
    `;
  }

  function bindNextBtn() {
    const nextBtn = document.getElementById("rvNextBtn");
    if (nextBtn) nextBtn.addEventListener("click", nextQuestion);
  }

  function bindStaticEvents() {
    // Mode switcher tabs
    document.querySelectorAll("[data-rv-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.mode = btn.dataset.rvMode;
        state.boxFilter = 0;
        document.querySelectorAll("[data-rv-mode]").forEach((b) =>
          b.classList.toggle("active", b === btn)
        );
        startSession();
      });
    });

    // Source / Size / Accent selects
    const sourceSel = document.getElementById("rvSourceSelect");
    const sizeSel = document.getElementById("rvSizeSelect");
    const accentSel = document.getElementById("rvAccentSelect");
    const restartBtn = document.getElementById("rvRestartBtn");

    if (sourceSel) {
      sourceSel.addEventListener("change", () => {
        state.source = sourceSel.value;
        state.boxFilter = 0;
        startSession();
      });
    }
    if (sizeSel) {
      sizeSel.addEventListener("change", () => {
        state.size = Number(sizeSel.value) || 10;
        startSession();
      });
    }
    if (accentSel) {
      accentSel.addEventListener("change", () => {
        state.accent = accentSel.value;
        renderStage();
      });
    }
    if (restartBtn) {
      restartBtn.addEventListener("click", () => startSession());
    }

    // Leitner box click filter (delegated)
    const leitnerBar = document.getElementById("rvLeitnerBar");
    if (leitnerBar) {
      leitnerBar.addEventListener("click", (e) => {
        const card = e.target.closest("[data-rv-box]");
        if (!card) return;
        const boxNum = Number(card.dataset.rvBox);
        state.boxFilter = state.boxFilter === boxNum ? 0 : boxNum;
        startSession();
      });
    }

    // Delegated speech buttons inside stage
    const stage = document.getElementById("rvStageCard");
    if (stage) {
      stage.addEventListener("click", (e) => {
        const fastBtn = e.target.closest("[data-rv-speak]");
        if (fastBtn) {
          e.stopPropagation();
          speakText(fastBtn.dataset.rvSpeak, 1.0);
          return;
        }
        const slowBtn = e.target.closest("[data-rv-speak-slow]");
        if (slowBtn) {
          e.stopPropagation();
          speakText(slowBtn.dataset.rvSpeakSlow, 0.7);
        }
      });
    }

    // Refresh saved/due counts whenever user switches to #review
    window.addEventListener("hashchange", () => {
      if (window.location.hash === "#review") {
        renderLeitnerAndHeaderStats();
        if (state.source === "saved") startSession();
      }
    });

    // Keyboard shortcuts when #viewReview is active
    document.addEventListener("keydown", (e) => {
      const view = document.getElementById("viewReview");
      if (!view || !view.classList.contains("active") || state.finished) return;
      const tag = (e.target && e.target.tagName) || "";
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      if (state.mode === "srs" && !isInput) {
        if (e.code === "Space") {
          e.preventDefault();
          state.flipped = !state.flipped;
          renderStage();
        } else if (state.flipped && ["1", "2", "3", "4"].includes(e.key)) {
          const map = { 1: "again", 2: "hard", 3: "good", 4: "easy" };
          handleSrsRate(map[e.key]);
        }
      } else if (state.mode === "quiz" && !isInput) {
        if (!state.answered && ["1", "2", "3", "4"].includes(e.key)) {
          handleQuizChoice(Number(e.key) - 1);
        } else if (state.answered && e.key === "Enter") {
          e.preventDefault();
          nextQuestion();
        }
      } else if ((state.mode === "typing" || state.mode === "dictation") && state.answered && e.key === "Enter") {
        e.preventDefault();
        nextQuestion();
      }
    });
  }

  // Expose helper for programmatic opening into a specific mode
  window.openReviewMode = function (mode = "srs") {
    if (typeof window.switchTab === "function") window.switchTab("review");
    if (MODE_LABELS[mode]) {
      state.mode = mode;
      document.querySelectorAll("[data-rv-mode]").forEach((b) =>
        b.classList.toggle("active", b.dataset.rvMode === mode)
      );
    }
    startSession();
  };

  // Launch Review directly with a specific word list (used by "Ôn lại phiên này" in History)
  window.openReviewWithWords = function (words, mode = "srs") {
    if (typeof window.switchTab === "function") window.switchTab("review");
    if (MODE_LABELS[mode]) {
      state.mode = mode;
      document.querySelectorAll("[data-rv-mode]").forEach((b) =>
        b.classList.toggle("active", b.dataset.rvMode === mode)
      );
    }
    startSession(Array.isArray(words) && words.length ? words : null);
  };

  document.addEventListener("DOMContentLoaded", () => {
    bindStaticEvents();
    renderLeitnerAndHeaderStats();
    startSession();
  });
})();
