(() => {
  "use strict";

  const CHAT_STORAGE_KEY = "lexitag-support-chat-v1";

  const DEFAULT_ADMIN_MSGS = [
    {
      sender: "admin",
      text: "Chào bạn! Đội ngũ Quản trị viên LexiTag đang trực tuyến. Bạn gặp vấn đề về tài khoản, khóa học hay lỗi từ vựng cần hỗ trợ ạ?",
      time: "Vừa kết nối"
    }
  ];

  let isOpen = false;
  let activeScreen = "menu"; // menu | chat | feedback | course | community
  let adminMessages = loadAdminMessages();
  let toastTimer = 0;

  function loadAdminMessages() {
    try {
      const raw = localStorage.getItem(CHAT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_ADMIN_MSGS.map((m) => ({ ...m }));
  }

  function saveAdminMessages() {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(adminMessages));
    } catch {
      // ignore
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

  function nowTime() {
    return new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  }

  function showToast(msg) {
    const el = document.getElementById("profileToast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
  }

  function generateAdminReply(text) {
    const q = text.toLowerCase();
    if (q.includes("mật khẩu") || q.includes("tài khoản") || q.includes("email") || q.includes("đăng nhập")) {
      return "Với vấn đề tài khoản/mật khẩu, bạn có thể vào mục Trang cá nhân → Bảo mật & Đổi mật khẩu. Nếu cần cấp lại quyền truy cập, QTV đã ghi nhận yêu cầu và sẽ phản hồi qua email trong ít phút!";
    }
    if (q.includes("lỗi") || q.includes("sai") || q.includes("phiên âm") || q.includes("bug")) {
      return "Cảm ơn bạn đã báo lỗi! QTV đã ghi nhận chi tiết để đội kỹ thuật kiểm tra và cập nhật dữ liệu Oxford 3000 sớm nhất.";
    }
    if (q.includes("khóa học") || q.includes("lộ trình") || q.includes("b2") || q.includes("a1") || q.includes("a2")) {
      return "Với lộ trình Oxford 3000 trên LexiTag, bạn nên bắt đầu ở cấp độ hiện tại trong mục Khóa học và giữ đều 20–25 từ/ngày kết hợp Ôn tập SM-2. Bạn đang nhắm mục tiêu cấp độ nào ạ?";
    }
    return "QTV đã nhận được tin nhắn của bạn! Mình sẽ kiểm tra và hỗ trợ ngay. Nếu bạn muốn hỏi nhanh về nghĩa từ vựng tiếng Anh, bạn cũng có thể dùng mục Trợ lý AI ở thanh menu bên trái nhé.";
  }

  function setOpen(open) {
    isOpen = Boolean(open);
    const popover = document.getElementById("supPopover");
    const fab = document.getElementById("supFab");
    if (popover) popover.hidden = !isOpen;
    if (fab) fab.setAttribute("aria-expanded", String(isOpen));
    if (isOpen) render();
  }

  function setScreen(screen) {
    activeScreen = screen;
    render();
  }

  function renderMenuScreen(container) {
    container.innerHTML = `
      <div class="sup-accent-bar"></div>
      <div class="sup-head">
        <div>
          <p class="sup-eyebrow">HỖ TRỢ</p>
          <h3 class="sup-heading">Bạn cần hỗ trợ gì?</h3>
          <p class="sup-sub">Chọn đúng kênh để được hỗ trợ nhanh hơn.</p>
        </div>
        <button class="sup-close-btn" type="button" id="supCloseBtn" aria-label="Đóng hộp hỗ trợ">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <div class="sup-body">
        <div class="sup-channel-list">
          <button class="sup-channel-card" type="button" data-sup-go="chat">
            <div class="sup-channel-copy">
              <strong>Chat với Quản trị viên <span class="sup-online-tag"><i></i>Online</span></strong>
              <span>Hỗ trợ trực tiếp tài khoản &amp; kỹ thuật</span>
            </div>
            <span class="material-symbols-outlined sup-arrow">arrow_forward</span>
          </button>

          <button class="sup-channel-card" type="button" data-sup-go="feedback">
            <div class="sup-channel-copy">
              <strong>Góp ý/Báo lỗi</strong>
              <span>Gửi biểu mẫu qua email</span>
            </div>
            <span class="material-symbols-outlined sup-arrow">arrow_forward</span>
          </button>

          <button class="sup-channel-card" type="button" data-sup-go="course">
            <div class="sup-channel-copy">
              <strong>Tư vấn khóa học</strong>
              <span>Gợi ý lộ trình Oxford 3000 (A1–B2)</span>
            </div>
            <span class="material-symbols-outlined sup-arrow">arrow_forward</span>
          </button>

          <button class="sup-channel-card" type="button" data-sup-go="community">
            <div class="sup-channel-copy">
              <strong>Cộng đồng học tập</strong>
              <span>Facebook Group, Discord &amp; Telegram</span>
            </div>
            <span class="material-symbols-outlined sup-arrow">arrow_forward</span>
          </button>
        </div>
      </div>
    `;
  }

  function renderAdminChatScreen(container) {
    container.innerHTML = `
      <div class="sup-subhead">
        <button class="sup-back-btn" type="button" data-sup-go="menu">
          <span class="material-symbols-outlined" style="font-size:18px;">arrow_back</span>
          <span>Chat với QTV</span>
          <span class="sup-online-tag"><i></i>Online</span>
        </button>
        <button class="sup-close-btn" style="width:32px; height:32px;" type="button" id="supCloseBtn" aria-label="Đóng">
          <span class="material-symbols-outlined" style="font-size:18px;">close</span>
        </button>
      </div>

      <div class="sup-chat-messages" id="supChatList">
        ${adminMessages
          .map(
            (m) => `
            <div class="sup-bubble ${m.sender === "me" ? "me" : "admin"}">
              <div>${escapeHtml(m.text)}</div>
              <small>${m.sender === "me" ? "Bạn" : "Quản trị viên"} · ${escapeHtml(m.time)}</small>
            </div>`
          )
          .join("")}
      </div>

      <form class="sup-chat-form" id="supChatForm">
        <input type="text" id="supChatInput" placeholder="Nhập tin nhắn gửi Quản trị viên..." autocomplete="off" required>
        <button class="sup-send-btn" type="submit" aria-label="Gửi tin nhắn">
          <span class="material-symbols-outlined" style="font-size:19px;">send</span>
        </button>
      </form>
    `;

    const listEl = document.getElementById("supChatList");
    if (listEl) listEl.scrollTop = listEl.scrollHeight;

    const form = document.getElementById("supChatForm");
    const input = document.getElementById("supChatInput");
    if (input) setTimeout(() => input.focus(), 40);
    if (form && input) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        adminMessages.push({ sender: "me", text, time: nowTime() });
        saveAdminMessages();
        render();

        setTimeout(() => {
          adminMessages.push({
            sender: "admin",
            text: generateAdminReply(text),
            time: nowTime()
          });
          saveAdminMessages();
          if (isOpen && activeScreen === "chat") render();
        }, 650);
      });
    }
  }

  function renderFeedbackScreen(container) {
    const userEmail = document.getElementById("pfEmailInput")?.value || "nguyenan.k68@vnua.edu.vn";
    container.innerHTML = `
      <div class="sup-subhead">
        <button class="sup-back-btn" type="button" data-sup-go="menu">
          <span class="material-symbols-outlined" style="font-size:18px;">arrow_back</span>
          <span>Góp ý / Báo lỗi</span>
        </button>
        <button class="sup-close-btn" style="width:32px; height:32px;" type="button" id="supCloseBtn" aria-label="Đóng">
          <span class="material-symbols-outlined" style="font-size:18px;">close</span>
        </button>
      </div>

      <div class="sup-body" style="padding-top:14px;">
        <form class="sup-form" id="supFeedbackForm">
          <div class="sup-field">
            <label for="supFbType">Loại phản hồi</label>
            <select id="supFbType">
              <option value="Lỗi từ vựng / phiên âm">Lỗi từ vựng / phiên âm Oxford 3000</option>
              <option value="Lỗi tính năng / giao diện">Lỗi tính năng / giao diện</option>
              <option value="Góp ý cải thiện">Góp ý cải thiện trải nghiệm</option>
            </select>
          </div>
          <div class="sup-field">
            <label for="supFbEmail">Email nhận phản hồi</label>
            <input id="supFbEmail" type="email" value="${escapeHtml(userEmail)}" required>
          </div>
          <div class="sup-field">
            <label for="supFbDetail">Nội dung chi tiết</label>
            <textarea id="supFbDetail" placeholder="Mô tả lỗi hoặc góp ý của bạn..." required></textarea>
          </div>
          <button class="sup-submit-btn" type="submit">Gửi góp ý tới QTV</button>
        </form>
      </div>
    `;

    const form = document.getElementById("supFeedbackForm");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const type = document.getElementById("supFbType")?.value || "Góp ý";
        showToast("Đã gửi biểu mẫu góp ý/báo lỗi thành công! Cảm ơn bạn.");
        if (window.LexiTagNotif && typeof window.LexiTagNotif.push === "function") {
          window.LexiTagNotif.push({
            title: `Đã tiếp nhận: ${type}`,
            body: "Đội ngũ QTV đã nhận được phản hồi của bạn và sẽ phản hồi qua email sớm nhất.",
            icon: "mark_email_read",
            tone: "blue",
            target: "dashboard"
          });
        }
        setScreen("menu");
        setOpen(false);
      });
    }
  }

  function renderCourseScreen(container) {
    container.innerHTML = `
      <div class="sup-subhead">
        <button class="sup-back-btn" type="button" data-sup-go="menu">
          <span class="material-symbols-outlined" style="font-size:18px;">arrow_back</span>
          <span>Tư vấn khóa học</span>
        </button>
        <button class="sup-close-btn" style="width:32px; height:32px;" type="button" id="supCloseBtn" aria-label="Đóng">
          <span class="material-symbols-outlined" style="font-size:18px;">close</span>
        </button>
      </div>

      <div class="sup-body" style="padding-top:14px;">
        <div class="sup-community-list">
          <div class="sup-community-item">
            <div>
              <strong>Lộ trình A1–A2 (Nền tảng)</strong>
              <small>2,070 từ cốt lõi · Phù hợp người mới lấy lại gốc</small>
            </div>
            <button class="rv-btn-outline" type="button" id="supGoCourseA">Xem</button>
          </div>
          <div class="sup-community-item">
            <div>
              <strong>Lộ trình B1–B2 (Giao tiếp &amp; IELTS)</strong>
              <small>1,743 từ học thuật &amp; công sở · Kết hợp phát âm AI</small>
            </div>
            <button class="rv-btn-outline" type="button" id="supGoCourseB">Xem</button>
          </div>
        </div>
        <button class="sup-submit-btn" style="width:100%; margin-top:14px;" type="button" data-sup-go="chat">
          Nhắn trực tiếp QTV để tư vấn riêng
        </button>
      </div>
    `;

    ["supGoCourseA", "supGoCourseB"].forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener("click", () => {
          setOpen(false);
          if (typeof window.switchTab === "function") window.switchTab("courses");
        });
      }
    });
  }

  function renderCommunityScreen(container) {
    const links = [
      { name: "Facebook Group · LexiTag Learners", desc: "Thảo luận từ vựng & mẹo nhớ mỗi ngày", url: "https://facebook.com" },
      { name: "Discord · Phòng luyện phát âm AI", desc: "Kênh voice luyện nói & thi đua chuỗi Streak", url: "https://discord.com" },
      { name: "Telegram · Kênh nhắc học tự động", desc: "Nhận bộ từ mới & thông báo cập nhật hệ thống", url: "https://t.me" }
    ];
    container.innerHTML = `
      <div class="sup-subhead">
        <button class="sup-back-btn" type="button" data-sup-go="menu">
          <span class="material-symbols-outlined" style="font-size:18px;">arrow_back</span>
          <span>Cộng đồng học tập</span>
        </button>
        <button class="sup-close-btn" style="width:32px; height:32px;" type="button" id="supCloseBtn" aria-label="Đóng">
          <span class="material-symbols-outlined" style="font-size:18px;">close</span>
        </button>
      </div>

      <div class="sup-body" style="padding-top:14px;">
        <div class="sup-community-list">
          ${links
            .map(
              (l) => `
              <div class="sup-community-item">
                <div>
                  <strong>${escapeHtml(l.name)}</strong>
                  <small>${escapeHtml(l.desc)}</small>
                </div>
                <a class="rv-btn-outline" href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">Mở</a>
              </div>`
            )
            .join("")}
        </div>
      </div>
    `;
  }

  function render() {
    const popover = document.getElementById("supPopover");
    if (!popover) return;
    if (activeScreen === "chat") renderAdminChatScreen(popover);
    else if (activeScreen === "feedback") renderFeedbackScreen(popover);
    else if (activeScreen === "course") renderCourseScreen(popover);
    else if (activeScreen === "community") renderCommunityScreen(popover);
    else renderMenuScreen(popover);

    const closeBtn = document.getElementById("supCloseBtn");
    if (closeBtn) closeBtn.addEventListener("click", () => setOpen(false));

    popover.querySelectorAll("[data-sup-go]").forEach((btn) => {
      btn.addEventListener("click", () => setScreen(btn.dataset.supGo));
    });
  }

  function bindEvents() {
    const fab = document.getElementById("supFab");
    const popover = document.getElementById("supPopover");

    if (fab) {
      fab.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!isOpen) activeScreen = "menu";
        setOpen(!isOpen);
      });
    }

    document.addEventListener("click", (e) => {
      if (isOpen && popover && fab && !popover.contains(e.target) && !fab.contains(e.target)) {
        setOpen(false);
      }
    });

    document.addEventListener("keydown", (e) => {
      if (isOpen && e.key === "Escape") setOpen(false);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
  });
})();
