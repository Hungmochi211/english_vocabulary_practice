(() => {
  "use strict";

  const STORAGE_KEY = "lexitag-learning-history-v1";
  const LEGACY_REVIEW_KEY = "lexitag-review-history-v1";
  const PAGE_SIZE = 10;

  const TYPE_META = {
    study: { label: "Học bài mới", icon: "menu_book" },
    pronunciation: { label: "Phát âm AI", icon: "mic" },
    srs: { label: "Ôn thẻ SRS", icon: "style" },
    quiz: { label: "Trắc nghiệm", icon: "quiz" },
    typing: { label: "Gõ từ", icon: "keyboard" },
    dictation: { label: "Nghe chép", icon: "hearing" }
  };

  const DEFAULT_ENTRIES = [
    {
      id: "h-seed-1",
      type: "study",
      title: "Where Do You Live? · Lesson 2",
      correct: 17,
      total: 18,
      accuracy: 94,
      xp: 120,
      duration: "04:15",
      dateLabel: "Hôm nay",
      timeLabel: "19:30",
      words: [
        { w: "peaceful", ipa: "/ˈpiːs.fəl/", vi: "Yên bình, thanh bình", ok: true },
        { w: "neighborhood", ipa: "/ˈneɪ.bə.hʊd/", vi: "Khu dân cư, vùng lân cận", ok: true },
        { w: "convenient", ipa: "/kənˈviː.ni.ənt/", vi: "Thuận tiện, tiện lợi", ok: true },
        { w: "commute", ipa: "/kəˈmjuːt/", vi: "Đi lại hằng ngày (đi làm/học)", ok: false }
      ]
    },
    {
      id: "h-seed-2",
      type: "srs",
      title: "Ôn tập ngắt quãng SM-2 (Hộp 2–3)",
      correct: 13,
      total: 15,
      accuracy: 87,
      xp: 150,
      duration: "03:40",
      dateLabel: "Hôm qua",
      timeLabel: "20:15",
      words: [
        { w: "environment", ipa: "/ɪnˈvaɪ.rən.mənt/", vi: "Môi trường", ok: true },
        { w: "opportunity", ipa: "/ˌɒp.əˈtjuː.nə.ti/", vi: "Cơ hội", ok: true },
        { w: "necessary", ipa: "/ˈnes.ə.sər.i/", vi: "Cần thiết", ok: false }
      ]
    },
    {
      id: "h-seed-3",
      type: "study",
      title: "Daily Routines · Lesson 1",
      correct: 15,
      total: 16,
      accuracy: 94,
      xp: 110,
      duration: "05:02",
      dateLabel: "2 ngày trước",
      timeLabel: "21:00",
      words: [
        { w: "schedule", ipa: "/ˈʃed.juːl/", vi: "Lịch trình, thời gian biểu", ok: true },
        { w: "improve", ipa: "/ɪmˈpruːv/", vi: "Cải thiện, nâng cao", ok: true },
        { w: "achieve", ipa: "/əˈtʃiːv/", vi: "Đạt được, hoàn thành", ok: true }
      ]
    }
  ];

  let entries = loadEntries();
  let filterType = "ALL";
  let filterStatus = "ALL";
  let searchQuery = "";
  const expandedIds = new Set();

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveEntries() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // ignore quota error
    }
  }

  function loadEntries() {
    const stored = loadJson(STORAGE_KEY, null);
    if (Array.isArray(stored)) return stored;

    // Migrate any sessions previously saved by review.js before unified History page existed
    const legacy = loadJson(LEGACY_REVIEW_KEY, []);
    const migrated = Array.isArray(legacy)
      ? legacy.map((h, idx) => ({
          id: `h-mig-${idx}-${Date.now()}`,
          type: TYPE_META[h.mode] ? h.mode : "srs",
          title: h.modeLabel || "Phiên ôn tập",
          correct: Number(h.correct) || 0,
          total: Number(h.total) || 1,
          accuracy: Number(h.accuracy) || 0,
          xp: Number(h.xp) || 0,
          duration: h.duration || "00:30",
          dateLabel: "Hôm nay",
          timeLabel: h.at || "",
          words: Array.isArray(h.words) ? h.words : []
        }))
      : [];

    const initial = [...migrated, ...DEFAULT_ENTRIES.map((e) => ({ ...e, words: e.words.map((w) => ({ ...w })) }))];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    } catch {
      // ignore
    }
    return initial;
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function speakWord(word) {
    if (!word || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(word);
      u.lang = "en-US";
      window.speechSynthesis.speak(u);
    } catch {
      // ignore
    }
  }

  function getFilteredEntries() {
    const q = searchQuery.trim().toLowerCase();
    return entries.filter((item) => {
      if (filterType !== "ALL" && item.type !== filterType) return false;
      if (filterStatus === "PASS" && item.accuracy < 80) return false;
      if (filterStatus === "RETRY" && item.accuracy >= 80) return false;
      if (q) {
        const inTitle = String(item.title || "").toLowerCase().includes(q);
        const inWords = (item.words || []).some(
          (w) =>
            String(w.w || "").toLowerCase().includes(q) ||
            String(w.vi || "").toLowerCase().includes(q)
        );
        if (!inTitle && !inWords) return false;
      }
      return true;
    });
  }

  function renderKpis() {
    const totalSessions = entries.length;
    const avgAcc = totalSessions
      ? Math.round(entries.reduce((s, e) => s + (Number(e.accuracy) || 0), 0) / totalSessions)
      : 0;
    const totalXp = entries.reduce((s, e) => s + (Number(e.xp) || 0), 0);
    const passCount = entries.filter((e) => (Number(e.accuracy) || 0) >= 80).length;

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    set("hsKpiSessions", String(totalSessions));
    set("hsKpiAccuracy", `${avgAcc}%`);
    set("hsKpiXp", `+${totalXp.toLocaleString("en-US")} XP`);
    set("hsKpiPassed", `${passCount} / ${totalSessions}`);
  }

  function renderList() {
    renderKpis();
    const listEl = document.getElementById("hsSessionList");
    const countEl = document.getElementById("hsResultCount");
    if (!listEl) return;

    const filtered = getFilteredEntries();

    if (countEl) {
      if (filtered.length === 0) {
        countEl.textContent = "Không có phiên học / ôn tập nào khớp bộ lọc";
      } else if (filtered.length > PAGE_SIZE) {
        countEl.textContent = `Tổng ${filtered.length} phiên (hiển thị ${PAGE_SIZE} phiên mới nhất · cuộn xuống để xem thêm)`;
      } else {
        countEl.textContent = `Tổng ${filtered.length} phiên đã ghi nhận`;
      }
    }

    if (!filtered.length) {
      listEl.innerHTML = `
        <div class="hs-empty">
          <span class="material-symbols-outlined">history_toggle_off</span>
          <h3>Chưa có dữ liệu lịch sử phù hợp</h3>
          <p>Hãy hoàn thành một bài học hoặc phiên ôn tập — kết quả sẽ tự động cập nhật tại đây ngay lập tức.</p>
        </div>`;
      return;
    }

    listEl.innerHTML = filtered
      .map((item) => {
        const meta = TYPE_META[item.type] || TYPE_META.srs;
        const isOpen = expandedIds.has(item.id);
        const passed = (Number(item.accuracy) || 0) >= 80;
        const words = Array.isArray(item.words) ? item.words : [];
        const missedWords = words.filter((w) => w.ok === false);

        return `
          <article class="hs-session${isOpen ? " open" : ""}" data-hs-session="${escapeHtml(item.id)}">
            <div class="hs-session-row" role="button" tabindex="0" data-hs-toggle="${escapeHtml(item.id)}">
              <div class="hs-session-left">
                <span class="hs-type-icon ${escapeHtml(item.type)}">
                  <span class="material-symbols-outlined">${meta.icon}</span>
                </span>
                <div class="hs-session-copy">
                  <div class="hs-session-title-row">
                    <strong>${escapeHtml(item.title)}</strong>
                    <span class="hs-kind-badge">${meta.label}</span>
                  </div>
                  <div class="hs-session-meta">
                    ${item.correct}/${item.total} từ đạt · Thời gian ${escapeHtml(item.duration || "—")} · ${escapeHtml(item.dateLabel || "Hôm nay")}${item.timeLabel ? ` lúc ${escapeHtml(item.timeLabel)}` : ""}
                  </div>
                </div>
              </div>
              <div class="hs-session-right">
                <span class="hs-badge-score ${passed ? "pass" : "retry"}">${item.accuracy}% · +${item.xp} XP</span>
                <span class="material-symbols-outlined hs-expand-icon">expand_more</span>
              </div>
            </div>

            ${
              isOpen
                ? `<div class="hs-drawer">
                    ${
                      words.length
                        ? `<div class="hs-words-grid">
                            ${words
                              .map(
                                (w) => `
                                <div class="hs-word-chip ${w.ok === false ? "miss" : "ok"}">
                                  <div class="hs-word-text">
                                    <strong>${escapeHtml(w.w)}</strong>
                                    ${w.ipa ? `<small>${escapeHtml(w.ipa)}</small>` : ""}
                                    <span>${escapeHtml(w.vi || "")}</span>
                                  </div>
                                  <div style="display:flex; align-items:center; gap:6px;">
                                    <span class="hs-word-status ${w.ok === false ? "miss" : "ok"}">${w.ok === false ? "Cần ôn" : "Đã nhớ"}</span>
                                    <button class="dict-mini-icon-btn" type="button" data-hs-speak="${escapeHtml(w.w)}" title="Nghe phát âm">
                                      <span class="material-symbols-outlined">volume_up</span>
                                    </button>
                                  </div>
                                </div>`
                              )
                              .join("")}
                          </div>`
                        : `<p style="margin:0 0 12px; color:var(--text-muted); font-size:12.5px;">Phiên này được lưu trước khi có chi tiết danh sách từng từ.</p>`
                    }
                    <div class="hs-drawer-actions">
                      <span style="font-size:12px; color:var(--text-muted);">
                        ${words.length ? `Gồm ${words.length} từ (${missedWords.length} từ cần ôn lại)` : "Nhấn nút bên cạnh để luyện tập lại chế độ này"}
                      </span>
                      <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        ${
                          missedWords.length
                            ? `<button class="rv-btn-outline" type="button" data-hs-retry-missed="${escapeHtml(item.id)}">
                                <span class="material-symbols-outlined">replay</span>
                                <span>Ôn ${missedWords.length} từ sai</span>
                              </button>`
                            : ""
                        }
                        <button class="rv-btn-primary" type="button" data-hs-retry="${escapeHtml(item.id)}">
                          <span class="material-symbols-outlined">play_arrow</span>
                          <span>Ôn lại phiên này</span>
                        </button>
                      </div>
                    </div>
                  </div>`
                : ""
            }
          </article>`;
      })
      .join("");
  }

  function resolveWordsForRetry(sessionWords) {
    const dict = Array.isArray(window.OXFORD_DICTIONARY) ? window.OXFORD_DICTIONARY : [];
    const results = [];
    for (const sw of sessionWords) {
      const clean = String(sw.w || "").trim().toLowerCase();
      if (!clean) continue;
      const found = dict.find((d) => d.w.toLowerCase() === clean);
      if (found) {
        results.push(found);
      } else {
        results.push({
          id: `custom_${clean}`,
          w: sw.w,
          lv: "A2",
          pos: "",
          ipa: sw.ipa || "",
          vi: sw.vi || "",
          en: "",
          ev: "",
          tp: "Bài học đã học"
        });
      }
    }
    return results;
  }

  function launchRetry(entry, onlyMissed) {
    const targetMode = ["srs", "quiz", "typing", "dictation"].includes(entry.type) ? entry.type : "srs";
    const sourceWords = onlyMissed
      ? (entry.words || []).filter((w) => w.ok === false)
      : entry.words || [];
    const resolved = resolveWordsForRetry(sourceWords);

    if (resolved.length && typeof window.openReviewWithWords === "function") {
      window.openReviewWithWords(resolved, targetMode);
    } else if (typeof window.openReviewMode === "function") {
      window.openReviewMode(targetMode);
    } else if (typeof window.switchTab === "function") {
      window.switchTab("review");
    }
  }

  function bindEvents() {
    const searchInput = document.getElementById("hsSearchInput");
    const statusSel = document.getElementById("hsStatusSelect");
    const listEl = document.getElementById("hsSessionList");
    const clearBtn = document.getElementById("hsClearBtn");

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        searchQuery = searchInput.value;
        renderList();
      });
    }

    document.querySelectorAll("[data-hs-type]").forEach((btn) => {
      btn.addEventListener("click", () => {
        filterType = btn.dataset.hsType;
        document.querySelectorAll("[data-hs-type]").forEach((b) =>
          b.classList.toggle("active", b === btn)
        );
        renderList();
      });
    });

    if (statusSel) {
      statusSel.addEventListener("change", () => {
        filterStatus = statusSel.value;
        renderList();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        if (!entries.length) return;
        if (!window.confirm("Bạn có chắc muốn xóa toàn bộ lịch sử học & ôn tập đã lưu trên trình duyệt?")) return;
        entries = [];
        expandedIds.clear();
        saveEntries();
        renderList();
      });
    }

    if (listEl) {
      listEl.addEventListener("click", (e) => {
        const speakBtn = e.target.closest("[data-hs-speak]");
        if (speakBtn) {
          e.stopPropagation();
          speakWord(speakBtn.dataset.hsSpeak);
          return;
        }
        const retryMissedBtn = e.target.closest("[data-hs-retry-missed]");
        if (retryMissedBtn) {
          e.stopPropagation();
          const item = entries.find((x) => x.id === retryMissedBtn.dataset.hsRetryMissed);
          if (item) launchRetry(item, true);
          return;
        }
        const retryBtn = e.target.closest("[data-hs-retry]");
        if (retryBtn) {
          e.stopPropagation();
          const item = entries.find((x) => x.id === retryBtn.dataset.hsRetry);
          if (item) launchRetry(item, false);
          return;
        }
        const toggleRow = e.target.closest("[data-hs-toggle]");
        if (toggleRow) {
          const id = toggleRow.dataset.hsToggle;
          if (expandedIds.has(id)) expandedIds.delete(id);
          else expandedIds.add(id);
          renderList();
        }
      });
    }

    window.addEventListener("hashchange", () => {
      if (window.location.hash === "#history") renderList();
    });
  }

  // Public API called automatically whenever Study, Pronunciation, or Review completes!
  window.LexiTagHistory = {
    record(entry) {
      const nowTime = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
      const normalized = {
        id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: TYPE_META[entry.type] ? entry.type : "srs",
        title: entry.title || "Phiên học tập",
        correct: Number(entry.correct) || 0,
        total: Math.max(1, Number(entry.total) || 1),
        accuracy: Math.min(100, Math.max(0, Math.round(Number(entry.accuracy) || 0))),
        xp: Number(entry.xp) || 0,
        duration: entry.duration || "00:30",
        dateLabel: "Hôm nay",
        timeLabel: entry.timeLabel || nowTime,
        words: Array.isArray(entry.words) ? entry.words : []
      };
      entries = [normalized, ...entries].slice(0, 100);
      saveEntries();
      renderList();
      return normalized;
    },

    // Live-updates an active Study / Pronunciation session entry when the user studies words one by one
    upsertStudyWord({ sessionKey, type = "study", title, word, ipa = "", vi = "", xpDelta = 10, score = 100 }) {
      if (!word) return;
      const nowTime = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
      let existing = entries.find((e) => e.sessionKey === sessionKey);
      if (!existing) {
        existing = {
          id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          sessionKey,
          type,
          title,
          correct: 0,
          total: 0,
          accuracy: 100,
          xp: 0,
          duration: "Đang học",
          dateLabel: "Hôm nay",
          timeLabel: nowTime,
          words: []
        };
        entries = [existing, ...entries].slice(0, 100);
      }

      if (!existing.words.some((w) => w.w.toLowerCase() === word.toLowerCase())) {
        existing.words.push({ w: word, ipa, vi, ok: score >= 80 });
        existing.total = existing.words.length;
        existing.correct = existing.words.filter((w) => w.ok).length;
        existing.accuracy = Math.round((existing.correct / Math.max(1, existing.total)) * 100);
        existing.xp += Number(xpDelta) || 0;
        existing.timeLabel = nowTime;
        // Move updated session to top
        entries = [existing, ...entries.filter((e) => e.id !== existing.id)];
        saveEntries();
        renderList();
      }
    },

    refresh() {
      renderList();
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    renderList();
  });
})();
