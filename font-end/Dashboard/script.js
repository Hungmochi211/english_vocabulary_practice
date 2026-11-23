(() => {
  "use strict";

  const STORAGE_KEY = "lexitag-dashboard-profile-v1";

  const LEVEL_LABELS = {
    A1: "Beginner",
    A2: "Elementary",
    B1: "Intermediate",
    B2: "Upper-Intermediate",
    C1: "Advanced",
    C2: "Proficient"
  };

  const DEFAULT_SESSIONS = [
    { id: "s1", device: "Chrome · Windows 11", location: "Hà Nội · Đang hoạt động", current: true },
    { id: "s2", device: "Safari · iPhone 15", location: "Hà Nội · 2 giờ trước", current: false },
    { id: "s3", device: "Edge · Laptop cá nhân", location: "Hà Nội · Hôm qua", current: false }
  ];

  const DEFAULT_DATA = {
    user: {
      fullName: "Nguyễn An",
      email: "nguyenan.k68@vnua.edu.vn",
      phone: "0912 345 678",
      dob: "2004-08-15",
      targetLevel: "B2",
      dailyTarget: 25,
      reminderTime: "20:00",
      strictUnlock: true,
      emailReminder: true,
      streakWarning: true,
      oauthGoogle: true,
      avatar: ""
    },
    stats: {
      streakDays: 7,
      longestStreak: 14,
      streakGoal: 14,
      dailyCurrent: 18,
      learnedWords: 428,
      learnedThisWeek: 16,
      pronunciationAvg: 91.5,
      pronunciationDelta: "+2.4%",
      totalXp: 2450,
      rankLabel: "Hạng Bạc • Rank #3 nhóm",
      cefr: [
        { level: "A1", name: "Cơ bản", learned: 210, total: 960 },
        { level: "A2", name: "Sơ cấp", learned: 124, total: 970 },
        { level: "B1", name: "Trung cấp", learned: 68, total: 980 },
        { level: "B2", name: "Trên trung cấp", learned: 26, total: 903 }
      ],
      leitner: [
        { box: 1, label: "Hộp 1", count: 36, mastered: false },
        { box: 2, label: "Hộp 2", count: 64, mastered: false },
        { box: 3, label: "Hộp 3", count: 98, mastered: false },
        { box: 4, label: "Hộp 4", count: 112, mastered: false },
        { box: 5, label: "Hộp 5", count: 118, mastered: true }
      ],
      heatmap28: [
        1, 2, 0, 1, 3, 2, 2,
        0, 1, 2, 3, 2, 1, 0,
        2, 2, 1, 3, 2, 1, 0,
        2, 3, 2, 1, 3, 2, 3
      ],
      badges: [
        { emoji: "🔥", title: "Chuỗi 7 ngày", desc: "Học liên tiếp 7 ngày không nghỉ", earned: true },
        { emoji: "📚", title: "Chạm mốc 400 từ", desc: "Thuộc trên 400 từ Oxford 3000", earned: true },
        { emoji: "🎙️", title: "Phát âm chuẩn > 90%", desc: "Đạt trung bình 91.5% chấm điểm AI", earned: true },
        { emoji: "🏆", title: "Chiến binh 14 ngày", desc: "Hoàn thành chuỗi học 14 ngày liên tục", earned: false }
      ],
      weekly: {
        words: "84 từ",
        wordsDiff: "+24% vs 68 từ",
        time: "4g 20p",
        timeDiff: "Tuần trước: 3g 45p",
        accuracy: "91.5%",
        accuracyDiff: "+2.4% vs 89.1%"
      },
      recentLessons: [
        { title: "Where Do You Live? · Lesson 2", meta: "18 từ · 94% chính xác · Hôm nay", score: "+120 XP" },
        { title: "Ôn tập ngắt quãng SM-2 (Hộp 2–3)", meta: "15 thẻ · 89% chính xác · Hôm qua", score: "+85 XP" },
        { title: "Daily Routines · Lesson 1", meta: "16 từ · 92% chính xác · 2 ngày trước", score: "+110 XP" }
      ]
    },
    sessions: DEFAULT_SESSIONS.map((s) => ({ ...s })),
    loggedOut: false
  };

  let state = loadState();
  let toastTimer = 0;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(DEFAULT_DATA);
      const parsed = JSON.parse(raw);
      return {
        user: { ...DEFAULT_DATA.user, ...(parsed.user || {}) },
        stats: { ...DEFAULT_DATA.stats, ...(parsed.stats || {}) },
        sessions: Array.isArray(parsed.sessions) && parsed.sessions.length
          ? parsed.sessions
          : DEFAULT_SESSIONS.map((s) => ({ ...s })),
        loggedOut: Boolean(parsed.loggedOut)
      };
    } catch {
      return structuredClone(DEFAULT_DATA);
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  }

  function getInitials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "NA";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function calcAge(dobStr) {
    if (!dobStr) return "";
    const d = new Date(dobStr);
    if (Number.isNaN(d.getTime())) return "";
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return age > 0 && age < 120 ? `(${age} tuổi)` : "";
  }

  function showToast(message) {
    const el = document.getElementById("profileToast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
  }

  function setAllText(selector, text) {
    document.querySelectorAll(selector).forEach((el) => {
      el.textContent = text;
    });
  }

  function renderProfile() {
    const { user, stats, sessions, loggedOut } = state;
    const initials = getInitials(user.fullName);
    const levelLabel = LEVEL_LABELS[user.targetLevel] || "Upper-Intermediate";

    // Update profile nodes + sidebar/topbar identity (does NOT alter #viewDashboard)
    setAllText("[data-pf-name]", user.fullName);
    setAllText("[data-pf-email]", user.email);
    setAllText("[data-pf-level-code]", user.targetLevel);
    setAllText("[data-pf-level-label]", levelLabel);

    const sidebarName = document.getElementById("sidebarUserName");
    const sidebarLevelTag = document.getElementById("sidebarLevelTag");
    const sidebarLevelText = document.getElementById("sidebarLevelText");
    if (sidebarName) sidebarName.textContent = user.fullName;
    if (sidebarLevelTag) sidebarLevelTag.textContent = user.targetLevel;
    if (sidebarLevelText) sidebarLevelText.textContent = levelLabel;

    // Avatars across profile preview, sidebar, topbar
    document.querySelectorAll("[data-pf-avatar-img]").forEach((img) => {
      if (user.avatar) {
        img.src = user.avatar;
        img.hidden = false;
      } else {
        img.removeAttribute("src");
        img.hidden = true;
      }
    });
    document.querySelectorAll("[data-pf-avatar-fallback]").forEach((span) => {
      span.textContent = initials;
      span.hidden = Boolean(user.avatar);
    });

    const removeBtn = document.getElementById("pfRemoveAvatarBtn");
    if (removeBtn) removeBtn.hidden = !user.avatar;

    // OAuth Google badge
    const oauthBtn = document.getElementById("pfOauthToggleBtn");
    const oauthText = document.getElementById("pfOauthStatusText");
    if (oauthBtn && oauthText) {
      oauthBtn.classList.toggle("unlinked", !user.oauthGoogle);
      oauthText.textContent = user.oauthGoogle ? "Đã liên kết Gmail" : "Chưa liên kết Gmail";
    }

    // Form inputs
    const bindVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    };
    const bindChk = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.checked = Boolean(val);
    };
    bindVal("pfNameInput", user.fullName);
    bindVal("pfEmailInput", user.email);
    bindVal("pfPhoneInput", user.phone);
    bindVal("pfDobInput", user.dob);
    bindVal("pfLevelSelect", user.targetLevel);
    bindVal("pfDailyTargetInput", user.dailyTarget);
    bindVal("pfReminderTimeInput", user.reminderTime);
    bindChk("pfStrictUnlockToggle", user.strictUnlock);
    bindChk("pfEmailReminderToggle", user.emailReminder);
    bindChk("pfStreakWarningToggle", user.streakWarning);

    const timeEl = document.getElementById("pfReminderTimeInput");
    if (timeEl) timeEl.disabled = !user.emailReminder;

    const ageEl = document.getElementById("pfCalculatedAge");
    if (ageEl) ageEl.textContent = calcAge(user.dob);

    // Daily goal calculation
    const target = Math.max(5, Math.min(50, Number(user.dailyTarget) || 25));
    const current = Number(stats.dailyCurrent) || 0;
    const pct = Math.min(100, Math.round((current / target) * 100));
    const rem = Math.max(0, target - current);

    setAllText("[data-pf-daily-current]", String(current));
    setAllText("[data-pf-daily-target]", `/ ${target} từ`);
    setAllText("[data-pf-daily-pct]", `${pct}%`);
    setAllText(
      "[data-pf-daily-remaining]",
      rem > 0 ? `Còn ${rem} từ nữa để hoàn thành mục tiêu hôm nay` : "Bạn đã hoàn thành mục tiêu hôm nay! 🎉"
    );
    document.querySelectorAll("[data-pf-daily-bar]").forEach((bar) => {
      bar.style.width = `${pct}%`;
    });

    // Stats inside Profile
    setAllText("[data-pf-streak-num]", String(stats.streakDays));
    setAllText("[data-pf-streak-short]", `${stats.streakDays} ngày`);
    setAllText("[data-pf-streak-long]", `${stats.streakDays} ngày liên tiếp`);
    setAllText("[data-pf-longest-streak]", `${stats.longestStreak} ngày`);
    const streakPct = Math.min(100, Math.round((stats.streakDays / (stats.streakGoal || 14)) * 100));
    document.querySelectorAll("[data-pf-streak-bar]").forEach((bar) => {
      bar.style.width = `${streakPct}%`;
    });

    setAllText("[data-pf-learned-words]", String(stats.learnedWords));
    setAllText("[data-pf-learned-week]", `+${stats.learnedThisWeek} từ tuần này`);
    setAllText("[data-pf-pronunciation]", `${stats.pronunciationAvg}%`);
    setAllText("[data-pf-pronunciation-delta]", `${stats.pronunciationDelta} so tuần trước`);
    const xpFormatted = stats.totalXp.toLocaleString("en-US");
    setAllText("[data-pf-xp-num]", xpFormatted);
    setAllText("[data-xp-num]", xpFormatted);
    setAllText("[data-xp-pill]", `${xpFormatted} XP`);
    setAllText("[data-pf-rank]", stats.rankLabel);

    // CEFR Breakdown
    const cefrList = document.getElementById("pfCefrList");
    if (cefrList) {
      cefrList.innerHTML = stats.cefr
        .map((c) => {
          const p = Math.min(100, Math.round((c.learned / c.total) * 100));
          return `
            <div>
              <div class="pf-cefr-top">
                <span class="pf-cefr-tag"><b>${c.level}</b> ${c.name}</span>
                <span class="pf-muted-meta">${c.learned} / ${c.total} từ (${p}%)</span>
              </div>
              <div class="pf-track mini"><div class="pf-fill blue" style="width:${p}%"></div></div>
            </div>`;
        })
        .join("");
    }

    // Leitner 5 boxes
    const leitnerGrid = document.getElementById("pfLeitnerGrid");
    if (leitnerGrid) {
      leitnerGrid.innerHTML = stats.leitner
        .map(
          (b) => `
          <div class="pf-leitner-box${b.mastered ? " mastered" : ""}">
            <strong>${b.count}</strong>
            <span>${b.label}</span>
          </div>`
        )
        .join("");
    }

    // 28-day Streak Heatmap
    const heatmap = document.getElementById("pfStreakHeatmap");
    if (heatmap) {
      const levels = ["Nghỉ", "Học nhẹ (5–10 từ)", "Đạt khá (11–20 từ)", "Hoàn thành mục tiêu"];
      heatmap.innerHTML = stats.heatmap28
        .map((lvl, idx) => {
          const daysAgo = stats.heatmap28.length - 1 - idx;
          const label = daysAgo === 0 ? "Hôm nay" : `${daysAgo} ngày trước`;
          return `<div class="pf-hm-cell pf-hm-${lvl}" title="${label}: ${levels[lvl] || ""}"></div>`;
        })
        .join("");
    }

    // Badges
    const badgesGrid = document.getElementById("pfBadgesGrid");
    const badgesCount = document.getElementById("pfBadgesEarnedCount");
    if (badgesGrid) {
      const earned = stats.badges.filter((b) => b.earned).length;
      if (badgesCount) badgesCount.textContent = `${earned} / ${stats.badges.length} đã mở khóa`;
      badgesGrid.innerHTML = stats.badges
        .map(
          (b) => `
          <div class="pf-badge-card${b.earned ? "" : " locked"}">
            <span class="pf-badge-emoji" aria-hidden="true">${b.emoji}</span>
            <div>
              <strong>${b.title}</strong>
              <small>${b.desc}</small>
            </div>
          </div>`
        )
        .join("");
    }

    // Weekly comparison
    const setById = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    setById("pfWeeklyWordsVal", stats.weekly.words);
    setById("pfWeeklyWordsDiff", stats.weekly.wordsDiff);
    setById("pfWeeklyTimeVal", stats.weekly.time);
    setById("pfWeeklyTimeDiff", stats.weekly.timeDiff);
    setById("pfWeeklyAccVal", stats.weekly.accuracy);
    setById("pfWeeklyAccDiff", stats.weekly.accuracyDiff);

    // Recent lessons
    const recentList = document.getElementById("pfRecentLessonsList");
    if (recentList) {
      recentList.innerHTML = stats.recentLessons
        .map(
          (item) => `
          <div class="pf-history-item">
            <div class="pf-history-copy">
              <strong>${item.title}</strong>
              <span>${item.meta}</span>
            </div>
            <span class="pf-history-score">${item.score}</span>
          </div>`
        )
        .join("");
    }

    // Active sessions
    const sessionsList = document.getElementById("pfActiveSessionsList");
    const revokeBtn = document.getElementById("pfRevokeSessionsBtn");
    if (sessionsList) {
      sessionsList.innerHTML = sessions
        .map(
          (s) => `
          <div class="pf-session-item">
            <div>
              <strong>${s.device}</strong>
              <span>${s.location}</span>
            </div>
            <span class="pf-session-tag${s.current ? "" : " other"}">${s.current ? "Thiết bị này" : "Hoạt động"}</span>
          </div>`
        )
        .join("");
    }
    if (revokeBtn) {
      revokeBtn.hidden = sessions.length <= 1;
    }

    // Logged out screen
    const loggedOutScreen = document.getElementById("pfLoggedOutScreen");
    if (loggedOutScreen) {
      loggedOutScreen.hidden = !loggedOut;
    }

    if (window.LexiTagLeaderboard && typeof window.LexiTagLeaderboard.refresh === "function") {
      window.LexiTagLeaderboard.refresh();
    }
  }

  function compressAvatar(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("read-error"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("image-error"));
        img.onload = () => {
          const maxSize = 512;
          let { width, height } = img;
          if (width > maxSize || height > maxSize) {
            const ratio = Math.min(maxSize / width, maxSize / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function openLogoutModal() {
    const modal = document.getElementById("pfLogoutModal");
    if (modal) modal.hidden = false;
  }

  function closeLogoutModal() {
    const modal = document.getElementById("pfLogoutModal");
    if (modal) modal.hidden = true;
  }

  function bindEvents() {
    // Profile form submit
    const profileForm = document.getElementById("pfProfileForm");
    if (profileForm) {
      profileForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const fullName = (document.getElementById("pfNameInput")?.value || "").trim();
        const email = (document.getElementById("pfEmailInput")?.value || "").trim();
        const phone = (document.getElementById("pfPhoneInput")?.value || "").trim();
        const dob = document.getElementById("pfDobInput")?.value || "";
        const targetLevel = document.getElementById("pfLevelSelect")?.value || "B2";
        const dailyTarget = Number(document.getElementById("pfDailyTargetInput")?.value) || 25;
        const reminderTime = document.getElementById("pfReminderTimeInput")?.value || "20:00";

        if (!fullName) {
          showToast("Vui lòng nhập họ và tên.");
          return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          showToast("Địa chỉ email không hợp lệ.");
          return;
        }
        if (dailyTarget < 5 || dailyTarget > 50) {
          showToast("Mục tiêu từ mới / ngày phải từ 5 đến 50 từ.");
          return;
        }

        state.user = {
          ...state.user,
          fullName,
          email,
          phone,
          dob,
          targetLevel,
          dailyTarget,
          reminderTime,
          strictUnlock: Boolean(document.getElementById("pfStrictUnlockToggle")?.checked),
          emailReminder: Boolean(document.getElementById("pfEmailReminderToggle")?.checked),
          streakWarning: Boolean(document.getElementById("pfStreakWarningToggle")?.checked)
        };
        saveState();
        renderProfile();
        showToast("Đã lưu thông tin hồ sơ cá nhân!");
      });
    }

    // Live DOB age update
    const dobInput = document.getElementById("pfDobInput");
    if (dobInput) {
      dobInput.addEventListener("change", () => {
        const ageEl = document.getElementById("pfCalculatedAge");
        if (ageEl) ageEl.textContent = calcAge(dobInput.value);
      });
    }

    // Live email reminder toggle disables reminder time input
    const emailReminderToggle = document.getElementById("pfEmailReminderToggle");
    if (emailReminderToggle) {
      emailReminderToggle.addEventListener("change", () => {
        const timeEl = document.getElementById("pfReminderTimeInput");
        if (timeEl) timeEl.disabled = !emailReminderToggle.checked;
      });
    }

    // OAuth Google link/unlink toggle
    const oauthBtn = document.getElementById("pfOauthToggleBtn");
    if (oauthBtn) {
      oauthBtn.addEventListener("click", () => {
        state.user.oauthGoogle = !state.user.oauthGoogle;
        saveState();
        renderProfile();
        showToast(
          state.user.oauthGoogle
            ? "Đã liên kết tài khoản Gmail thành công."
            : "Đã hủy liên kết tài khoản Gmail."
        );
      });
    }

    // Avatar upload & remove
    const uploadBtn = document.getElementById("pfUploadAvatarBtn");
    const avatarInput = document.getElementById("pfAvatarInput");
    const removeBtn = document.getElementById("pfRemoveAvatarBtn");
    if (uploadBtn && avatarInput) {
      uploadBtn.addEventListener("click", () => avatarInput.click());
      avatarInput.addEventListener("change", async () => {
        const file = avatarInput.files && avatarInput.files[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
          showToast("Vui lòng chọn định dạng hình ảnh hợp lệ.");
          return;
        }
        try {
          state.user.avatar = await compressAvatar(file);
          saveState();
          renderProfile();
          showToast("Đã cập nhật ảnh đại diện!");
        } catch {
          showToast("Không thể xử lý ảnh đại diện, vui lòng thử ảnh khác.");
        } finally {
          avatarInput.value = "";
        }
      });
    }
    if (removeBtn) {
      removeBtn.addEventListener("click", () => {
        state.user.avatar = "";
        saveState();
        renderProfile();
        showToast("Đã xóa ảnh đại diện.");
      });
    }

    // Change password form
    const passwordForm = document.getElementById("pfPasswordForm");
    if (passwordForm) {
      passwordForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const cur = document.getElementById("pfCurrentPwd")?.value || "";
        const next = document.getElementById("pfNewPwd")?.value || "";
        const confirm = document.getElementById("pfConfirmPwd")?.value || "";
        if (!cur) {
          showToast("Vui lòng nhập mật khẩu hiện tại.");
          return;
        }
        if (next.length < 8) {
          showToast("Mật khẩu mới phải có tối thiểu 8 ký tự.");
          return;
        }
        if (next !== confirm) {
          showToast("Xác nhận mật khẩu mới chưa khớp.");
          return;
        }
        if (cur === next) {
          showToast("Mật khẩu mới phải khác mật khẩu hiện tại.");
          return;
        }
        passwordForm.reset();
        showToast("Đổi mật khẩu thành công!");
      });
    }

    // Revoke other sessions
    const revokeBtn = document.getElementById("pfRevokeSessionsBtn");
    if (revokeBtn) {
      revokeBtn.addEventListener("click", () => {
        state.sessions = state.sessions.filter((s) => s.current);
        saveState();
        renderProfile();
        showToast("Đã đăng xuất khỏi toàn bộ thiết bị khác.");
      });
    }

    // Logout buttons & modal
    ["pfLogoutBtn", "sidebarLogoutBtn"].forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener("click", openLogoutModal);
    });

    const cancelLogoutBtn = document.getElementById("pfCancelLogoutBtn");
    const confirmLogoutBtn = document.getElementById("pfConfirmLogoutBtn");
    const logoutModal = document.getElementById("pfLogoutModal");
    if (cancelLogoutBtn) cancelLogoutBtn.addEventListener("click", closeLogoutModal);
    if (logoutModal) {
      logoutModal.addEventListener("click", (e) => {
        if (e.target === logoutModal) closeLogoutModal();
      });
    }
    if (confirmLogoutBtn) {
      confirmLogoutBtn.addEventListener("click", () => {
        closeLogoutModal();
        state.loggedOut = true;
        saveState();
        renderProfile();
      });
    }

    const reloginBtn = document.getElementById("pfReloginBtn");
    if (reloginBtn) {
      reloginBtn.addEventListener("click", () => {
        state.loggedOut = false;
        saveState();
        renderProfile();
        showToast(`Chào mừng trở lại, ${state.user.fullName}!`);
      });
    }

    const resetDefaultBtn = document.getElementById("pfResetDefaultBtn");
    if (resetDefaultBtn) {
      resetDefaultBtn.addEventListener("click", () => {
        localStorage.removeItem(STORAGE_KEY);
        state = structuredClone(DEFAULT_DATA);
        saveState();
        renderProfile();
        showToast("Đã khôi phục tài khoản mặc định.");
      });
    }

    // Sidebar settings button -> open profile settings
    const settingsBtn = document.getElementById("sidebarSettingsBtn");
    if (settingsBtn) {
      settingsBtn.addEventListener("click", () => {
        if (typeof window.switchTab === "function") {
          window.switchTab("profile");
        }
        setTimeout(() => {
          const el = document.getElementById("pfSettingsSwitches");
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 80);
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeLogoutModal();
    });
  }

  // Shared XP Manager synced across Topbar, Trang chủ, Leaderboard & Trang cá nhân
  function pulseXpPill() {
    const pill = document.getElementById("headerXpPill");
    if (!pill) return;
    pill.classList.remove("xp-pulse");
    void pill.offsetWidth;
    pill.classList.add("xp-pulse");
  }

  window.LexiTagProfile = {
    getSnapshot() {
      const earnedBadges = (state.stats.badges || [])
        .filter((b) => b.earned)
        .map((b) => `${b.emoji} ${b.title}`);
      return {
        fullName: state.user.fullName,
        avatar: state.user.avatar,
        targetLevel: state.user.targetLevel,
        totalXp: Number(state.stats.totalXp) || 2450,
        streakDays: Number(state.stats.streakDays) || 7,
        wordsThisWeek: 41,
        badges: earnedBadges
      };
    }
  };

  window.LexiTagXP = {
    get() {
      return Number(state.stats.totalXp) || 0;
    },
    add(amount, reason = "", lessonEntry = null) {
      const pts = Math.max(0, Math.round(Number(amount) || 0));
      if (pts <= 0) return this.get();
      state.stats.totalXp = (Number(state.stats.totalXp) || 0) + pts;
      if (lessonEntry && lessonEntry.title) {
        const list = Array.isArray(state.stats.recentLessons) ? state.stats.recentLessons : [];
        state.stats.recentLessons = [lessonEntry, ...list].slice(0, 6);
      }
      saveState();
      renderProfile();
      pulseXpPill();
      if (reason) {
        showToast(`+${pts} XP · ${reason} (Tổng: ${state.stats.totalXp.toLocaleString("en-US")} XP)`);
      }
      return state.stats.totalXp;
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    renderProfile();
    bindEvents();
  });
})();
