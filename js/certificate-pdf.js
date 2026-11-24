/*
 * THE SYK ATELIER — internship certificate template (A4 portrait, print-ready).
 * Used by the admin panel to create the ONE original PDF that is stored in Supabase.
 * Requires: jsPDF (window.jspdf) and QRCode.js (window.QRCode).
 *
 * Fields follow the internship certificate requirements shared by the client:
 * student, father's name, course, semester, roll no., college, internship, organisation,
 * start and completion dates, hours, academic year, duties, signature, seal, QR verification.
 */
(function () {
  "use strict";

  const INK = [33, 30, 27];        // #211E1B
  const INK_2 = [98, 88, 78];      // #62584E
  const CARAMEL = [138, 106, 74];  // #8A6A4A
  const CARAMEL_D = [94, 69, 48];  // #5E4530
  const CARAMEL_L = [192, 155, 116];
  const RULE = [214, 199, 180];
  const TINT = [246, 239, 229];
  const PAPER = [255, 253, 249];
  const W = 210;
  const H = 297;
  const M = 21; // content margin (mm)

  function fmtDate(iso) {
    if (!iso) return "";
    const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
      day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
    });
  }

  /* ---------- assets ---------- */
  function qrDataUrl(text) {
    const holder = document.createElement("div");
    holder.style.cssText = "position:fixed;left:-9999px;top:0;";
    document.body.appendChild(holder);
    // eslint-disable-next-line no-new
    new window.QRCode(holder, {
      text, width: 480, height: 480, colorDark: "#211E1B", colorLight: "#FFFFFF",
      correctLevel: window.QRCode.CorrectLevel.M,
    });
    const url = holder.querySelector("canvas").toDataURL("image/png");
    holder.remove();
    return url;
  }

  async function fileDataUrl(src) {
    if (!src) return null;
    try {
      const res = await fetch(src);
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => resolve(null);
        r.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  // Playfair Display (self-hosted TTF). Falls back to Times if a file can't be loaded.
  const FONT_FILES = {
    normal: "/fonts/ttf/playfair-display-latin-400-normal.ttf",
    italic: "/fonts/ttf/playfair-display-latin-400-italic.ttf",
    semibold: "/fonts/ttf/playfair-display-latin-600-normal.ttf",
    bold: "/fonts/ttf/playfair-display-latin-700-normal.ttf",
  };
  let fontCache = null;
  async function loadFonts() {
    if (!fontCache) {
      fontCache = Promise.all(
        Object.entries(FONT_FILES).map(async ([style, url]) => {
          const data = await fileDataUrl(url);
          return data ? [style, data.split(",")[1]] : null;
        }),
      ).then((list) => list.filter(Boolean));
    }
    return fontCache;
  }
  async function registerFonts(doc) {
    const fonts = await loadFonts();
    fonts.forEach(([style, b64]) => {
      doc.addFileToVFS(`Playfair-${style}.ttf`, b64);
      doc.addFont(`Playfair-${style}.ttf`, "Playfair", style);
    });
    const have = new Set(fonts.map(([s]) => s));
    // display(style) → [family, style] with Times fallback
    return (style) => (have.has(style) ? ["Playfair", style] : ["times", style === "italic" ? "italic" : style === "normal" ? "normal" : "bold"]);
  }

  /* ---------- drawing helpers ---------- */
  function tracked(doc, text, x, y, charSpace, align) {
    const w = doc.getTextWidth(text) + charSpace * (text.length - 1);
    const left = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
    doc.text(text, left, y, { charSpace });
    return w;
  }

  function diamond(doc, x, y, r, color) {
    doc.setFillColor(...color);
    doc.triangle(x - r, y, x, y - r, x + r, y, "F");
    doc.triangle(x - r, y, x, y + r, x + r, y, "F");
  }

  function ornamentRule(doc, cx, y, half, gap) {
    doc.setDrawColor(...CARAMEL);
    doc.setLineWidth(0.3);
    doc.line(cx - half, y, cx - gap, y);
    doc.line(cx + gap, y, cx + half, y);
    diamond(doc, cx, y, 1.3, CARAMEL);
    diamond(doc, cx - gap + 0.2, y, 0.55, CARAMEL_L);
    diamond(doc, cx + gap - 0.2, y, 0.55, CARAMEL_L);
  }

  function hexPoints(cx, cy, r) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return pts;
  }
  function polygon(doc, pts, style) {
    const [x0, y0] = pts[0];
    const rel = pts.slice(1).map(([x, y], i) => [x - pts[i][0], y - pts[i][1]]);
    doc.lines(rel, x0, y0, [1, 1], style, true);
  }

  /** Hexagonal emblem with a crochet flower — matches the website emblem. */
  function emblem(doc, cx, cy, r) {
    doc.setFillColor(...CARAMEL);
    polygon(doc, hexPoints(cx, cy, r), "F");
    doc.setDrawColor(...CARAMEL_L);
    doc.setLineWidth(0.25);
    polygon(doc, hexPoints(cx, cy, r * 0.89), "S");
    doc.setFillColor(...INK);
    polygon(doc, hexPoints(cx, cy, r * 0.76), "F");
    doc.setFillColor(...CARAMEL_L);
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i;
      doc.circle(cx + Math.cos(a) * r * 0.4, cy + Math.sin(a) * r * 0.4, r * 0.15, "F");
    }
    doc.setDrawColor(...CARAMEL_L);
    doc.setLineWidth(0.35);
    doc.circle(cx, cy, r * 0.16, "S");
  }

  function corner(doc, x, y, sx, sy) {
    doc.setDrawColor(...CARAMEL);
    doc.setLineWidth(0.5);
    doc.line(x, y, x + sx * 14, y);
    doc.line(x, y, x, y + sy * 14);
    doc.setLineWidth(0.2);
    doc.line(x + sx * 2.2, y + sy * 2.2, x + sx * 8, y + sy * 2.2);
    doc.line(x + sx * 2.2, y + sy * 2.2, x + sx * 2.2, y + sy * 8);
    diamond(doc, x, y, 1.4, CARAMEL);
  }

  /** Paragraph with bold runs, justified to `width`. Returns the next baseline y. */
  function richParagraph(doc, runs, x, y, width, size, lineH) {
    doc.setFontSize(size);
    const words = [];
    runs.forEach((r) => {
      String(r.text).split(/(\s+)/).forEach((w) => {
        if (w !== "") words.push({ text: w, bold: !!r.bold, space: /^\s+$/.test(w) });
      });
    });
    const widthOf = (w) => {
      doc.setFont("times", w.bold ? "bold" : "normal");
      return doc.getTextWidth(w.space ? " " : w.text);
    };
    const lines = [];
    let line = [];
    let lineW = 0;
    words.forEach((w) => {
      const ww = widthOf(w);
      if (!w.space && lineW + ww > width && line.length) {
        while (line.length && line[line.length - 1].space) line.pop();
        lines.push(line);
        line = [];
        lineW = 0;
      }
      if (w.space && !line.length) return;
      line.push(w);
      lineW += ww;
    });
    if (line.length) lines.push(line);
    lines.forEach((ln, i) => {
      const last = i === lines.length - 1;
      const natural = ln.reduce((s, w) => s + widthOf(w), 0);
      const gaps = ln.filter((w) => w.space).length;
      const extra = !last && gaps ? (width - natural) / gaps : 0;
      let cx = last ? x + (width - natural) / 2 : x; // centre the closing line
      ln.forEach((w) => {
        doc.setFont("times", w.bold ? "bold" : "normal");
        if (!w.space) doc.text(w.text, cx, y);
        cx += widthOf(w) + (w.space ? extra : 0);
      });
      y += lineH;
    });
    return y;
  }

  /* ---------- certificate ---------- */
  async function build(rec, verifyUrl) {
    const cfg = window.SYK_CONFIG || {};
    const org = cfg.ORG_NAME || "The SYK Atelier";
    const place = cfg.ORG_PLACE || "India";
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    const display = await registerFonts(doc);
    const font = (style) => doc.setFont(...display(style));
    doc.setProperties({
      title: `Internship Certificate ${rec.certificate_id} – ${rec.student_name}`,
      subject: "Internship Completion Certificate",
      author: org,
      creator: `${org} Certificates`,
    });
    const cx = W / 2;

    // Paper + frame
    doc.setFillColor(...PAPER);
    doc.rect(0, 0, W, H, "F");
    doc.setDrawColor(...CARAMEL_D);
    doc.setLineWidth(1.1);
    doc.rect(6, 6, W - 12, H - 12);
    doc.setDrawColor(...CARAMEL);
    doc.setLineWidth(0.3);
    doc.rect(8.4, 8.4, W - 16.8, H - 16.8);
    corner(doc, 11.5, 11.5, 1, 1);
    corner(doc, W - 11.5, 11.5, -1, 1);
    corner(doc, 11.5, H - 11.5, 1, -1);
    corner(doc, W - 11.5, H - 11.5, -1, -1);

    // Letterhead
    emblem(doc, cx, 21.5, 7.4);
    doc.setTextColor(...INK);
    font("semibold");
    doc.setFontSize(19);
    tracked(doc, org.toUpperCase(), cx, 38.5, 1.0, "center");
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...CARAMEL);
    tracked(doc, place.toUpperCase(), cx, 43.2, 1.6, "center");
    let y = 43.2;
    doc.setTextColor(...INK_2);
    [cfg.ORG_ADDRESS, cfg.ORG_CONTACT].filter(Boolean).forEach((l) => {
      y += 4.2;
      doc.setFontSize(8);
      doc.text(String(l), cx, y, { align: "center" });
    });
    y += 4.2;
    ornamentRule(doc, cx, y, W / 2 - M, 6);

    // Reference row
    y += 7.5;
    doc.setFont("times", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...CARAMEL);
    tracked(doc, "CERTIFICATE NO.", M, y, 0.5);
    tracked(doc, "DATE OF ISSUE", W - M, y, 0.5, "right");
    y += 5;
    doc.setTextColor(...INK);
    font("semibold");
    doc.setFontSize(11);
    doc.text(rec.certificate_id, M, y);
    doc.text(fmtDate((rec.issued_at || new Date().toISOString()).slice(0, 10)), W - M, y, { align: "right" });

    // Title
    y += 10;
    doc.setFont("times", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...CARAMEL);
    tracked(doc, "INTERNSHIP COMPLETION", cx, y, 1.3, "center");
    y += 10;
    doc.setTextColor(...INK);
    font("bold");
    doc.setFontSize(29);
    tracked(doc, "CERTIFICATE", cx, y, 1.3, "center");

    // Recipient
    y += 9;
    font("italic");
    doc.setFontSize(12);
    doc.setTextColor(...INK_2);
    doc.text("This is to certify that", cx, y, { align: "center" });
    y += 10.5;
    font("italic");
    let nameSize = 28;
    doc.setFontSize(nameSize);
    while (nameSize > 16 && doc.getTextWidth(rec.student_name) > W - 2 * M - 20) doc.setFontSize(--nameSize);
    doc.setTextColor(...INK);
    doc.text(rec.student_name, cx, y, { align: "center" });
    y += 4;
    doc.setDrawColor(...CARAMEL);
    doc.setLineWidth(0.35);
    doc.line(cx - 58, y, cx + 58, y);
    diamond(doc, cx - 60, y, 0.9, CARAMEL);
    diamond(doc, cx + 60, y, 0.9, CARAMEL);

    // Statement
    y += 7.5;
    doc.setTextColor(...INK);
    y = richParagraph(
      doc,
      [
        { text: "son/daughter of " },
        { text: rec.father_name, bold: true },
        { text: ", a student of " },
        { text: `${rec.course_name}, Semester ${rec.semester}`, bold: true },
        { text: " (Roll No. " },
        { text: rec.roll_number, bold: true },
        { text: "), " },
        { text: rec.college_name, bold: true },
        { text: ", has successfully completed the internship " },
        { text: `“${rec.training_name}”`, bold: true },
        { text: ` at ${org}, ${place}, from ` },
        { text: fmtDate(rec.start_date), bold: true },
        { text: " to " },
        { text: fmtDate(rec.end_date), bold: true },
        { text: ", for a total duration of " },
        { text: `${rec.hours} hours`, bold: true },
        { text: " during the academic year " },
        { text: rec.academic_year, bold: true },
        { text: "." },
      ],
      M + 4,
      y,
      W - 2 * M - 8,
      10.6,
      5.15,
    );

    // Particulars table
    y += 1.5;
    const rows = [
      ["Name of the Student", rec.student_name],
      ["Father's Name", rec.father_name],
      ["Course", rec.course_name],
      ["Semester", rec.semester],
      ["Roll Number", rec.roll_number],
      ["College / Institution", rec.college_name],
      ["Internship / Training", rec.training_name],
      ["Internship Organisation", `${org}, ${place}`],
      ["Internship Period", `${fmtDate(rec.start_date)} to ${fmtDate(rec.end_date)}`],
      ["Total Duration", `${rec.hours} hours`],
      ["Academic Year", rec.academic_year],
    ];
    const tableW = W - 2 * M;
    const labelW = 56;
    const pad = 3;
    doc.setFontSize(9.8);
    const heights = rows.map(([, v]) => {
      doc.setFont("times", "normal");
      return Math.max(5.6, doc.splitTextToSize(String(v ?? ""), tableW - labelW - 2 * pad).length * 4.2 + 1.6);
    });
    const tableH = heights.reduce((a, b) => a + b, 0);
    doc.setFillColor(...TINT);
    doc.roundedRect(M, y, labelW, tableH, 2, 2, "F");
    doc.rect(M + labelW - 2, y, 2, tableH, "F");
    let ry = y;
    rows.forEach(([label, value], i) => {
      const h = heights[i];
      if (i > 0) {
        doc.setDrawColor(...RULE);
        doc.setLineWidth(0.2);
        doc.line(M, ry, M + tableW, ry);
      }
      doc.setTextColor(...INK);
      doc.setFont("times", "bold");
      doc.setFontSize(9.6);
      doc.text(label, M + pad, ry + 3.95);
      doc.setFont("times", "normal");
      doc.setFontSize(9.8);
      doc.text(doc.splitTextToSize(String(value ?? ""), tableW - labelW - 2 * pad), M + labelW + pad, ry + 3.95);
      ry += h;
    });
    doc.setDrawColor(...CARAMEL);
    doc.setLineWidth(0.3);
    doc.roundedRect(M, y, tableW, tableH, 2, 2, "S");
    doc.setDrawColor(...RULE);
    doc.line(M + labelW, y, M + labelW, y + tableH);
    y += tableH;

    // Duties
    y += 6;
    doc.setFont("times", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...CARAMEL);
    tracked(doc, "DUTIES AND RESPONSIBILITIES DURING THE INTERNSHIP", M, y, 0.45);
    y += 2.4;
    let dutySize = 9.8;
    doc.setFontSize(dutySize);
    let duties = doc.splitTextToSize(String(rec.duties || ""), tableW - 2 * pad - 1);
    while (duties.length > 4 && dutySize > 8.2) {
      dutySize -= 0.4;
      doc.setFontSize(dutySize);
      duties = doc.splitTextToSize(String(rec.duties || ""), tableW - 2 * pad - 1);
    }
    duties = duties.slice(0, 6);
    const lineH = dutySize * 0.43;
    const dutiesH = Math.max(12, duties.length * lineH + 4.6);
    doc.setFillColor(251, 247, 241);
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.25);
    doc.roundedRect(M, y, tableW, dutiesH, 2, 2, "FD");
    doc.setTextColor(...INK);
    doc.text(duties, M + pad + 0.5, y + 4.9, { lineHeightFactor: 1.25 });
    y += dutiesH;

    // Bottom: QR | seal | signature (anchored)
    if (266 - 21 - y > 16) {
      font("italic");
      doc.setFontSize(11);
      doc.setTextColor(...INK_2);
      doc.text("We wish the student every success in future endeavours.", cx, y + 11, { align: "center" });
    }

    const baseY = Math.max(266, y + 22);
    const qr = 25;
    const qx = M;
    const qy = baseY - 21;
    doc.setFillColor(...TINT);
    doc.setDrawColor(...CARAMEL);
    doc.setLineWidth(0.3);
    doc.roundedRect(qx - 2, qy - 2, qr + 4, qr + 4, 2, 2, "FD");
    doc.addImage(qrDataUrl(verifyUrl), "PNG", qx, qy, qr, qr);
    const tx = qx + qr + 5;
    doc.setFont("times", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...CARAMEL);
    tracked(doc, "SCAN TO VERIFY", tx, qy + 4, 0.45);
    doc.setFontSize(8);
    doc.setTextColor(...INK_2);
    doc.text(["Scan this QR code to view", "the original certificate online."], tx, qy + 9.5);
    const bare = verifyUrl.replace(/^https?:\/\//, "");
    const cut = bare.indexOf("/");
    doc.setTextColor(...INK);
    doc.text(cut > 0 ? [bare.slice(0, cut), bare.slice(cut)] : [bare], tx, qy + 19);

    // Seal
    const sx = 129;
    const sy = baseY - 10;
    const sealImg = await fileDataUrl(cfg.SEAL_IMAGE);
    if (sealImg) {
      doc.addImage(sealImg, "PNG", sx - 13, sy - 13, 26, 26);
    } else {
      doc.setDrawColor(...CARAMEL);
      doc.setLineWidth(0.45);
      doc.circle(sx, sy, 12);
      doc.setLineWidth(0.2);
      doc.setLineDashPattern([0.8, 0.8], 0);
      doc.circle(sx, sy, 10.2);
      doc.setLineDashPattern([], 0);
      doc.setFont("times", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(...CARAMEL);
      tracked(doc, "OFFICIAL", sx, sy - 1.2, 0.45, "center");
      tracked(doc, "SEAL", sx, sy + 3, 0.8, "center");
    }

    // Signature
    const sigR = W - M;
    const sigW = 52;
    const sigImg = await fileDataUrl(cfg.SIGNATURE_IMAGE);
    if (sigImg) doc.addImage(sigImg, "PNG", sigR - sigW + 6, baseY - 16, sigW - 12, 14);
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.3);
    doc.line(sigR - sigW, baseY, sigR, baseY);
    doc.setTextColor(...INK);
    font("semibold");
    doc.setFontSize(10.5);
    doc.text("Authorized Signatory", sigR - sigW / 2, baseY + 5, { align: "center" });
    doc.setFont("times", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...INK_2);
    let sy2 = baseY + 9.6;
    const orgLine = `${org}, ${place}`;
    [rec.signatory_name, rec.signatory_designation, orgLine]
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i)
      .filter((v) => v === orgLine || !orgLine.toLowerCase().startsWith(String(v).toLowerCase()))
      .forEach((l) => {
        doc.splitTextToSize(String(l), sigW + 8).forEach((t) => {
          doc.text(t, sigR - sigW / 2, sy2, { align: "center" });
          sy2 += 4;
        });
      });

    // Footer
    ornamentRule(doc, cx, 281.2, W / 2 - 40, 4);
    doc.setFontSize(7.2);
    doc.setTextColor(...INK_2);
    doc.text(`Certificate No. ${rec.certificate_id}   ·   Verify online at ${bare}`, cx, 285.4, { align: "center" });

    return doc.output("blob");
  }

  window.SYKCertificate = { build, fmtDate };
})();
