(() => {
  "use strict";

  const STORAGE_KEY = "lexitag-notifications-v1";

  const DEFAULT_NOTIFICATIONS = [
    {
      id: "n-srs-due",
      title: "12 thẻ SRS đang đến hạn ôn tập",
      body: "Ôn lại các từ đến hạn theo thuật toán SM-2 hôm nay để giữ trí nhớ dài hạn.",
      icon: "schedule",
      tone: "amber",
      time: "Hôm nay",
      target: "review",
      read: false
    },
    {
      id: "n-streak",
      title: "Giữ vững chuỗi học 7 ngày liên tiếp!",
      body: "Bạn chỉ còn 7 từ nữa để hoàn thành mục tiêu hôm nay và tiến tới mốc 14 ngày.",
      icon: "local_fire_department",
      tone: "amber",
      time: "2 giờ trước",
      target: "profile",
      read: false
    },
    {
      id: "n-badge",
      title: "Mở khóa huy hiệu Phát âm chuẩn > 90%",
      body: "Độ chuẩn phát âm AI trung bình của bạn đã đạt 91.5% (+2.4% so tuần trước).",
      icon: "workspace_premium",
      tone: "purple",
      time: "Hôm qua",
      target: "profile",
      read: false
    },
    {
      id: "n-course",
      title: "Tiếp tục lộ trình: Where Do You Live?",
      body: "Bài học Phần 1 đang hoàn thành 28%. Học tiếp để mở khóa bài kế tiếp!",
      icon: "menu_book",
      tone: "blue",
      time: "2 ngày trước",
      target: "courses",
      read: true
    }
  ];

  let items = loadItems();
  let filterMode = "all"; // all | unread
  let isOpen = false;

  function loadItems() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_NOTIFICATIONS.map((n) => ({ ...n }));
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : DEFAULT_NOTIFICATIONS.map((n) => ({ ...n }));
    } catch {
      return DEFAULT_NOTIFICATIONS.map((n) => ({ ...n }));
    }
  }

  function saveItems() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore storage quota errors
    }
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setOpen(open) {
    isOpen = Boolean(open);
    const popover = document.getElementById("notifPopover");
    const btn = document.getElementById("notifToggleBtn");
    if (popover) popover.hidden = !isOpen;
    if (btn) {
      btn.classList.toggle("open", isOpen);
      btn.setAttribute("aria-expanded", String(isOpen));
    }
    if (isOpen) render();
  }

  function navigateFromNotification(target) {
    setOpen(false);
    if (target === "settings") {
      if (typeof window.switchTab === "function") window.switchTab("profile");
      setTimeout(() => {
        const el = document.getElementById("pfSettingsSwitches");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 90);
      return;
    }
    if (target && typeof window.switchTab === "function") {
      window.switchTab(target);
    }
  }

  function render() {
    const unreadCount = items.filter((n) => !n.read).length;
    const dot = document.getElementById("notifDot");
    const badge = document.getElementById("notifUnreadBadge");
    const tabUnread = document.getElementById("notifTabUnread");
    const markAllBtn = document.getElementById("notifMarkAllBtn");
    const listEl = document.getElementById("notifList");

    if (dot) dot.hidden = unreadCount === 0;
    if (badge) {
      badge.textContent = `${unreadCount} mới`;
      badge.hidden = unreadCount === 0;
    }
    if (tabUnread) {
      tabUnread.textContent = `Chưa đọc (${unreadCount})`;
    }
    if (markAllBtn) {
      markAllBtn.hidden = unreadCount === 0;
    }

    if (!listEl) return;
    const visible = filterMode === "unread" ? items.filter((n) => !n.read) : items;

    if (!visible.length) {
      listEl.innerHTML = `
        <div class="notif-empty">
          <span class="material-symbols-outlined">notifications_off</span>
          <span>${filterMode === "unread" ? "Bạn đã đọc hết mọi thông báo!" : "Chưa có thông báo nào."}</span>
        </div>`;
      return;
    }

    listEl.innerHTML = visible
      .map(
        (n) => `
        <div class="notif-item${n.read ? "" : " unread"}" role="button" tabindex="0" data-notif-id="${escapeHtml(n.id)}">
          <span class="notif-icon ${escapeHtml(n.tone || "blue")}">
            <span class="material-symbols-outlined">${escapeHtml(n.icon || "notifications")}</span>
          </span>
          <div class="notif-body">
            <strong>${escapeHtml(n.title)}</strong>
            <p>${escapeHtml(n.body)}</p>
            <span class="notif-time">${escapeHtml(n.time)}</span>
          </div>
          <button class="notif-del-btn" type="button" data-notif-del="${escapeHtml(n.id)}" title="Xóa thông báo" aria-label="Xóa thông báo">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>`
      )
      .join("");
  }

  function bindEvents() {
    const wrap = document.getElementById("notifWrap");
    const toggleBtn = document.getElementById("notifToggleBtn");
    const markAllBtn = document.getElementById("notifMarkAllBtn");
    const clearAllBtn = document.getElementById("notifClearAllBtn");
    const settingsBtn = document.getElementById("notifSettingsBtn");
    const listEl = document.getElementById("notifList");

    if (toggleBtn) {
      toggleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        setOpen(!isOpen);
      });
    }

    document.querySelectorAll("[data-notif-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        filterMode = btn.dataset.notifTab;
        document.querySelectorAll("[data-notif-tab]").forEach((b) =>
          b.classList.toggle("active", b === btn)
        );
        render();
      });
    });

    if (markAllBtn) {
      markAllBtn.addEventListener("click", () => {
        items.forEach((n) => {
          n.read = true;
        });
        saveItems();
        render();
      });
    }

    if (clearAllBtn) {
      clearAllBtn.addEventListener("click", () => {
        items = [];
        saveItems();
        render();
      });
    }

    if (settingsBtn) {
      settingsBtn.addEventListener("click", () => navigateFromNotification("settings"));
    }

    if (listEl) {
      listEl.addEventListener("click", (e) => {
        const delBtn = e.target.closest("[data-notif-del]");
        if (delBtn) {
          e.stopPropagation();
          const delId = delBtn.dataset.notifDel;
          items = items.filter((n) => n.id !== delId);
          saveItems();
          render();
          return;
        }
        const row = e.target.closest("[data-notif-id]");
        if (row) {
          const item = items.find((n) => n.id === row.dataset.notifId);
          if (item) {
            item.read = true;
            saveItems();
            render();
            navigateFromNotification(item.target);
          }
        }
      });
    }

    // Close on outside click or Escape
    document.addEventListener("click", (e) => {
      if (isOpen && wrap && !wrap.contains(e.target)) {
        setOpen(false);
      }
    });

    document.addEventListener("keydown", (e) => {
      if (isOpen && e.key === "Escape") setOpen(false);
    });
  }

  window.LexiTagNotif = {
    push({ title, body, icon = "bolt", tone = "green", target = "dashboard" }) {
      const nowStr = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
      items = [
        {
          id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title,
          body,
          icon,
          tone,
          time: `Vừa xong · ${nowStr}`,
          target,
          read: false
        },
        ...items
      ].slice(0, 20);
      saveItems();
      render();
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    render();
  });
})();
