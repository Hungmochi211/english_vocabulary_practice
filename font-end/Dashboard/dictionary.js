(() => {
  "use strict";

  const SAVED_KEY = "lexitag-dict-saved-v1";
  const HISTORY_KEY = "lexitag-dict-history-v1";
  const PAGE_SIZE = 40;

  const rawDict = Array.isArray(window.OXFORD_DICTIONARY) ? window.OXFORD_DICTIONARY : [];

  function stripDiacritics(str) {
    return String(str || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase();
  }

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

  function levenshtein(a, b) {
    if (a === b) return 0;
    const al = a.length;
    const bl = b.length;
    if (Math.abs(al - bl) > 2) return 3;
    let prev = new Array(bl + 1);
    let curr = new Array(bl + 1);
    for (let j = 0; j <= bl; j++) prev[j] = j;
    for (let i = 1; i <= al; i++) {
      curr[0] = i;
      let rowMin = curr[0];
      for (let j = 1; j <= bl; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
        if (curr[j] < rowMin) rowMin = curr[j];
      }
      if (rowMin > 2) return 3;
      const tmp = prev;
      prev = curr;
      curr = tmp;
    }
    return prev[bl];
  }

  // Pre-index dictionary for ultra-fast client-side search
  const DICT = rawDict.map((item) => ({
    ...item,
    _w: String(item.w || "").toLowerCase(),
    _vi: stripDiacritics(item.vi || ""),
    _tp: String(item.tp || "").toLowerCase()
  }));

  const BY_ID = new Map(DICT.map((item) => [item.id, item]));

  let savedIds = loadJson(SAVED_KEY, []);
  if (!Array.isArray(savedIds)) savedIds = [];
  let savedSet = new Set(savedIds);

  let historyList = loadJson(HISTORY_KEY, ["peaceful", "environment", "achieve", "opportunity"]);
  if (!Array.isArray(historyList)) historyList = [];

  const filterState = {
    query: "",
    level: "ALL",
    pos: "ALL",
    topic: "ALL",
    onlySaved: false,
    accent: "en-US",
    limit: PAGE_SIZE,
    selectedId: DICT[0] ? DICT[0].id : null
  };

  let currentMatches = [];
  let searchTimer = 0;
  let toastTimer = 0;

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
      // Ignore storage quota errors
    }
  }

  function showToast(msg) {
    const el = document.getElementById("profileToast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
  }

  function speakText(text, rate = 1.0) {
    if (!text) return;
    if (!("speechSynthesis" in window)) {
      showToast("Trình duyệt không hỗ trợ phát âm thanh.");
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = filterState.accent;
      utter.rate = rate;
      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find((v) => v.lang === filterState.accent) ||
        voices.find((v) => v.lang && v.lang.startsWith("en"));
      if (preferred) utter.voice = preferred;
      window.speechSynthesis.speak(utter);
    } catch {
      showToast("Không thể phát âm thanh lúc này.");
    }
  }

  function addHistory(term) {
    const clean = String(term || "").trim();
    if (clean.length < 2) return;
    historyList = [clean, ...historyList.filter((h) => h.toLowerCase() !== clean.toLowerCase())].slice(0, 10);
    saveJson(HISTORY_KEY, historyList);
    renderHistory();
  }

  function toggleSaved(id) {
    const item = BY_ID.get(id);
    if (!item) return;
    if (savedSet.has(id)) {
      savedSet.delete(id);
      showToast(`Đã bỏ "${item.w}" khỏi Sổ từ.`);
    } else {
      savedSet.add(id);
      showToast(`Đã lưu "${item.w}" vào Sổ từ của bạn!`);
    }
    savedIds = Array.from(savedSet);
    saveJson(SAVED_KEY, savedIds);
    updateSavedCounter();
    if (filterState.onlySaved) {
      runSearch(false);
    } else {
      renderResultsList();
      renderDetail();
    }
  }

  function updateSavedCounter() {
    const badge = document.getElementById("dictSavedCount");
    if (badge) badge.textContent = String(savedSet.size);
  }

  function matchPos(itemPos, selectedPos) {
    if (selectedPos === "ALL") return true;
    if (selectedPos === "OTHER") {
      return !["n.", "v.", "adj.", "adv.", "prep."].includes(itemPos);
    }
    return itemPos === selectedPos;
  }

  function computeMatches() {
    const rawQ = filterState.query.trim();
    const qEn = rawQ.toLowerCase();
    const qVi = stripDiacritics(rawQ);
    const hasQuery = rawQ.length > 0;

    const scored = [];
    for (let i = 0; i < DICT.length; i++) {
      const item = DICT[i];
      if (filterState.onlySaved && !savedSet.has(item.id)) continue;
      if (filterState.level !== "ALL" && item.lv !== filterState.level) continue;
      if (!matchPos(item.pos, filterState.pos)) continue;
      if (filterState.topic !== "ALL" && item.tp !== filterState.topic) continue;

      if (!hasQuery) {
        scored.push({ item, score: 10 });
        continue;
      }

      let score = 0;
      if (item._w === qEn) score = 100;
      else if (item._w.startsWith(qEn)) score = 80;
      else if (item._vi === qVi) score = 75;
      else if (item._vi.startsWith(qVi)) score = 65;
      else if (item._w.includes(qEn)) score = 50;
      else if (item._vi.includes(qVi)) score = 40;
      else if (item._tp.includes(qEn)) score = 20;

      if (score > 0) scored.push({ item, score });
    }

    if (hasQuery) {
      scored.sort((a, b) => b.score - a.score || a.item._w.localeCompare(b.item._w));
    }
    return scored.map((s) => s.item);
  }

  function computeSuggestions(rawQ) {
    const q = rawQ.trim().toLowerCase();
    if (q.length < 3 || q.length > 24 || /[^a-z\s'-]/.test(q)) return [];
    const seen = new Set();
    const cands = [];
    for (let i = 0; i < DICT.length; i++) {
      const w = DICT[i]._w;
      if (seen.has(w)) continue;
      if (Math.abs(w.length - q.length) > 2) continue;
      const dist = levenshtein(q, w);
      if (dist <= 2) {
        seen.add(w);
        cands.push({ word: DICT[i].w, dist });
      }
    }
    cands.sort((a, b) => a.dist - b.dist || a.word.localeCompare(b.word));
    return cands.slice(0, 6).map((c) => c.word);
  }

  function highlightWordInExample(example, word) {
    const safeEx = escapeHtml(example);
    if (!word) return safeEx;
    const base = word.replace(/\s*\(.*\)$/, "").trim();
    if (!base) return safeEx;
    const pattern = new RegExp(`\\b(${escapeRegex(base)}[a-z']*)\\b`, "gi");
    return safeEx.replace(pattern, "<mark>$1</mark>");
  }

  function renderHistory() {
    const row = document.getElementById("dictRecentRow");
    const listEl = document.getElementById("dictRecentChips");
    if (!row || !listEl) return;
    if (!historyList.length) {
      row.hidden = true;
      return;
    }
    row.hidden = false;
    listEl.innerHTML = historyList
      .map(
        (term) =>
          `<button class="dict-recent-chip" type="button" data-dict-history="${escapeHtml(term)}">${escapeHtml(term)}</button>`
      )
      .join("");
  }

  function renderSuggestions() {
    const box = document.getElementById("dictSuggestions");
    if (!box) return;
    if (currentMatches.length > 0 || !filterState.query.trim()) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
    const suggestions = computeSuggestions(filterState.query);
    if (!suggestions.length) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
    box.hidden = false;
    box.innerHTML =
      `<span>Có phải bạn muốn tìm:</span>` +
      suggestions
        .map(
          (w) =>
            `<button class="dict-suggest-chip" type="button" data-dict-suggest="${escapeHtml(w)}">${escapeHtml(w)}</button>`
        )
        .join("");
  }

  function renderResultsList() {
    const listEl = document.getElementById("dictResultsList");
    const countEl = document.getElementById("dictResultsCount");
    const loadMoreWrap = document.getElementById("dictLoadMoreWrap");
    if (!listEl) return;

    const total = currentMatches.length;
    const shown = Math.min(total, filterState.limit);
    if (countEl) {
      countEl.textContent =
        total === 0
          ? "Không tìm thấy kết quả phù hợp"
          : `Hiển thị ${shown.toLocaleString("en-US")} / ${total.toLocaleString("en-US")} từ vựng`;
    }

    if (total === 0) {
      listEl.innerHTML = `
        <div class="dict-empty">
          <span class="material-symbols-outlined">search_off</span>
          <h3>Không tìm thấy từ phù hợp</h3>
          <p>${
            filterState.onlySaved
              ? "Bạn chưa lưu từ nào khớp bộ lọc hiện tại. Nhấn biểu tượng dấu trang để lưu từ vào Sổ từ."
              : "Thử tìm bằng từ tiếng Anh, nghĩa tiếng Việt không dấu hoặc bỏ bớt bộ lọc CEFR / Chủ đề."
          }</p>
        </div>`;
      if (loadMoreWrap) loadMoreWrap.hidden = true;
      return;
    }

    const slice = currentMatches.slice(0, shown);
    listEl.innerHTML = slice
      .map((item) => {
        const isActive = item.id === filterState.selectedId;
        const isSaved = savedSet.has(item.id);
        return `
          <div class="dict-item${isActive ? " active" : ""}" role="button" tabindex="0" data-dict-select="${escapeHtml(item.id)}">
            <div class="dict-item-main">
              <div class="dict-item-top">
                <span class="dict-item-word">${escapeHtml(item.w)}</span>
                ${item.ipa ? `<span class="dict-item-ipa">${escapeHtml(item.ipa)}</span>` : ""}
                ${item.pos ? `<span class="dict-item-pos">${escapeHtml(item.pos)}</span>` : ""}
              </div>
              <p class="dict-item-vi">${escapeHtml(item.vi)}</p>
            </div>
            <div class="dict-item-right">
              <span class="dict-lv dict-lv-${escapeHtml(item.lv)}">${escapeHtml(item.lv)}</span>
              <button class="dict-mini-icon-btn" type="button" data-dict-speak="${escapeHtml(item.w)}" title="Nghe phát âm">
                <span class="material-symbols-outlined">volume_up</span>
              </button>
              <button class="dict-mini-icon-btn${isSaved ? " saved" : ""}" type="button" data-dict-save="${escapeHtml(item.id)}" title="${isSaved ? "Bỏ lưu" : "Lưu vào Sổ từ"}">
                <span class="material-symbols-outlined">${isSaved ? "bookmark" : "bookmark_border"}</span>
              </button>
            </div>
          </div>`;
      })
      .join("");

    if (loadMoreWrap) {
      loadMoreWrap.hidden = shown >= total;
      const btn = document.getElementById("dictLoadMoreBtn");
      if (btn) btn.textContent = `Tải thêm (${Math.min(PAGE_SIZE, total - shown)} từ tiếp theo)`;
    }
  }

  function renderDetail() {
    const panel = document.getElementById("dictDetailPanel");
    if (!panel) return;

    const item = BY_ID.get(filterState.selectedId) || currentMatches[0] || null;
    if (!item) {
      panel.innerHTML = `
        <div class="dict-empty">
          <span class="material-symbols-outlined">menu_book</span>
          <h3>Chọn một từ để xem chi tiết</h3>
          <p>Hỗ trợ tra cứu toàn bộ ${DICT.length.toLocaleString("en-US")} từ vựng Oxford 3000 kèm phiên âm IPA, phát âm chuẩn US/UK và câu ví dụ song ngữ.</p>
        </div>`;
      return;
    }

    filterState.selectedId = item.id;
    const isSaved = savedSet.has(item.id);
    const sameWordOthers = DICT.filter((d) => d._w === item._w && d.id !== item.id);
    const related = DICT.filter((d) => d.id !== item.id && d.tp === item.tp && d.lv === item.lv).slice(0, 6);

    panel.innerHTML = `
      <div class="dict-detail-top">
        <div>
          <div class="dict-detail-badges">
            <span class="dict-lv dict-lv-${escapeHtml(item.lv)}">CEFR ${escapeHtml(item.lv)}</span>
            ${item.pos ? `<span class="dict-item-pos">${escapeHtml(item.pos)}</span>` : ""}
            <span class="dict-topic-tag">${escapeHtml(item.tp)}</span>
          </div>
          <h2 class="dict-detail-word">${escapeHtml(item.w)}</h2>
          <p class="dict-detail-ipa">${escapeHtml(item.ipa || "/—/")}</p>
        </div>
      </div>

      <div class="dict-audio-bar">
        <button class="dict-audio-btn" type="button" id="dictSpeakNormalBtn">
          <span class="material-symbols-outlined">volume_up</span>
          <span>Nghe phát âm</span>
        </button>
        <button class="dict-audio-btn slow" type="button" id="dictSpeakSlowBtn">
          <span class="material-symbols-outlined">slow_motion_video</span>
          <span>Nghe chậm 0.7×</span>
        </button>
        <div class="dict-accent-switch" role="group" aria-label="Chọn giọng đọc">
          <button class="dict-accent-btn${filterState.accent === "en-US" ? " active" : ""}" type="button" data-dict-accent="en-US">US</button>
          <button class="dict-accent-btn${filterState.accent === "en-GB" ? " active" : ""}" type="button" data-dict-accent="en-GB">UK</button>
        </div>
      </div>

      <div class="dict-meaning-box">
        <p class="dict-section-label">Nghĩa tiếng Việt</p>
        <p class="dict-meaning-text">${escapeHtml(item.vi)}</p>
      </div>

      ${
        item.en
          ? `<div class="dict-example-box">
              <div class="dict-example-head">
                <p class="dict-section-label" style="margin:0;">Câu ví dụ ngữ cảnh</p>
                <button class="dict-mini-icon-btn" type="button" id="dictSpeakExampleBtn" title="Nghe câu ví dụ">
                  <span class="material-symbols-outlined">volume_up</span>
                </button>
              </div>
              <p class="dict-example-en">${highlightWordInExample(item.en, item.w)}</p>
              ${item.ev ? `<p class="dict-example-vi">${escapeHtml(item.ev)}</p>` : ""}
            </div>`
          : ""
      }

      <div class="dict-detail-actions">
        <button class="dict-save-btn${isSaved ? " saved" : ""}" type="button" id="dictDetailSaveBtn">
          <span class="material-symbols-outlined">${isSaved ? "bookmark" : "bookmark_add"}</span>
          <span>${isSaved ? "Đã lưu vào Sổ từ" : "Lưu vào Sổ từ"}</span>
        </button>
        <button class="dict-pill-btn" type="button" id="dictCopyBtn">
          <span class="material-symbols-outlined">content_copy</span>
          <span>Sao chép từ &amp; nghĩa</span>
        </button>
      </div>

      ${
        sameWordOthers.length
          ? `<div class="dict-related-block">
              <p class="dict-section-label">Loại từ khác của "${escapeHtml(item.w)}"</p>
              <div class="dict-related-chips">
                ${sameWordOthers
                  .map(
                    (o) =>
                      `<button class="dict-related-chip" type="button" data-dict-jump="${escapeHtml(o.id)}">${escapeHtml(o.w)} <small>(${escapeHtml(o.pos)} · ${escapeHtml(o.lv)})</small></button>`
                  )
                  .join("")}
              </div>
            </div>`
          : ""
      }

      ${
        related.length
          ? `<div class="dict-related-block">
              <p class="dict-section-label">Từ cùng chủ đề (${escapeHtml(item.tp)} · ${escapeHtml(item.lv)})</p>
              <div class="dict-related-chips">
                ${related
                  .map(
                    (r) =>
                      `<button class="dict-related-chip" type="button" data-dict-jump="${escapeHtml(r.id)}">${escapeHtml(r.w)} <small>· ${escapeHtml(r.vi)}</small></button>`
                  )
                  .join("")}
              </div>
            </div>`
          : ""
      }
    `;

    // Bind detail actions
    const speakNormal = document.getElementById("dictSpeakNormalBtn");
    const speakSlow = document.getElementById("dictSpeakSlowBtn");
    const speakEx = document.getElementById("dictSpeakExampleBtn");
    const saveBtn = document.getElementById("dictDetailSaveBtn");
    const copyBtn = document.getElementById("dictCopyBtn");

    if (speakNormal) speakNormal.addEventListener("click", () => speakText(item.w, 1.0));
    if (speakSlow) speakSlow.addEventListener("click", () => speakText(item.w, 0.7));
    if (speakEx) speakEx.addEventListener("click", () => speakText(item.en, 0.95));
    if (saveBtn) saveBtn.addEventListener("click", () => toggleSaved(item.id));
    if (copyBtn) {
      copyBtn.addEventListener("click", async () => {
        const text = `${item.w} ${item.ipa} (${item.pos}, ${item.lv}): ${item.vi}${item.en ? `\nVD: ${item.en} (${item.ev})` : ""}`;
        try {
          await navigator.clipboard.writeText(text);
          showToast(`Đã sao chép "${item.w}" vào bộ nhớ tạm.`);
        } catch {
          showToast("Không thể sao chép tự động trên trình duyệt này.");
        }
      });
    }

    panel.querySelectorAll("[data-dict-accent]").forEach((btn) => {
      btn.addEventListener("click", () => {
        filterState.accent = btn.dataset.dictAccent;
        renderDetail();
        speakText(item.w, 1.0);
      });
    });

    panel.querySelectorAll("[data-dict-jump]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.dataset.dictJump;
        if (!BY_ID.has(targetId)) return;
        filterState.selectedId = targetId;
        renderResultsList();
        renderDetail();
      });
    });
  }

  function runSearch(resetLimit = true) {
    if (resetLimit) filterState.limit = PAGE_SIZE;
    currentMatches = computeMatches();
    if (currentMatches.length > 0 && !currentMatches.some((m) => m.id === filterState.selectedId)) {
      filterState.selectedId = currentMatches[0].id;
    } else if (currentMatches.length === 0) {
      filterState.selectedId = null;
    }
    renderSuggestions();
    renderResultsList();
    renderDetail();
  }

  function setQueryAndSearch(q, saveToHistory = true) {
    filterState.query = q;
    const input = document.getElementById("dictSearchInput");
    const clearBtn = document.getElementById("dictClearBtn");
    if (input) input.value = q;
    if (clearBtn) clearBtn.hidden = !q.trim();
    if (saveToHistory && q.trim()) addHistory(q.trim());
    runSearch(true);
  }

  function populateTopics() {
    const topicSelect = document.getElementById("dictTopicSelect");
    if (!topicSelect) return;
    const topics = Array.from(new Set(DICT.map((d) => d.tp))).sort();
    topics.forEach((tp) => {
      const opt = document.createElement("option");
      opt.value = tp;
      opt.textContent = tp;
      topicSelect.appendChild(opt);
    });
  }

  function bindEvents() {
    const searchInput = document.getElementById("dictSearchInput");
    const clearBtn = document.getElementById("dictClearBtn");
    const posSelect = document.getElementById("dictPosSelect");
    const topicSelect = document.getElementById("dictTopicSelect");
    const savedToggleBtn = document.getElementById("dictSavedToggleBtn");
    const randomBtn = document.getElementById("dictRandomBtn");
    const loadMoreBtn = document.getElementById("dictLoadMoreBtn");
    const clearHistoryBtn = document.getElementById("dictClearHistoryBtn");
    const resultsList = document.getElementById("dictResultsList");
    const recentChips = document.getElementById("dictRecentChips");
    const suggestionsBox = document.getElementById("dictSuggestions");
    const globalSearch = document.getElementById("globalSearchInput");

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        const val = searchInput.value;
        if (clearBtn) clearBtn.hidden = !val.trim();
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          filterState.query = val;
          runSearch(true);
        }, 100);
      });
      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          clearTimeout(searchTimer);
          setQueryAndSearch(searchInput.value, true);
        }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        setQueryAndSearch("", false);
        if (searchInput) searchInput.focus();
      });
    }

    document.querySelectorAll("[data-dict-level]").forEach((btn) => {
      btn.addEventListener("click", () => {
        filterState.level = btn.dataset.dictLevel;
        document.querySelectorAll("[data-dict-level]").forEach((b) =>
          b.classList.toggle("active", b === btn)
        );
        runSearch(true);
      });
    });

    if (posSelect) {
      posSelect.addEventListener("change", () => {
        filterState.pos = posSelect.value;
        runSearch(true);
      });
    }

    if (topicSelect) {
      topicSelect.addEventListener("change", () => {
        filterState.topic = topicSelect.value;
        runSearch(true);
      });
    }

    if (savedToggleBtn) {
      savedToggleBtn.addEventListener("click", () => {
        filterState.onlySaved = !filterState.onlySaved;
        savedToggleBtn.classList.toggle("active", filterState.onlySaved);
        runSearch(true);
      });
    }

    if (randomBtn) {
      randomBtn.addEventListener("click", () => {
        if (!DICT.length) return;
        const pool = currentMatches.length ? currentMatches : DICT;
        const pick = pool[Math.floor(Math.random() * pool.length)];
        filterState.onlySaved = false;
        if (savedToggleBtn) savedToggleBtn.classList.remove("active");
        filterState.selectedId = pick.id;
        setQueryAndSearch(pick.w, false);
        showToast(`Khám phá từ ngẫu nhiên: "${pick.w}" (${pick.lv})`);
      });
    }

    if (loadMoreBtn) {
      loadMoreBtn.addEventListener("click", () => {
        filterState.limit += PAGE_SIZE;
        renderResultsList();
      });
    }

    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener("click", () => {
        historyList = [];
        saveJson(HISTORY_KEY, historyList);
        renderHistory();
      });
    }

    // Delegated click for results list
    if (resultsList) {
      resultsList.addEventListener("click", (e) => {
        const speakBtn = e.target.closest("[data-dict-speak]");
        if (speakBtn) {
          e.stopPropagation();
          speakText(speakBtn.dataset.dictSpeak, 1.0);
          return;
        }
        const saveBtn = e.target.closest("[data-dict-save]");
        if (saveBtn) {
          e.stopPropagation();
          toggleSaved(saveBtn.dataset.dictSave);
          return;
        }
        const row = e.target.closest("[data-dict-select]");
        if (row) {
          filterState.selectedId = row.dataset.dictSelect;
          const item = BY_ID.get(filterState.selectedId);
          if (item && filterState.query.trim()) addHistory(item.w);
          renderResultsList();
          renderDetail();
        }
      });
      resultsList.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          const row = e.target.closest("[data-dict-select]");
          if (row && e.target === row) {
            e.preventDefault();
            filterState.selectedId = row.dataset.dictSelect;
            renderResultsList();
            renderDetail();
          }
        }
      });
    }

    if (recentChips) {
      recentChips.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-dict-history]");
        if (btn) setQueryAndSearch(btn.dataset.dictHistory, false);
      });
    }

    if (suggestionsBox) {
      suggestionsBox.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-dict-suggest]");
        if (btn) setQueryAndSearch(btn.dataset.dictSuggest, true);
      });
    }

    // Wire topbar global quick search -> switches to Dictionary view and searches!
    if (globalSearch) {
      globalSearch.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const q = globalSearch.value.trim();
          if (typeof window.switchTab === "function") window.switchTab("dictionary");
          setQueryAndSearch(q, true);
          if (searchInput) searchInput.focus();
        }
      });
    }

    // Ctrl+K / Cmd+K quick search shortcut
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (typeof window.switchTab === "function") window.switchTab("dictionary");
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }
    });
  }

  // Expose helper so external triggers can jump to a word
  window.openDictionarySearch = function (word) {
    if (typeof window.switchTab === "function") window.switchTab("dictionary");
    setQueryAndSearch(word || "", Boolean(word));
  };

  document.addEventListener("DOMContentLoaded", () => {
    const totalEl = document.getElementById("dictTotalCount");
    if (totalEl) totalEl.textContent = DICT.length.toLocaleString("en-US");
    populateTopics();
    updateSavedCounter();
    renderHistory();
    bindEvents();
    runSearch(true);
  });
})();
