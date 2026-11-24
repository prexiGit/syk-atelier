/* THE SYK ATELIER — shared helpers for every page. */
(function () {
  "use strict";

  const CFG = window.SYK_CONFIG || {};
  const isConfigured = Boolean(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase);
  const BUCKET = "certificates";

  const siteUrl = () => (CFG.SITE_URL || window.location.origin).replace(/\/+$/, "");
  const verifyUrl = (id) => `${siteUrl()}/certificate/${encodeURIComponent(id)}`;

  let client = null;
  function db() {
    if (!isConfigured) return null;
    if (!client) {
      client = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true },
      });
    }
    return client;
  }

  /* ---------------- Formatting ---------------- */
  function formatDate(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return "";
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
      day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
    });
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* ---------------- Sample data (preview only, before Supabase is connected) ---------------- */
  const SAMPLES = [
    {
      certificate_id: "SYK-2026-0003", student_name: "Ananya Sharma", father_name: "Rajesh Sharma",
      course_name: "B.Sc. (Home Science)", semester: "VI", roll_number: "2023/HS/1148",
      college_name: "Government College for Women, Jaipur", training_name: "Crochet Product Design Internship",
      start_date: "2026-08-03", end_date: "2026-10-31", hours: 160, academic_year: "2026-27",
      duties: "Designed and produced crochet accessories from pattern to finished piece; prepared yarn and material costing sheets; photographed products for the online catalogue; assisted in packing and dispatch of customer orders.",
      signatory_name: "Founder & Creative Director", signatory_designation: "The SYK Atelier",
      status: "published", issued_at: "2026-11-12T10:00:00Z",
    },
    {
      certificate_id: "SYK-2026-0002", student_name: "Priya Meena", father_name: "Suresh Chand Meena",
      course_name: "B.A.", semester: "IV", roll_number: "BA-24-0632",
      college_name: "Maharani College, Jaipur", training_name: "Handmade Textile & Crochet Internship",
      start_date: "2026-07-01", end_date: "2026-09-15", hours: 128, academic_year: "2026-27",
      duties: "Learned foundation and advanced crochet stitches; produced sample swatches and two complete garments; maintained a daily work diary; supported workshop preparation for walk-in learners.",
      signatory_name: "Founder & Creative Director", signatory_designation: "The SYK Atelier",
      status: "published", issued_at: "2026-09-20T10:00:00Z",
    },
    {
      certificate_id: "SYK-2026-0001", student_name: "Kavya Agarwal", father_name: "Manoj Agarwal",
      course_name: "B.Des. (Fashion Design)", semester: "V", roll_number: "FD-22-017",
      college_name: "Jaipur School of Design", training_name: "Crochet Fashion Studio Internship",
      start_date: "2026-05-04", end_date: "2026-07-10", hours: 136, academic_year: "2025-26",
      duties: "Assisted in developing a crochet capsule collection; created technical sketches and stitch charts; sourced and tested yarns; documented the production process for social media.",
      signatory_name: "Founder & Creative Director", signatory_designation: "The SYK Atelier",
      status: "published", issued_at: "2026-07-18T10:00:00Z",
    },
  ];

  /* ---------------- Data access ---------------- */
  const api = {
    /** Public list: only published certificates, only non-private columns. */
    async listPublished() {
      if (!isConfigured) return SAMPLES.map((s) => ({ ...s, sample: true }));
      const { data, error } = await db().rpc("list_published_certificates");
      if (error) throw error;
      return data || [];
    },
    /** Public verification lookup by certificate ID. Returns null when not found / not published. */
    async getPublished(certificateId) {
      if (!isConfigured) {
        const s = SAMPLES.find((r) => r.certificate_id === certificateId);
        return s ? { ...s, sample: true } : null;
      }
      const { data, error } = await db().rpc("get_published_certificate", { p_certificate_id: certificateId });
      if (error) throw error;
      return (data && data[0]) || null;
    },
    /** Downloads the original saved PDF (never regenerated). */
    async getSavedPdf(record) {
      if (record.sample) return samplePdf(record);
      const { data, error } = await db().storage.from(BUCKET).download(record.pdf_path);
      if (error) throw error;
      return data; // Blob
    },
  };

  /* ---------------- Script loading ---------------- */
  const loaded = {};
  function loadScript(src) {
    if (!loaded[src]) {
      loaded[src] = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src;
        s.onload = resolve;
        s.onerror = () => reject(new Error(`Could not load ${src}`));
        document.head.appendChild(s);
      });
    }
    return loaded[src];
  }

  async function loadPdfTools() {
    await loadScript("/vendor/jspdf-2.5.2.umd.min.js");
    await loadScript("/vendor/qrcode-1.0.0.min.js");
    await loadScript("/js/certificate-pdf.js");
  }

  /** Preview mode only: builds the sample certificate with the same template the admin uses. */
  async function samplePdf(record) {
    await loadPdfTools();
    return window.SYKCertificate.build(record, verifyUrl(record.certificate_id));
  }

  /* ---------------- PDF viewer (pdf.js renders the saved file on every device) ---------------- */
  let pdfjsPromise = null;
  function pdfjs() {
    if (!pdfjsPromise) {
      pdfjsPromise = import("/vendor/pdfjs-4.10.38.min.mjs").then((lib) => {
        lib.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs-4.10.38.worker.min.mjs";
        return lib;
      });
    }
    return pdfjsPromise;
  }

  async function renderPdf(blob, container) {
    container.innerHTML = '<p class="loading">Opening certificate…</p>';
    const lib = await pdfjs();
    const doc = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
    const pages = document.createElement("div");
    pages.className = "pages";
    const width = Math.max(container.clientWidth - 32, 280);
    const ratio = Math.min(window.devicePixelRatio || 1, 2.5);
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: (width / base.width) * ratio });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", `Certificate page ${n}`);
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      pages.appendChild(canvas);
    }
    container.innerHTML = "";
    container.appendChild(pages);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  /* ---------------- Header, menu and footer ---------------- */
  function headerHTML() {
    const store = shopLink(CFG.STORE_URL, "Shop Now");
    const cart = shopLink(CFG.CART_URL, "Cart");
    return `
      <div class="container wide bar">
        <a class="wordmark" href="/" aria-label="The SYK Atelier, India — home">
          <span class="name">The SYK Atelier</span><span class="place">India</span>
        </a>
        <button class="menu-toggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="site-menu">
          <span class="lines"><span></span><span></span></span>
        </button>
        <nav class="header-links" aria-label="Shop">${store}${cart}</nav>
      </div>
      <div class="menu-panel" id="site-menu" role="dialog" aria-modal="true" aria-label="Menu">
        <div class="container wide bar">
          <a class="wordmark" href="/"><span class="name">The SYK Atelier</span><span class="place">India</span></a>
          <button class="menu-close" type="button" aria-label="Close menu"></button>
          <span></span>
        </div>
        <div class="container">
          <ul class="menu-list">
            <li><a href="/">Home</a></li>
            <li><a href="/internships.html">Internship Opportunities</a></li>
            ${CFG.STORE_URL ? `<li><a href="${esc(CFG.STORE_URL)}">Yojan Store</a></li>` : ""}
            ${CFG.CART_URL ? `<li><a href="${esc(CFG.CART_URL)}">Cart</a></li>` : ""}
          </ul>
        </div>
        <div class="container menu-foot">Handmade. Timeless. Yours.</div>
      </div>`;
  }

  /**
   * Store / cart links come only from config.js. Until the client gives a real
   * destination, the link is shown for the design but goes nowhere ("coming soon").
   */
  function shopLink(url, label, cls = "") {
    if (url) return `<a class="${cls}" href="${esc(url)}">${label}</a>`;
    return `<a class="${cls} is-unset" role="link" aria-disabled="true" title="Link coming soon">${label}</a>`;
  }

  function initHeader() {
    const header = document.querySelector("[data-site-header]");
    if (!header) return;
    header.className = "site-header" + (header.dataset.siteHeader === "solid" ? " is-solid" : "");
    header.innerHTML = headerHTML();
    const panel = header.querySelector(".menu-panel");
    const toggle = header.querySelector(".menu-toggle");
    const close = header.querySelector(".menu-close");
    const open = (state) => {
      panel.classList.toggle("is-open", state);
      toggle.setAttribute("aria-expanded", String(state));
      document.body.style.overflow = state ? "hidden" : "";
      (state ? close : toggle).focus();
    };
    toggle.addEventListener("click", () => open(true));
    close.addEventListener("click", () => open(false));
    panel.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => open(false)));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && panel.classList.contains("is-open")) open(false);
    });
  }

  function initFooter() {
    const f = document.querySelector("[data-site-footer]");
    if (!f) return;
    f.className = "site-footer";
    f.innerHTML = `
      <div class="container wide row">
        <p><span class="brand">The SYK Atelier</span> · India</p>
        <p>© ${new Date().getFullYear()} The SYK Atelier. Handmade with care.</p>
      </div>`;
  }

  function initPreviewNotice() {
    if (isConfigured || !document.body.hasAttribute("data-preview-notice")) return;
    const n = document.createElement("div");
    n.className = "notice";
    n.textContent = "Design preview: Supabase is not connected yet, so sample records are shown.";
    document.body.prepend(n);
    document.body.style.paddingBottom = "48px";
  }

  /* ---------------- Modal focus handling ---------------- */
  function trapFocus(root, onClose) {
    const onKey = (e) => {
      if (e.key === "Escape") return onClose();
      if (e.key !== "Tab") return;
      const items = root.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }


  /* ---------------- Emblem + sparkles (decorative) ---------------- */
  let emblemSeq = 0;
  function emblemSVG(kind) {
    const id = `em${++emblemSeq}`;
    const hex = (r) => {
      const pts = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        pts.push(`${(60 + r * Math.cos(a)).toFixed(2)},${(66 + r * Math.sin(a)).toFixed(2)}`);
      }
      return pts.join(" ");
    };
    let center;
    if (kind === "valid") {
      center = `<path d="M44 67l11 11 22-24" fill="none" stroke="url(#${id}g)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;
    } else if (kind === "invalid") {
      center = `<path d="M47 53l26 26M73 53L47 79" fill="none" stroke="#c97a68" stroke-width="7" stroke-linecap="round"/>`;
    } else {
      // crochet flower: eight petals around a ring
      let petals = "";
      for (let i = 0; i < 8; i++) {
        petals += `<ellipse cx="60" cy="49" rx="6.2" ry="12" transform="rotate(${i * 45} 60 66)" fill="url(#${id}g)" opacity="${i % 2 ? 0.75 : 1}"/>`;
      }
      center = `${petals}<circle cx="60" cy="66" r="7.5" fill="#2a2420" stroke="url(#${id}g)" stroke-width="2.5"/><circle cx="60" cy="66" r="2.4" fill="url(#${id}g)"/>`;
    }
    return `
      <svg viewBox="0 0 120 132" aria-hidden="true">
        <defs>
          <linearGradient id="${id}r" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#e8cfae"/><stop offset=".35" stop-color="#b08d68"/><stop offset=".7" stop-color="#8a6a4a"/><stop offset="1" stop-color="#5e4530"/>
          </linearGradient>
          <linearGradient id="${id}i" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#4a3f35"/><stop offset="1" stop-color="#211f1c"/>
          </linearGradient>
          <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#f1dcc0"/><stop offset=".5" stop-color="#c9a57e"/><stop offset="1" stop-color="#9b7853"/>
          </linearGradient>
        </defs>
        <polygon points="${hex(58)}" fill="url(#${id}r)"/>
        <polygon points="${hex(52)}" fill="none" stroke="#f6e7d2" stroke-opacity=".55" stroke-width="1.2"/>
        <polygon points="${hex(45)}" fill="url(#${id}i)"/>
        <polygon points="${hex(41)}" fill="none" stroke="url(#${id}g)" stroke-opacity=".6" stroke-width="1"/>
        ${center}
        <path d="M22 40 L60 18 L98 40" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2" stroke-linecap="round"/>
      </svg>`;
  }

  const STAR = '<svg viewBox="0 0 24 24"><path d="M12 0 L14 10 L24 12 L14 14 L12 24 L10 14 L0 12 L10 10 Z" fill="currentColor"/></svg>';
  function sparklesHTML() {
    const spots = [
      [8, 18, 30, 0], [88, 12, 18, 1.4], [94, 46, 34, 0.6], [4, 58, 16, 2.2],
      [78, 78, 14, 1.1], [16, 86, 22, 2.8], [62, 6, 12, 3.4],
    ];
    return `<div class="sparkles" aria-hidden="true">${spots
      .map(([x, y, sz, d]) => `<span class="sparkle" style="left:${x}%;top:${y}%;width:${sz}px;height:${sz}px;animation-delay:${d}s">${STAR}</span>`)
      .join("")}</div>`;
  }

  function initDecor() {
    document.querySelectorAll("[data-emblem]").forEach((el) => {
      el.classList.add("emblem");
      el.innerHTML = emblemSVG(el.dataset.emblem);
    });
    document.querySelectorAll("[data-sparkles]").forEach((el) => el.insertAdjacentHTML("afterbegin", sparklesHTML()));
  }

  function initials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    return ((parts[0] || "")[0] || "").concat(parts.length > 1 ? parts[parts.length - 1][0] : "").toUpperCase();
  }

  window.SYK = {
    emblemSVG, initDecor, initials,
    shopLink,
    CFG, isConfigured, db, api, BUCKET, siteUrl, verifyUrl, formatDate, esc,
    renderPdf, downloadBlob, loadPdfTools, trapFocus, SAMPLES,
  };

  document.addEventListener("DOMContentLoaded", () => {
    if (!document.body.hasAttribute("data-no-chrome")) {
      initHeader();
      initFooter();
    }
    initPreviewNotice();
    initDecor();
  });
})();
