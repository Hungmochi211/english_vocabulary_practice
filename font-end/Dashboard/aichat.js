(() => {
  "use strict";

  const STORAGE_KEY = "lexitag-ai-chats-v1";

  const STOP_EN = new Set([
    "the", "and", "for", "with", "that", "this", "from", "what", "how", "why",
    "can", "you", "your", "are", "was", "were", "have", "has", "had", "not",
    "but", "all", "one", "two", "three", "about", "into", "more", "some", "word",
    "words", "english", "example", "examples", "diff", "difference", "between"
  ]);

  const PREPOSITION_TIPS = {
    opportunity: ["**opportunity for** + N / V-ing (cơ hội cho việc gì)", "**opportunity to** + V (cơ hội để làm gì)", "Collocations: *seize an opportunity, miss an opportunity, equal opportunity*"],
    achieve: ["Không đi với giới từ trực tiếp (ngoại động từ): **achieve + goal / success / result**", "Collocations: *achieve a goal, achieve success, achieve high accuracy*"],
    peaceful: ["**peaceful** + N (*peaceful atmosphere, peaceful solution, peaceful neighborhood*)", "Thường đứng sau **in**: *live in peaceful surroundings*"],
    depend: ["**depend on / upon** + N / V-ing (phụ thuộc vào)", "Tránh nhầm dùng *depend of* hoặc *depend in*"],
    interested: ["**interested in** + N / V-ing (quan tâm, hứng thú với)", "**interested to** + V (*interested to hear / know*)"],
    improve: ["**improve** + N (ngoại động từ): *improve skills / pronunciation*", "**improve on / upon** + thành tích cũ (cải thiện vượt mốc trước)"],
    environment: ["**in an environment** (*work in a supportive environment*)", "Collocations: *protect the environment, natural environment, work environment*"]
  };

  let conversations = loadConversations();
  let activeId = conversations[0] ? conversations[0].id : null;
  let isTyping = false;

  function loadConversations() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch {
      // ignore
    }
    return [createEmptyConversation("Cuộc trò chuyện mới")];
  }

  function saveConversations() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch {
      // ignore quota error
    }
  }

  function createEmptyConversation(title = "Cuộc trò chuyện mới") {
    return {
      id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      updatedAt: nowTimeStr(),
      messages: []
    };
  }

  function nowTimeStr() {
    return new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Safe lightweight Markdown renderer (bold, inline code, bullet lists, line breaks)
  function formatMarkdown(text) {
    const lines = String(text || "").split("\n");
    let html = "";
    let inList = false;

    const inlineFmt = (line) =>
      escapeHtml(line)
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\*([^*]+)\*/g, "<em>$1</em>");

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        if (inList) {
          html += "</ul>";
          inList = false;
        }
        continue;
      }
      if (line.startsWith("- ") || line.startsWith("• ")) {
        if (!inList) {
          html += "<ul>";
          inList = true;
        }
        html += `<li>${inlineFmt(line.slice(2))}</li>`;
      } else {
        if (inList) {
          html += "</ul>";
          inList = false;
        }
        html += `<p>${inlineFmt(line)}</p>`;
      }
    }
    if (inList) html += "</ul>";
    return html;
  }

  function getActiveConv() {
    let conv = conversations.find((c) => c.id === activeId);
    if (!conv) {
      conv = createEmptyConversation();
      conversations.unshift(conv);
      activeId = conv.id;
    }
    return conv;
  }

  function findDictionaryWords(text) {
    const dict = Array.isArray(window.OXFORD_DICTIONARY) ? window.OXFORD_DICTIONARY : [];
    if (!dict.length) return [];
    const tokens = String(text || "")
      .toLowerCase()
      .match(/[a-z]{2,}/g);
    if (!tokens) return [];

    const unique = [];
    const seen = new Set();
    for (const tk of tokens) {
      if (STOP_EN.has(tk) || seen.has(tk)) continue;
      const match = dict.find((d) => d.w.toLowerCase() === tk);
      if (match) {
        seen.add(tk);
        unique.push(match);
      }
    }
    return unique;
  }

  function getRelatedByTopic(wordItem) {
    const dict = Array.isArray(window.OXFORD_DICTIONARY) ? window.OXFORD_DICTIONARY : [];
    return dict
      .filter((d) => d.id !== wordItem.id && d.tp === wordItem.tp && d.lv === wordItem.lv)
      .slice(0, 4)
      .map((d) => `\`${d.w}\` (${d.vi})`);
  }

  // Adapter ready to switch to NestJS + Gemini API:
  // async function requestAiReply(prompt) { const res = await fetch('/api/chat/messages', ...); ... }
  async function requestAiReply(userText) {
    await new Promise((r) => setTimeout(r, 420));

    const lower = userText.toLowerCase();
    const matched = findDictionaryWords(userText);
    const dict = Array.isArray(window.OXFORD_DICTIONARY) ? window.OXFORD_DICTIONARY : [];

    // 1. Comparing 2 English words (e.g. "Phân biệt peaceful và calm")
    if ((lower.includes("phân biệt") || lower.includes("khác gì") || lower.includes("so sánh")) && matched.length >= 2) {
      const [w1, w2] = matched;
      return {
        text: [
          `So sánh nhanh giữa **${w1.w}** và **${w2.w}** (chuẩn Oxford 3000):`,
          `- **${w1.w}** \`${w1.ipa}\` (${w1.pos}, **${w1.lv}**): ${w1.vi}.`,
          w1.en ? `- Ví dụ: *${w1.en}* (${w1.ev})` : "",
          `- **${w2.w}** \`${w2.ipa}\` (${w2.pos}, **${w2.lv}**): ${w2.vi}.`,
          w2.en ? `- Ví dụ: *${w2.en}* (${w2.ev})` : "",
          `**Mẹo phân biệt nhanh:** Hãy để ý sắc thái ngữ cảnh & loại từ (\`${w1.pos}\` vs \`${w2.pos}\`). Khi nói về chủ đề *${w1.tp}*, dùng **${w1.w}** sẽ tự nhiên hơn; còn trong ngữ cảnh *${w2.tp}* ưu tiên **${w2.w}**.`
        ]
          .filter(Boolean)
          .join("\n"),
        words: [w1.w, w2.w]
      };
    }

    // 2. Prepositions / Collocations question
    if ((lower.includes("giới từ") || lower.includes("collocation") || lower.includes("đi kèm")) && matched.length >= 1) {
      const w = matched[0];
      const tips = PREPOSITION_TIPS[w.w.toLowerCase()] || [
        `**${w.w}** (${w.pos}) thường dùng trong chủ đề *${w.tp}*.`,
        `Đọc kỹ câu mẫu chuẩn để ghi nhớ cụm đi kèm: *${w.en || `We often use "${w.w}" in everyday communication.`}*`,
        `Mẹo: Hãy lưu **${w.w}** vào Sổ từ và ôn ở chế độ **Gõ từ (Typing)** để nhớ cụm tự nhiên.`
      ];
      return {
        text: [
          `Cách dùng giới từ & cụm từ đi kèm với **${w.w}** \`${w.ipa}\` (${w.vi}):`,
          ...tips.map((t) => `- ${t}`),
          w.ev ? `Dịch câu chuẩn: *${w.ev}*` : ""
        ]
          .filter(Boolean)
          .join("\n"),
        words: [w.w]
      };
    }

    // 3. Asking for 3 workplace / real-life examples
    if ((lower.includes("ví dụ") || lower.includes("công sở") || lower.includes("đặt câu")) && matched.length >= 1) {
      const w = matched[0];
      const word = w.w;
      const extraExamples = [
        `1. *${w.en || `We discussed how to use "${word}" effectively in our meeting.`}* (${w.ev || "Ví dụ ngữ cảnh thực tế."})`,
        `2. *Our team needs a clear plan regarding **${word}** before Friday's review.* (Nhóm chúng tôi cần kế hoạch rõ ràng liên quan đến "${w.vi}" trước buổi đánh giá thứ Sáu.)`,
        `3. *Understanding **${word}** helps you communicate more confidently at work.* (Hiểu rõ từ "${word}" giúp bạn giao tiếp tự tin hơn nơi công sở.)`
      ];
      return {
        text: [
          `Dưới đây là 3 ví dụ thực tế với từ **${word}** \`${w.ipa}\` (${w.pos} · **${w.lv}** — *${w.vi}*):`,
          ...extraExamples.map((e) => `- ${e}`),
          `Bạn có thể thử tự viết 1 câu bằng tiếng Anh chứa từ **${word}** gửi lại đây để mình góp ý nhé!`
        ].join("\n"),
        words: [word]
      };
    }

    // 4. Study plan / B2 / Streak / SM-2 guidance
    if (lower.includes("lộ trình") || lower.includes("mục tiêu") || lower.includes("kế hoạch") || lower.includes("đạt b2")) {
      const xp = window.LexiTagXP ? window.LexiTagXP.get() : 2450;
      return {
        text: [
          `Gợi ý lộ trình tối ưu theo tiến độ hiện tại của bạn (**${xp.toLocaleString("en-US")} XP**, mục tiêu **25 từ/ngày**):`,
          `- **Sáng (10 phút):** Mở mục **Ôn tập → Ôn thẻ SRS (SM-2)** để giải quyết toàn bộ thẻ đến hạn ở Hộp 1–2.`,
          `- **Chiều (15 phút):** Học 1 bài mới trong **Khóa học** (15–18 từ), lật thẻ nghe phát âm và thử **Luyện phát âm AI**.`,
          `- **Tối trước 21:00 (10 phút):** Làm nhanh 1 phiên **Gõ từ (Typing)** hoặc **Nghe chép (Dictation)** đạt **≥ 80%** để chốt chuỗi Streak + nhận thưởng \`+20 XP\`!`,
          `Duy trì đều 25 từ/ngày, bạn sẽ phủ trọn mốc **B2 Oxford 3000** trong khoảng 10–12 tuần.`
        ].join("\n"),
        words: []
      };
    }

    // 5. General lookup of any Oxford 3000 English word found in message
    if (matched.length >= 1) {
      const w = matched[0];
      const related = getRelatedByTopic(w);
      return {
        text: [
          `**${w.w}** \`${w.ipa || "/—/"}\` · Loại từ: **${w.pos || "vocab"}** · Cấp độ: **${w.lv}**`,
          `- **Nghĩa tiếng Việt:** ${w.vi}`,
          w.en ? `- **Ví dụ:** *${w.en}*\n- **Dịch:** ${w.ev}` : "",
          `- **Chủ đề:** ${w.tp}`,
          related.length ? `- **Từ cùng chủ đề:** ${related.join(", ")}` : "",
          `Bạn muốn mình lấy thêm *3 ví dụ công sở* hay *phân biệt từ đồng nghĩa* với **${w.w}** không?`
        ]
          .filter(Boolean)
          .join("\n"),
        words: [w.w]
      };
    }

    // 6. Search by Vietnamese meaning in Oxford 3000
    const viHit = dict.find((d) => lower.length >= 3 && d.vi.toLowerCase().includes(lower.replace(/nghĩa của|tiếng anh là gì|\?/g, "").trim()));
    if (viHit) {
      return {
        text: [
          `Từ tiếng Anh phù hợp nhất trong Oxford 3000 là **${viHit.w}** \`${viHit.ipa}\` (**${viHit.lv}**, ${viHit.pos}):`,
          `- **Nghĩa đầy đủ:** ${viHit.vi}`,
          viHit.en ? `- **Ví dụ:** *${viHit.en}* (${viHit.ev})` : ""
        ]
          .filter(Boolean)
          .join("\n"),
        words: [viHit.w]
      };
    }

    // 7. Helpful fallback guiding user on what AI Tutor can do
    return {
      text: [
        `Mình đã nhận câu hỏi: *"${userText}"*.`,
        `Hiện tại Trợ lý AI đang hoạt động ở chế độ **Oxford 3000 cục bộ (3,813 từ)** (sẵn sàng nối Gemini API khi bật Backend). Bạn có thể hỏi ngay các mẫu sau:`,
        `- *"Giải thích từ **environment**"* (nhập bất kỳ từ tiếng Anh nào)`,
        `- *"Phân biệt **peaceful** và **calm**"*`,
        `- *"Cho 3 ví dụ công sở với **achieve**"*`,
        `- *"Cách dùng giới từ đi kèm **opportunity**"*`,
        `- *"Lên lộ trình ôn 25 từ/ngày để đạt B2"*`
      ].join("\n"),
      words: []
    };
  }

  function speakWord(w) {
    if (!w || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(w);
      u.lang = "en-US";
      window.speechSynthesis.speak(u);
    } catch {
      // ignore
    }
  }

  function renderSidebar() {
    const listEl = document.getElementById("aiConvList");
    if (!listEl) return;
    listEl.innerHTML = conversations
      .map(
        (c) => `
        <div class="ai-conv-item${c.id === activeId ? " active" : ""}" role="button" tabindex="0" data-ai-conv="${escapeHtml(c.id)}">
          <div class="ai-conv-copy">
            <strong>${escapeHtml(c.title)}</strong>
            <small>${c.messages.length} tin nhắn · ${escapeHtml(c.updatedAt)}</small>
          </div>
          <button class="ai-conv-del" type="button" data-ai-del="${escapeHtml(c.id)}" title="Xóa hội thoại" aria-label="Xóa hội thoại">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>`
      )
      .join("");
  }

  function renderMessages() {
    const box = document.getElementById("aiMessagesBox");
    if (!box) return;
    const conv = getActiveConv();

    if (!conv.messages.length && !isTyping) {
      box.innerHTML = `
        <div class="ai-welcome">
          <span class="ai-welcome-badge">
            <span class="material-symbols-outlined" style="font-size:16px;">auto_awesome</span>
            <span>LexiTag AI Tutor · Nối sẵn 3,813 từ Oxford 3000</span>
          </span>
          <h3>Hôm nay bạn muốn hỏi gì về tiếng Anh?</h3>
          <p>Hỏi nhanh nghĩa từ, phân biệt từ đồng nghĩa, giới từ đi kèm hoặc xin thêm ví dụ giao tiếp thực tế.</p>
          <div class="ai-prompts-grid">
            <button class="ai-prompt-card" type="button" data-ai-prompt="Phân biệt peaceful và calm?">
              <strong>Phân biệt từ đồng nghĩa</strong>
              <span>"Phân biệt peaceful và calm?"</span>
            </button>
            <button class="ai-prompt-card" type="button" data-ai-prompt="Cho 3 ví dụ công sở với từ achieve">
              <strong>Ví dụ giao tiếp công sở</strong>
              <span>"Cho 3 ví dụ công sở với từ achieve"</span>
            </button>
            <button class="ai-prompt-card" type="button" data-ai-prompt="Cách dùng giới từ đi kèm opportunity?">
              <strong>Giới từ &amp; Collocations</strong>
              <span>"Cách dùng giới từ đi kèm opportunity?"</span>
            </button>
            <button class="ai-prompt-card" type="button" data-ai-prompt="Lên lộ trình ôn 25 từ/ngày để đạt B2">
              <strong>Tư vấn lộ trình học B2</strong>
              <span>"Lên lộ trình ôn 25 từ/ngày để đạt B2"</span>
            </button>
          </div>
        </div>`;
      return;
    }

    const userInitials = (document.getElementById("sidebarUserName")?.textContent || "NA")
      .trim()
      .split(/\s+/)
      .map((p) => p[0])
      .slice(-2)
      .join("")
      .toUpperCase() || "NA";

    let html = conv.messages
      .map((m) => {
        const isUser = m.role === "user";
        const words = Array.isArray(m.words) ? m.words : [];
        return `
          <div class="ai-msg ${isUser ? "user" : "bot"}">
            <div class="ai-msg-avatar">${isUser ? escapeHtml(userInitials) : '<span class="material-symbols-outlined" style="font-size:18px;">smart_toy</span>'}</div>
            <div>
              <div class="ai-msg-bubble">
                ${isUser ? `<p>${escapeHtml(m.text)}</p>` : formatMarkdown(m.text)}
                ${
                  !isUser && words.length
                    ? `<div class="ai-msg-actions">
                        ${words
                          .map(
                            (w) => `
                            <button class="ai-action-chip" type="button" data-ai-speak="${escapeHtml(w)}">
                              <span class="material-symbols-outlined">volume_up</span>
                              <span>Nghe "${escapeHtml(w)}"</span>
                            </button>
                            <button class="ai-action-chip" type="button" data-ai-dict="${escapeHtml(w)}">
                              <span class="material-symbols-outlined">find_in_page</span>
                              <span>Tra "${escapeHtml(w)}"</span>
                            </button>`
                          )
                          .join("")}
                      </div>`
                    : ""
                }
              </div>
              <span class="ai-msg-time">${escapeHtml(m.time || "")}</span>
            </div>
          </div>`;
      })
      .join("");

    if (isTyping) {
      html += `
        <div class="ai-msg bot">
          <div class="ai-msg-avatar"><span class="material-symbols-outlined" style="font-size:18px;">smart_toy</span></div>
          <div class="ai-msg-bubble">
            <span class="ai-typing"><span></span><span></span><span></span></span>
          </div>
        </div>`;
    }

    box.innerHTML = html;
    box.scrollTop = box.scrollHeight;
  }

  async function sendMessage(rawText) {
    const text = String(rawText || "").trim();
    if (!text || isTyping) return;
    const conv = getActiveConv();

    if (conv.messages.length === 0) {
      conv.title = text.length > 34 ? `${text.slice(0, 34)}…` : text;
    }
    conv.messages.push({ role: "user", text, time: nowTimeStr() });
    conv.updatedAt = nowTimeStr();
    // Move active conversation to top
    conversations = [conv, ...conversations.filter((c) => c.id !== conv.id)].slice(0, 20);
    saveConversations();

    const input = document.getElementById("aiChatInput");
    if (input) {
      input.value = "";
      input.style.height = "auto";
    }

    isTyping = true;
    renderSidebar();
    renderMessages();

    const reply = await requestAiReply(text);
    isTyping = false;
    conv.messages.push({
      role: "assistant",
      text: reply.text,
      words: reply.words || [],
      time: nowTimeStr()
    });
    conv.updatedAt = nowTimeStr();
    saveConversations();
    renderSidebar();
    renderMessages();
  }

  function bindEvents() {
    const newBtn = document.getElementById("aiNewChatBtn");
    const convList = document.getElementById("aiConvList");
    const msgBox = document.getElementById("aiMessagesBox");
    const form = document.getElementById("aiChatForm");
    const input = document.getElementById("aiChatInput");
    const quickBar = document.getElementById("aiQuickBar");

    if (newBtn) {
      newBtn.addEventListener("click", () => {
        const fresh = createEmptyConversation();
        conversations.unshift(fresh);
        activeId = fresh.id;
        saveConversations();
        renderSidebar();
        renderMessages();
        if (input) input.focus();
      });
    }

    if (convList) {
      convList.addEventListener("click", (e) => {
        const delBtn = e.target.closest("[data-ai-del]");
        if (delBtn) {
          e.stopPropagation();
          const delId = delBtn.dataset.aiDel;
          conversations = conversations.filter((c) => c.id !== delId);
          if (!conversations.length) conversations = [createEmptyConversation()];
          if (activeId === delId) activeId = conversations[0].id;
          saveConversations();
          renderSidebar();
          renderMessages();
          return;
        }
        const item = e.target.closest("[data-ai-conv]");
        if (item) {
          activeId = item.dataset.aiConv;
          renderSidebar();
          renderMessages();
        }
      });
    }

    if (msgBox) {
      msgBox.addEventListener("click", (e) => {
        const promptBtn = e.target.closest("[data-ai-prompt]");
        if (promptBtn) {
          sendMessage(promptBtn.dataset.aiPrompt);
          return;
        }
        const speakBtn = e.target.closest("[data-ai-speak]");
        if (speakBtn) {
          speakWord(speakBtn.dataset.aiSpeak);
          return;
        }
        const dictBtn = e.target.closest("[data-ai-dict]");
        if (dictBtn && typeof window.openDictionarySearch === "function") {
          window.openDictionarySearch(dictBtn.dataset.aiDict);
        }
      });
    }

    if (quickBar) {
      quickBar.addEventListener("click", (e) => {
        const chip = e.target.closest("[data-ai-quick]");
        if (chip) sendMessage(chip.dataset.aiQuick);
      });
    }

    if (form && input) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        sendMessage(input.value);
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          sendMessage(input.value);
        }
      });
      input.addEventListener("input", () => {
        input.style.height = "auto";
        input.style.height = `${Math.min(120, input.scrollHeight)}px`;
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    renderSidebar();
    renderMessages();
  });
})();
