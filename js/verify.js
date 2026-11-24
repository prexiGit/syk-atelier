/*
 * Permanent verification page: /certificate/<CERTIFICATE-ID> (or /certificate.html?id=...).
 * Looks the ID up and shows the ORIGINAL saved PDF. Nothing is regenerated here.
 */
(function () {
  "use strict";
  const { api, esc, formatDate, renderPdf, downloadBlob, emblemSVG } = window.SYK;
  const setEmblem = (kind) => (document.getElementById("v-emblem").innerHTML = emblemSVG(kind));

  const ICON_OK = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="currentColor" opacity=".15"/><circle cx="10" cy="10" r="9" fill="none" stroke="currentColor"/><path d="M6 10.3l2.6 2.6L14 7.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_NO = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="currentColor" opacity=".12"/><circle cx="10" cy="10" r="9" fill="none" stroke="currentColor"/><path d="M7 7l6 6m0-6l-6 6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';

  function certificateIdFromUrl() {
    const q = new URLSearchParams(location.search).get("id");
    if (q) return q.trim();
    const m = location.pathname.match(/\/certificate\/([^/?#]+)/);
    return m ? decodeURIComponent(m[1]).trim() : "";
  }

  function invalid(id, reason) {
    document.title = "Certificate not valid · The SYK Atelier";
    setEmblem("invalid");
    document.getElementById("v-title").innerHTML = '<span class="line">Certificate</span><span class="line accent-text">not found.</span>';
    document.getElementById("v-sub").textContent = reason ||
      `No issued certificate with the ID “${id}” exists in The SYK Atelier records. Please check the QR code or link.`;
    document.getElementById("v-status").innerHTML = `<span class="status invalid">${ICON_NO} Invalid certificate</span>`;
  }

  async function run() {
    setEmblem();
    const id = certificateIdFromUrl();
    if (!id || !/^[A-Za-z0-9-]{3,40}$/.test(id)) return invalid(id, "This verification link does not contain a valid certificate ID.");

    let rec;
    try {
      rec = await api.getPublished(id);
    } catch (err) {
      console.error(err);
      document.getElementById("v-title").innerHTML = '<span class="line">Verification unavailable</span>';
      document.getElementById("v-sub").textContent = "We could not reach the certificate records. Please try again in a moment.";
      return;
    }
    if (!rec) return invalid(id);

    document.title = `${rec.student_name} · ${rec.certificate_id} · The SYK Atelier`;
    setEmblem("valid");
    document.getElementById("v-title").innerHTML = `<span class="line accent-text">Verified.</span><span class="line">${esc(rec.student_name)}</span>`;
    document.getElementById("v-sub").textContent =
      `This certificate was issued by The SYK Atelier, India on ${formatDate((rec.issued_at || "").slice(0, 10))} and matches our records.`;
    document.getElementById("v-status").innerHTML = `<span class="status valid">${ICON_OK} Valid certificate</span>`;
    document.getElementById("v-facts").innerHTML = [
      ["Certificate ID", rec.certificate_id],
      ["Student", rec.student_name],
      ["Internship", rec.training_name],
      ["Period", `${formatDate(rec.start_date)} – ${formatDate(rec.end_date)}`],
      ["Duration", `${rec.hours} hours`],
      ["Academic year", rec.academic_year],
      ["Issued by", "The SYK Atelier, India"],
    ].map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("");
    document.getElementById("v-body").hidden = false;

    const frame = document.getElementById("v-pdf");
    try {
      const blob = await api.getSavedPdf(rec);
      await renderPdf(blob, frame);
      if (rec.sample) frame.insertAdjacentHTML("afterbegin", '<span class="sample-tag">Sample preview</span>');
      document.getElementById("v-download").addEventListener("click", () => downloadBlob(blob, `${rec.certificate_id}.pdf`));
    } catch (err) {
      console.error(err);
      frame.innerHTML = '<p class="loading">The certificate file could not be opened. Please try again.</p>';
    }
  }

  document.addEventListener("DOMContentLoaded", run);
})();
