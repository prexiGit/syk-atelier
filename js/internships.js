/* Internship Opportunities: completed-student directory + certificate modal. */
(function () {
  "use strict";
  const { api, esc, formatDate, renderPdf, downloadBlob, trapFocus, initials } = window.SYK;
  const I_CAL = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="2" y="3" width="12" height="11" rx="2"/><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3"/></svg>';
  const I_ID = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1.5" y="3" width="13" height="10" rx="2"/><path d="M4.5 7h4M4.5 10h6"/></svg>';
  const I_OK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3.5 8.4l2.8 2.8L12.5 5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const list = document.getElementById("students");
  const count = document.getElementById("count");
  const modal = document.getElementById("cert-modal");
  const dialog = modal.querySelector(".modal-dialog");
  let current = null;
  let currentBlob = null;
  let releaseFocus = null;
  let lastTrigger = null;

  function card(r, i) {
    return `
      <li>
        <article class="student-card">
          <div class="top">
            <span class="monogram" aria-hidden="true">${esc(initials(r.student_name))}</span>
            <span class="verified-chip">${I_OK} Verified</span>
          </div>
          <h3>${esc(r.student_name)}</h3>
          <p class="training">${esc(r.training_name)}</p>
          <div class="meta">
            <span>${I_CAL} Completed ${esc(formatDate(r.end_date))}</span>
            <span>${I_ID} ${esc(r.certificate_id)}</span>
          </div>
          <div class="spacer"></div>
          <button class="btn" type="button" data-index="${i}">View Certificate <span class="arrow" aria-hidden="true">→</span></button>
        </article>
      </li>`;
  }

  async function load() {
    try {
      const rows = await api.listPublished();
      list.setAttribute("aria-busy", "false");
      if (!rows.length) {
        list.outerHTML = `<div class="empty"><h3>Certificates will appear here</h3><p>Students are listed as soon as their internship certificate is issued.</p></div>`;
        count.textContent = "No certificates yet";
        document.getElementById("stat-students").textContent = "0";
        return;
      }
      count.textContent = `${rows.length} ${rows.length === 1 ? "student" : "students"} certified`;
      document.getElementById("stat-students").textContent = rows.length;
      list.innerHTML = rows.map(card).join("");
      list.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-index]");
        if (!btn) return;
        lastTrigger = btn;
        open(rows[Number(btn.dataset.index)]);
      });
    } catch (err) {
      console.error(err);
      list.setAttribute("aria-busy", "false");
      list.outerHTML = `<div class="empty"><h3>Could not load certificates</h3><p>Please refresh the page in a moment.</p></div>`;
    }
  }

  async function open(r) {
    current = r;
    currentBlob = null;
    document.getElementById("modal-id").textContent = `Certificate ${r.certificate_id}`;
    document.getElementById("modal-name").textContent = r.student_name;
    document.getElementById("modal-verify").href = `/certificate/${encodeURIComponent(r.certificate_id)}`;
    document.getElementById("modal-facts").innerHTML = [
      ["Internship", r.training_name],
      ["Period", `${formatDate(r.start_date)} – ${formatDate(r.end_date)}`],
      ["Duration", `${r.hours} hours`],
      ["Certificate ID", r.certificate_id],
      ["Issued by", "The SYK Atelier, India"],
    ].map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("");

    const frame = document.getElementById("modal-pdf");
    frame.innerHTML = '<p class="loading">Opening certificate…</p>';
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    dialog.focus();
    releaseFocus = trapFocus(dialog, close);

    try {
      currentBlob = await api.getSavedPdf(r);
      if (current !== r) return;
      await renderPdf(currentBlob, frame);
      if (r.sample) frame.insertAdjacentHTML("afterbegin", '<span class="sample-tag">Sample preview</span>');
    } catch (err) {
      console.error(err);
      frame.innerHTML = '<p class="loading">The certificate could not be opened. Please try again.</p>';
    }
  }

  function close() {
    modal.hidden = true;
    document.body.style.overflow = "";
    if (releaseFocus) releaseFocus();
    current = null;
    if (lastTrigger) lastTrigger.focus();
  }

  modal.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) close(); });
  document.getElementById("modal-download").addEventListener("click", () => {
    if (currentBlob && current) downloadBlob(currentBlob, `${current.certificate_id}.pdf`);
  });

  document.addEventListener("DOMContentLoaded", load);
})();
