(() => {
  "use strict";

  const GROUP_NAME = "Nhóm B2 Pro";

  // Raw mock payload shaped identically to expected Backend API JSON
  // (Replace with fetch('/api/leaderboard/weekly') when connecting NestJS backend)
  const PEER_MEMBERS = [
    {
      userId: "u_hoang",
      fullName: "Trần Hoàng",
      avatarUrl: "",
      level: "B2",
      weeklyXp: 3120,
      wordsThisWeek: 64,
      streakDays: 12,
      badges: ["🔥 Chuỗi 14 ngày", "🏆 Top 1 tuần", "📚 500+ từ"]
    },
    {
      userId: "u_linh",
      fullName: "Mai Linh",
      avatarUrl: "",
      level: "B2",
      weeklyXp: 2840,
      wordsThisWeek: 52,
      streakDays: 9,
      badges: ["🎙️ Phát âm 93%", "📚 450+ từ"]
    },
    {
      userId: "u_quan",
      fullName: "Lê Minh Quân",
      avatarUrl: "",
      level: "B1",
      weeklyXp: 2310,
      wordsThisWeek: 38,
      streakDays: 6,
      badges: ["⚡ Học đều đặn", "🎯 Đạt mục tiêu"]
    },
    {
      userId: "u_vy",
      fullName: "Phạm Thảo Vy",
      avatarUrl: "",
      level: "B2",
      weeklyXp: 2080,
      wordsThisWeek: 34,
      streakDays: 5,
      badges: ["🌱 Bứt phá tuần"]
    },
    {
      userId: "u_huy",
      fullName: "Đỗ Gia Huy",
      avatarUrl: "",
      level: "B1",
      weeklyXp: 1890,
      wordsThisWeek: 29,
      streakDays: 4,
      badges: ["🔥 Chuỗi 4 ngày"]
    }
  ];

  let rankedList = [];

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getInitials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "NA";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function readCurrentUserSnapshot() {
    if (window.LexiTagProfile && typeof window.LexiTagProfile.getSnapshot === "function") {
      return window.LexiTagProfile.getSnapshot();
    }
    return {
      fullName: "Nguyễn An",
      avatar: "",
      targetLevel: "B2",
      totalXp: window.LexiTagXP ? window.LexiTagXP.get() : 2450,
      streakDays: 7,
      wordsThisWeek: 41,
      badges: ["🔥 Chuỗi 7 ngày", "📚 Chạm mốc 400 từ", "🎙️ Phát âm chuẩn > 90%"]
    };
  }

  function buildRankedLeaderboard() {
    const me = readCurrentUserSnapshot();
    const currentMember = {
      userId: "u_me",
      fullName: me.fullName || "Nguyễn An",
      avatarUrl: me.avatar || "",
      level: me.targetLevel || "B2",
      weeklyXp: Number(me.totalXp) || 2450,
      wordsThisWeek: Number(me.wordsThisWeek) || 41,
      streakDays: Number(me.streakDays) || 7,
      badges: Array.isArray(me.badges) && me.badges.length
        ? me.badges
        : ["🔥 Chuỗi 7 ngày", "📚 400+ từ"],
      isCurrentUser: true
    };

    const all = [
      ...PEER_MEMBERS.map((m) => ({ ...m, isCurrentUser: false })),
      currentMember
    ];

    all.sort((a, b) => b.weeklyXp - a.weeklyXp || b.wordsThisWeek - a.wordsThisWeek);
    return all.map((m, idx) => ({ ...m, rank: idx + 1 }));
  }

  function getRankClass(rank) {
    if (rank === 1) return "gold";
    if (rank === 2) return "silver";
    if (rank === 3) return "bronze";
    return "";
  }

  function getTierTitle(rank) {
    if (rank === 1) return `Hạng Vàng • Rank #1 nhóm`;
    if (rank <= 3) return `Hạng Bạc • Rank #${rank} nhóm`;
    return `Hạng Đồng • Rank #${rank} nhóm`;
  }

  function renderRowHtml(m) {
    const rankCls = getRankClass(m.rank);
    const displayName = m.isCurrentUser ? `${m.fullName} (Bạn)` : m.fullName;
    const initials = getInitials(m.fullName);
    const avatarInner = m.avatarUrl
      ? `<img src="${escapeHtml(m.avatarUrl)}" alt="${escapeHtml(m.fullName)}">`
      : escapeHtml(initials);

    return `
      <div class="leaderboard-item lb-row${m.isCurrentUser ? " current-user" : ""}" role="button" tabindex="0" data-lb-user="${escapeHtml(m.userId)}" title="Nhấn để xem nhanh hồ sơ">
        <div class="leader-left">
          <span class="rank-number ${rankCls}">${m.rank}</span>
          <div class="leader-avatar${m.isCurrentUser ? " current-user" : ""}">${avatarInner}</div>
          <div class="leader-info">
            <span class="leader-name">${escapeHtml(displayName)}</span>
            <span class="leader-stat">${m.wordsThisWeek} từ thuộc tuần này</span>
          </div>
        </div>
        <span class="leader-xp">${m.weeklyXp.toLocaleString("en-US")} XP</span>
      </div>`;
  }

  function renderDashboardWidget() {
    rankedList = buildRankedLeaderboard();
    const listEl = document.getElementById("dashboardLeaderboardList");
    const me = rankedList.find((m) => m.isCurrentUser);

    // Sync rank label across Trang chủ & Trang cá nhân
    if (me) {
      const label = getTierTitle(me.rank);
      document.querySelectorAll("[data-rank-label]").forEach((el) => {
        el.textContent = label;
      });
    }

    if (!listEl) return;
    if (!rankedList.length) {
      listEl.innerHTML = `<div class="notif-empty">Chưa có dữ liệu bảng xếp hạng tuần này.</div>`;
      return;
    }

    const top3 = rankedList.slice(0, 3);
    const showMeSeparately = me && me.rank > 3;
    const displayRows = showMeSeparately ? [...top3, me] : top3;
    listEl.innerHTML = displayRows.map(renderRowHtml).join("");
  }

  function openGroupModal() {
    const modal = document.getElementById("lbGroupModal");
    const listEl = document.getElementById("lbGroupModalList");
    const subEl = document.getElementById("lbGroupModalSub");
    if (!modal || !listEl) return;

    modal.hidden = false;
    if (subEl) subEl.textContent = `${GROUP_NAME} · ${rankedList.length} thành viên đang thi đua tuần này`;

    // Show clean Skeleton loading state briefly (mirrors real API fetch UX)
    listEl.innerHTML = Array.from({ length: 4 }, () => `<div class="lb-skeleton-row"></div>`).join("");
    setTimeout(() => {
      rankedList = buildRankedLeaderboard();
      listEl.innerHTML = rankedList.map(renderRowHtml).join("");
    }, 180);
  }

  function closeGroupModal() {
    const modal = document.getElementById("lbGroupModal");
    if (modal) modal.hidden = true;
  }

  function openQuickProfile(userId) {
    const member = rankedList.find((m) => m.userId === userId);
    const modal = document.getElementById("lbQuickProfileModal");
    const bodyEl = document.getElementById("lbQuickProfileBody");
    if (!member || !modal || !bodyEl) return;

    const initials = getInitials(member.fullName);
    const avatarInner = member.avatarUrl
      ? `<img src="${escapeHtml(member.avatarUrl)}" alt="${escapeHtml(member.fullName)}">`
      : escapeHtml(initials);

    bodyEl.innerHTML = `
      <div class="lb-qp-top">
        <div class="lb-qp-avatar">${avatarInner}</div>
        <div class="lb-qp-meta">
          <strong>${escapeHtml(member.fullName)}${member.isCurrentUser ? " (Bạn)" : ""}</strong>
          <div class="lb-qp-tags">
            <span class="lb-qp-tag">CEFR ${escapeHtml(member.level)}</span>
            <span class="lb-qp-tag rank">Rank #${member.rank} · ${escapeHtml(GROUP_NAME)}</span>
          </div>
        </div>
      </div>

      <div class="lb-qp-stats">
        <div class="lb-qp-stat">
          <strong>${member.weeklyXp.toLocaleString("en-US")}</strong>
          <span>Tổng XP</span>
        </div>
        <div class="lb-qp-stat">
          <strong>${member.wordsThisWeek} từ</strong>
          <span>Thuộc tuần này</span>
        </div>
        <div class="lb-qp-stat">
          <strong>${member.streakDays} ngày 🔥</strong>
          <span>Chuỗi Streak</span>
        </div>
      </div>

      <div class="lb-qp-badges">
        ${(member.badges || []).map((b) => `<span class="lb-qp-badge-chip">${escapeHtml(b)}</span>`).join("")}
      </div>

      <p class="lb-qp-note">Chỉ hiển thị thông tin học tập công khai (ẩn email &amp; thông tin riêng tư).</p>

      <div class="pf-modal-actions">
        <button class="pf-btn-outline" type="button" id="lbQpCloseActionBtn">Đóng</button>
        ${
          member.isCurrentUser
            ? `<button class="pf-btn-primary" type="button" id="lbQpOpenFullProfileBtn" style="min-height:40px;">
                <span class="material-symbols-outlined">person</span>
                <span>Mở Hồ sơ cá nhân</span>
              </button>`
            : ""
        }
      </div>
    `;

    modal.hidden = false;

    const closeBtn = document.getElementById("lbQpCloseActionBtn");
    const openProfileBtn = document.getElementById("lbQpOpenFullProfileBtn");
    if (closeBtn) closeBtn.addEventListener("click", closeQuickProfile);
    if (openProfileBtn) {
      openProfileBtn.addEventListener("click", () => {
        closeQuickProfile();
        closeGroupModal();
        if (typeof window.switchTab === "function") window.switchTab("profile");
      });
    }
  }

  function closeQuickProfile() {
    const modal = document.getElementById("lbQuickProfileModal");
    if (modal) modal.hidden = true;
  }

  function bindEvents() {
    const groupBtn = document.getElementById("lbGroupBadgeBtn");
    const groupCloseBtn = document.getElementById("lbGroupModalClose");
    const groupModal = document.getElementById("lbGroupModal");
    const qpCloseBtn = document.getElementById("lbQpModalClose");
    const qpModal = document.getElementById("lbQuickProfileModal");
    const dashList = document.getElementById("dashboardLeaderboardList");
    const modalList = document.getElementById("lbGroupModalList");

    if (groupBtn) groupBtn.addEventListener("click", openGroupModal);
    if (groupCloseBtn) groupCloseBtn.addEventListener("click", closeGroupModal);
    if (groupModal) {
      groupModal.addEventListener("click", (e) => {
        if (e.target === groupModal) closeGroupModal();
      });
    }

    if (qpCloseBtn) qpCloseBtn.addEventListener("click", closeQuickProfile);
    if (qpModal) {
      qpModal.addEventListener("click", (e) => {
        if (e.target === qpModal) closeQuickProfile();
      });
    }

    const handleRowClick = (e) => {
      const row = e.target.closest("[data-lb-user]");
      if (row) openQuickProfile(row.dataset.lbUser);
    };

    if (dashList) dashList.addEventListener("click", handleRowClick);
    if (modalList) modalList.addEventListener("click", handleRowClick);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeQuickProfile();
        closeGroupModal();
      }
    });
  }

  window.LexiTagLeaderboard = {
    refresh() {
      renderDashboardWidget();
      const groupModal = document.getElementById("lbGroupModal");
      const listEl = document.getElementById("lbGroupModalList");
      if (groupModal && !groupModal.hidden && listEl) {
        listEl.innerHTML = rankedList.map(renderRowHtml).join("");
      }
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    renderDashboardWidget();
  });
})();
