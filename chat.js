/*
 * DLS KIT LAND — External Chatbot Client
 * UI + client logic live here, not in index.html.
 * The OpenAI key is NEVER placed in this file.
 */
(() => {
  "use strict";

  const API_URL = "/api/chat";
  const LANG_KEY = "dls_kit_land_language_v1";
  const HISTORY_KEY = "dls_kit_land_ai_history_v1";
  const MAX_HISTORY = 10;

  const state = {
    messages: [],
    apiAvailable: true,
    busy: false,
  };

  function getLanguage() {
    try {
      return localStorage.getItem(LANG_KEY) === "en" ? "en" : "fa";
    } catch {
      return document.documentElement.lang === "en" ? "en" : "fa";
    }
  }

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[يى]/g, "ی")
      .replace(/[ك]/g, "ک")
      .replace(/[ۀة]/g, "ه")
      .replace(/[إأآ]/g, "ا")
      .replace(/[\u064B-\u065F\u0670]/g, "")
      .replace(/[!?؟،,.;:()[\]{}"'`]/g, " ")
      .replace(/[_\-+/|]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Same virtual-pattern local engine as the previous version, kept as a safe fallback.
  const intents = [
    ["وارد کردن کیت", "وارد", "نصب", "اضافه", "کیت", "دانلود"],
    ["اندازه کیت", "سایز", "اندازه", "ابعاد", "512", "کیت"],
    ["کیت اول و دوم", "اول", "دوم", "home", "away", "فرق", "کیت"],
    ["کیت سوم", "سوم", "third", "کیت"],
    ["کیت دروازه بان", "دروازه", "گلر", "goalkeeper", "gk", "کیت"],
    ["لینک مستقیم", "لینک", "url", "مستقیم", "کپی", "کیت"],
    ["لوگو", "لوگو", "نشان", "باشگاه"],
    ["قالب کیت", "قالب", "الگو", "template", "قطعه", "کیت"],
    ["پس زمینه", "شفاف", "پس‌زمینه", "background", "png"],
    ["جستجوی کیت", "جستجو", "پیدا", "تیم", "کیت", "فصل"],
    ["کیت سفارشی", "سفارشی", "اختصاصی", "دلخواه", "طراحی", "بساز", "کیت"],
    ["سایت", "سایت", "dls", "kit", "land"],
    ["رفع مشکل کیت", "خطا", "خراب", "نمیاد", "نمایش", "کار", "کیت"],
    ["سلام", "سلام", "درود", "hello", "hi"],
    ["تشکر", "ممنون", "مرسی", "تشکر", "دمت"],
    ["راهنما", "کمک", "راهنما", "بلدی", "سوال"]
  ];

  const answers = {
    "وارد کردن کیت": "برای وارد کردن کیت DLS 2019 به بخش ویرایش کیت برو و URL مستقیم PNG کیت را وارد کن.",
    "اندازه کیت": "قالب رایج کیت DLS 2019 در این سایت 512×512 پیکسل است.",
    "کیت اول و دوم": "Home معمولاً کیت اول و Away معمولاً کیت دوم است؛ Third هم کیت سوم است.",
    "کیت سوم": "Third Kit کیت سوم تیم است و برای بعضی مسابقات به‌عنوان لباس جایگزین استفاده می‌شود.",
    "کیت دروازه بان": "کیت دروازه‌بان مخصوص دروازه‌بان است و با کیت بازیکنان تفاوت دارد.",
    "لینک مستقیم": "برای DLS به URL مستقیم تصویر PNG نیاز داری؛ لینک باید مستقیماً فایل تصویر را باز کند.",
    "لوگو": "برای لوگو باید تصویر مناسب و لینک مستقیم آن را داشته باشی و از بخش Edit Logo بازی استفاده کنی.",
    "قالب کیت": "قالب DLS محل قرارگیری قطعات بدنه، آستین، شورت و جوراب است؛ قطعات نباید جابه‌جا شوند.",
    "پس زمینه": "برای بافت تمیز DLS بهتر است پس‌زمینه اضافی نداشته باشد و خروجی PNG باشد.",
    "جستجوی کیت": "نام تیم، فصل و نوع کیت را وارد کن؛ مثلاً Barcelona 2026/27 Home.",
    "کیت سفارشی": "برای کیت سفارشی نام تیم، فصل، رنگ، طرح، نوع کیت و لوگو یا اسپانسر موردنظر را مشخص کن.",
    "سایت": "DLS KIT LAND برای آرشیو کیت‌های Dream League Soccer 2019 ساخته شده است.",
    "رفع مشکل کیت": "اگر کیت کار نمی‌کند، URL مستقیم، PNG بودن تصویر و سازگاری آن با قالب DLS را بررسی کن.",
    "سلام": "سلام داداش 🤜🤛 من DLS AI هستم. اسم تیم، فصل یا سؤال DLS 2019 را بگو.",
    "تشکر": "قربانت داداش 🤝 هر سؤال دیگری درباره DLS KIT LAND یا کیت‌های DLS 2019 داشتی بپرس.",
    "راهنما": "درباره تیم، کیت، فصل، Home/Away/Third، لینک مستقیم، قالب، اندازه، لوگو و وارد کردن کیت سؤال کن."
  };

  const englishAnswers = {
    "وارد کردن کیت": "To add a DLS 2019 kit, open the kit editor and enter the direct PNG image URL.",
    "اندازه کیت": "The common DLS 2019 kit texture size used by this site is 512×512 pixels.",
    "کیت اول و دوم": "Home is usually the first kit and Away is usually the second. Third is the third kit.",
    "کیت سوم": "The Third Kit is the team's third uniform and can be used as an alternative kit.",
    "کیت دروازه بان": "The goalkeeper kit is made for the goalkeeper and is separate from player kits.",
    "لینک مستقیم": "For DLS, use a direct PNG image URL. The link should open the image file directly.",
    "لوگو": "For a logo, use a suitable image with a direct URL and add it through the game's Edit Logo section.",
    "قالب کیت": "The DLS kit template defines the positions of the shirt, sleeves, shorts, and socks. Do not move the pieces.",
    "پس زمینه": "For a clean DLS texture, avoid extra background objects and use a PNG output.",
    "جستجوی کیت": "Search by team name, season, and kit type. For example: Barcelona 2026/27 Home.",
    "کیت سفارشی": "For a custom kit, provide the team, season, colors, design details, and kit type.",
    "سایت": "DLS KIT LAND is a Dream League Soccer 2019 kit archive with team pages, kit details, search, favorites, and DLS AI.",
    "رفع مشکل کیت": "If a kit does not appear correctly, check the PNG URL, 512×512 size, transparent/background-free texture, and DLS template layout.",
    "سلام": "Hello! 👊 Tell me a team, season, kit type, or DLS question.",
    "تشکر": "You're welcome! 👊",
    "راهنما": "I can help with DLS 2019 kits, sizes, templates, direct links, team searches, custom kits, and site features."
  };

  const teams = [
    "بارسلونا","رئال مادرید","اینتر","میلان","یوونتوس","پاری سن ژرمن",
    "منچسترسیتی","منچستریونایتد","لیورپول","آرسنال","چلسی","بایرن مونیخ",
    "دورتموند","پرسپولیس","استقلال","سپاهان","تراکتور","الهلال","النصر",
    "اتلتیکو مادرید","ناپولی","رم","لاتزیو","آژاکس","فاینورد"
  ];

  function localAnswer(input) {
    const q = normalize(input);
    if (!q) return getLanguage() === "en" ? "Your message is empty 😄 Type a question or team name." : "پیامت خالیه داداش 😄 سؤال یا نام تیم را بنویس.";

    let best = null, bestScore = 0;
    for (const item of intents) {
      let score = 0;
      for (const k of item.slice(1)) {
        const n = normalize(k);
        if (q.includes(n)) score += n.length >= 4 ? 4 : 2;
      }
      if (score > bestScore) { bestScore = score; best = item[0]; }
    }

    const team = teams.find(x => q.includes(normalize(x)));
    if (team && (q.includes("کیت") || q.includes("لباس") || q.includes("لینک") || q.includes("پیدا"))) {
      return getLanguage() === "en"
        ? `For ${team}, also specify the season and kit type, for example: "${team} 2026/27 Home".`
        : `برای ${team}، فصل و نوع کیت را هم مشخص کن؛ مثلاً «${team} 2026/27 Home».`;
    }

    const english = getLanguage() === "en" || /[a-z]{3,}/i.test(String(input));
    return bestScore >= 2
      ? (english ? englishAnswers[best] : answers[best])
      : (english ? "For a more accurate answer, specify the team, season, kit type, or question topic." : "برای جواب دقیق‌تر، نام تیم، فصل، نوع کیت یا موضوع سؤال را مشخص‌تر بنویس.");
  }

  function loadHistory() {
    try {
      const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      state.messages = Array.isArray(parsed) ? parsed.slice(-MAX_HISTORY) : [];
    } catch { state.messages = []; }
  }

  function saveHistory() {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(state.messages.slice(-MAX_HISTORY))); } catch {}
  }

  function buildUI() {
    if (document.getElementById("dlsChatRoot")) return;
    const root = document.createElement("div");
    root.id = "dlsChatRoot";
    root.innerHTML = `
      <button class="ai-fab" id="aiButton" type="button" aria-label="DLS AI">
        <span class="ai-fab-logo">AI</span>
      </button>
      <section class="ai-window" id="aiWindow" aria-label="DLS AI">
        <div class="ai-head">
          <div class="ai-head-main"><span class="ai-status" id="aiStatus"></span><strong>DLS AI</strong></div>
          <button class="icon-btn" id="aiClose" type="button" aria-label="Close">×</button>
        </div>
        <div class="ai-messages" id="aiMessages"></div>
        <div class="ai-input">
          <input class="control" id="aiInput" autocomplete="off" placeholder="مثلاً کیت بارسا رو پیدا کن">
          <button class="btn btn-primary" id="aiSend" type="button">ارسال</button>
        </div>
      </section>`;
    document.body.appendChild(root);
  }

  function addMessage(text, type = "bot", extraClass = "") {
    const box = document.getElementById("aiMessages");
    if (!box) return null;
    const el = document.createElement("div");
    el.className = `ai-msg ${type} ${extraClass}`.trim();
    el.textContent = text;
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
    return el;
  }

  function setAPIStatus(available) {
    state.apiAvailable = available;
    const dot = document.getElementById("aiStatus");
    if (dot) dot.classList.toggle("api-offline", !available);
  }

  async function checkAPI() {
    try {
      const r = await fetch(`${API_URL}?action=health`, { cache: "no-store" });
      const data = await r.json().catch(() => ({}));
      setAPIStatus(r.ok && data.ok === true);
    } catch {
      setAPIStatus(false);
    }
  }

  async function askAPI(message) {
    const recent = state.messages.slice(-MAX_HISTORY).map(m => ({ role: m.role, content: m.content }));
    const r = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ message, history: recent })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.ok) throw new Error(data.error || "AI API request failed");
    return String(data.reply || data.output || "").trim();
  }

  async function send() {
    const input = document.getElementById("aiInput");
    if (!input || state.busy) return;
    const value = input.value.trim();
    if (!value) return;

    state.busy = true;
    addMessage(value, "user");
    state.messages.push({ role: "user", content: value });
    input.value = "";

    const loading = addMessage(getLanguage() === "en" ? "Thinking…" : "دارم جواب رو آماده می‌کنم…", "bot", "loading");
    try {
      let reply;
      try {
        reply = await askAPI(value);
        setAPIStatus(true);
      } catch (error) {
        setAPIStatus(false);
        reply = localAnswer(value);
      }
      if (loading) loading.remove();
      addMessage(reply || localAnswer(value), "bot");
      state.messages.push({ role: "assistant", content: reply || localAnswer(value) });
      saveHistory();
    } finally {
      state.busy = false;
      input.focus();
    }
  }

  function toggle() {
    const win = document.getElementById("aiWindow");
    if (!win) return;
    win.classList.toggle("open");
    if (win.classList.contains("open")) {
      const box = document.getElementById("aiMessages");
      if (box && !box.children.length) {
        addMessage(getLanguage() === "en" ? "Hello! I’m DLS AI. Ask me about kits, teams, seasons, links, or DLS KIT LAND." : "سلام! من DLS AI هستم. درباره کیت، تیم، فصل، لینک یا امکانات سایت بپرس.", "bot");
        for (const m of state.messages) addMessage(m.content, m.role === "user" ? "user" : "bot");
      }
      document.getElementById("aiInput")?.focus();
    }
  }

  function updateLanguageUI() {
    const en = getLanguage() === "en";
    const input = document.getElementById("aiInput");
    const sendButton = document.getElementById("aiSend");
    if (input) input.placeholder = en ? "e.g. Find the Barcelona kit" : "مثلاً کیت بارسا رو پیدا کن";
    if (sendButton) sendButton.textContent = en ? "Send" : "ارسال";
  }

  function init() {
    buildUI();
    loadHistory();
    document.getElementById("aiButton")?.addEventListener("click", toggle);
    document.getElementById("aiClose")?.addEventListener("click", () => document.getElementById("aiWindow")?.classList.remove("open"));
    document.getElementById("aiSend")?.addEventListener("click", send);
    document.getElementById("aiInput")?.addEventListener("keydown", e => { if (e.key === "Enter") send(); });
    document.getElementById("languageButton")?.addEventListener("click", () => setTimeout(updateLanguageUI, 0));
    updateLanguageUI();
    checkAPI();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
