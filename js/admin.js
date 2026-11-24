/* THE SYK ATELIER — admin panel (login, dashboard, records, issue certificate). */
(function () {
  "use strict";
  const { isConfigured, db, BUCKET, esc, formatDate, verifyUrl, downloadBlob, SAMPLES, initials, emblemSVG } = window.SYK;
  const $ = (id) => document.getElementById(id);

  let previewMode = false;
  let records = [];

  /* ---------------- Auth ---------------- */
  function show(view) {
    $("view-login").hidden = view !== "login";
    $("view-app").hidden = view !== "app";
  }

  async function isAdmin() {
    const { data, error } = await db().rpc("is_admin");
    return !error && data === true;
  }

  async function boot() {
    if (!isConfigured) {
      $("preview-login").hidden = false;
      $("login-form").hidden = true;
      show("login");
      return;
    }
    const { data } = await db().auth.getSession();
    if (data.session && (await isAdmin())) return enterApp(data.session.user.email);
    show("login");
  }

  $("open-preview").addEventListener("click", () => {
    previewMode = true;
    $("preview-app").hidden = false;
    enterApp("Preview mode");
  });

  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("login-error");
    err.hidden = true;
    const email = $("email").value.trim();
    const password = $("password").value;
    if (!email || !password) {
      err.textContent = "Please enter your email and password.";
      err.hidden = false;
      return;
    }
    const btn = $("login-btn");
    btn.disabled = true;
    btn.textContent = "Signing in…";
    const { data, error } = await db().auth.signInWithPassword({ email, password });
    btn.disabled = false;
    btn.textContent = "Sign in";
    if (error) {
      err.textContent = "Those login details are not correct.";
      err.hidden = false;
      return;
    }
    if (!(await isAdmin())) {
      await db().auth.signOut();
      err.textContent = "This account is not an administrator.";
      err.hidden = false;
      return;
    }
    enterApp(data.user.email);
  });

  $("logout").addEventListener("click", async () => {
    if (!previewMode && isConfigured) await db().auth.signOut();
    previewMode = false;
    location.hash = "";
    location.reload();
  });

  async function enterApp(who) {
    $("who").textContent = who;
    show("app");
    await loadRecords();
    route();
  }

  /* ---------------- Data ---------------- */
  async function loadRecords() {
    if (previewMode) {
      records = SAMPLES.map((s) => ({ ...s, sample: true, pdf_path: null, created_at: s.issued_at }));
      return;
    }
    const { data, error } = await db().from("certificates").select("*").order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      records = [];
      return;
    }
    records = data;
  }

  /* ---------------- Routing ---------------- */
  function route() {
    const r = (location.hash.replace("#/", "") || "dashboard").split("?")[0];
    const name = ["dashboard", "students", "new"].includes(r) ? r : "dashboard";
    ["dashboard", "students", "new"].forEach((n) => ($(`route-${n}`).hidden = n !== name));
    document.querySelectorAll(".admin-nav a").forEach((a) => {
      if (a.dataset.route === name) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    if (name === "dashboard") renderDashboard();
    if (name === "students") $("all-table").innerHTML = table(records);
    if (name === "new") {
      $("student-form").hidden = false;
      $("issue-result").hidden = true;
    }
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", () => !$("view-app").hidden && route());

  function renderDashboard() {
    const published = records.filter((r) => r.status === "published");
    const now = new Date();
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    $("stat-total").textContent = published.length;
    $("stat-month").textContent = published.filter((r) => (r.issued_at || "").startsWith(key)).length;
    $("stat-draft").textContent = records.length - published.length;
    $("recent-table").innerHTML = table(records.slice(0, 6));
  }

  function table(rows) {
    if (!rows.length) {
      return `<div class="empty" style="box-shadow:none;border-radius:0"><h3>No students yet</h3><p>Add your first student to issue a certificate.</p><p style="margin-top:20px"><a class="btn btn-sm" href="#/new">+ Add New Student</a></p></div>`;
    }
    return `
      <table class="records">
        <thead><tr>
          <th>Certificate ID</th><th>Student</th><th>Internship</th><th>Completed</th><th>Status</th><th style="text-align:right">Actions</th>
        </tr></thead>
        <tbody>
          ${rows.map((r) => `
            <tr>
              <td class="idcell">${esc(r.certificate_id)}</td>
              <td><div class="person"><span class="monogram" aria-hidden="true">${esc(initials(r.student_name))}</span><div><span class="name">${esc(r.student_name)}</span><br /><span class="muted" style="font-size:13px">Roll No. ${esc(r.roll_number)} · ${esc(r.college_name)}</span></div></div></td>
              <td>${esc(r.training_name)}<br /><span class="muted" style="font-size:13px">${esc(r.hours)} hours</span></td>
              <td>${esc(formatDate(r.end_date))}</td>
              <td><span class="pill ${r.status === "published" ? "published" : "draft"}">${r.status === "published" ? "Published" : "Not published"}</span></td>
              <td><div class="actions">
                ${r.status === "published"
                  ? `<a class="btn btn-sm btn-ghost" href="/certificate/${encodeURIComponent(r.certificate_id)}" target="_blank" rel="noopener">View</a>
                     <button class="btn btn-sm" type="button" data-pdf="${esc(r.certificate_id)}">PDF</button>`
                  : `<button class="btn btn-sm" type="button" data-retry="${esc(r.certificate_id)}">Finish issuing</button>`}
                <button class="btn btn-sm btn-ghost icon-btn danger" type="button" data-delete="${esc(r.certificate_id)}" aria-label="Delete ${esc(r.student_name)} (${esc(r.certificate_id)})" title="Delete"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3.5 5.5h13M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5.5 5.5l.8 10.6a1.5 1.5 0 0 0 1.5 1.4h4.4a1.5 1.5 0 0 0 1.5-1.4l.8-10.6M8.5 9v5M11.5 9v5"/></svg></button>
              </div></td>
            </tr>`).join("")}
        </tbody>
      </table>`;
  }

  document.addEventListener("click", async (e) => {
    const pdfBtn = e.target.closest("[data-pdf]");
    const retryBtn = e.target.closest("[data-retry]");
    const delBtn = e.target.closest("[data-delete]");
    if (delBtn) {
      const rec = records.find((r) => r.certificate_id === delBtn.dataset.delete);
      if (rec) openDelete(rec, delBtn);
    }
    if (pdfBtn) {
      const rec = records.find((r) => r.certificate_id === pdfBtn.dataset.pdf);
      pdfBtn.disabled = true;
      try {
        const blob = rec.sample ? await buildPdf(rec) : await downloadStored(rec);
        downloadBlob(blob, `${rec.certificate_id}.pdf`);
      } catch (err) {
        alertError(err);
      }
      pdfBtn.disabled = false;
    }
    if (retryBtn) {
      const rec = records.find((r) => r.certificate_id === retryBtn.dataset.retry);
      retryBtn.disabled = true;
      retryBtn.textContent = "Issuing…";
      try {
        await publish(rec, true);
        await loadRecords();
        route();
      } catch (err) {
        retryBtn.disabled = false;
        retryBtn.textContent = "Finish issuing";
        alertError(err);
      }
    }
  });

  /* ---------------- Delete certificate ---------------- */
  let deleting = null;
  let returnFocus = null;

  function openDelete(rec, trigger) {
    deleting = rec;
    returnFocus = trigger;
    $("del-name").textContent = rec.student_name;
    $("del-id").textContent = rec.certificate_id;
    $("del-published").hidden = rec.status !== "published";
    $("del-error").hidden = true;
    $("del-confirm").disabled = false;
    $("del-confirm").textContent = "Delete certificate";
    $("delete-modal").hidden = false;
    $("del-cancel").focus();
  }

  function closeDelete() {
    $("delete-modal").hidden = true;
    deleting = null;
    if (returnFocus && document.body.contains(returnFocus)) returnFocus.focus();
  }

  // Deletes the record first, so its QR link shows "invalid" at once, then removes the stored PDF.
  async function deleteCertificate(rec) {
    if (previewMode) {
      records = records.filter((r) => r.certificate_id !== rec.certificate_id);
      return;
    }
    const { error, count } = await db().from("certificates").delete({ count: "exact" }).eq("id", rec.id);
    if (error) throw error;
    if (!count) throw new Error("The record was not deleted. Please run the latest supabase/schema.sql so admins are allowed to delete.");
    const paths = [...new Set([rec.pdf_path, `${rec.certificate_id}.pdf`].filter(Boolean))];
    const { error: fileError } = await db().storage.from(BUCKET).remove(paths);
    if (fileError) console.warn("Record deleted, but the PDF could not be removed from storage:", fileError);
  }

  $("del-cancel").addEventListener("click", closeDelete);
  $("delete-modal").addEventListener("click", (e) => e.target.matches("[data-close]") && closeDelete());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("delete-modal").hidden && !$("del-confirm").disabled) closeDelete();
  });
  $("del-confirm").addEventListener("click", async () => {
    if (!deleting) return;
    const btn = $("del-confirm");
    btn.disabled = true;
    btn.textContent = "Deleting…";
    try {
      await deleteCertificate(deleting);
      returnFocus = null;
      closeDelete();
      if (!previewMode) await loadRecords();
      route();
    } catch (err) {
      console.error(err);
      $("del-error").textContent = `Could not delete: ${err && err.message ? err.message : err}`;
      $("del-error").hidden = false;
      btn.disabled = false;
      btn.textContent = "Delete certificate";
    }
  });

  function alertError(err) {
    console.error(err);
    window.alert(`Something went wrong: ${err && err.message ? err.message : err}`);
  }

  async function downloadStored(rec) {
    const { data, error } = await db().storage.from(BUCKET).download(rec.pdf_path);
    if (error) throw error;
    return data;
  }

  /* ---------------- Issue certificate ---------------- */
  const FIELDS = [
    "student_name", "father_name", "course_name", "semester", "roll_number", "college_name",
    "training_name", "start_date", "end_date", "hours", "academic_year", "duties",
    "signatory_name", "signatory_designation",
  ];

  const duties = $("f-duties");
  duties.addEventListener("input", () => ($("duties-count").textContent = duties.value.length));
  $("student-form").addEventListener("reset", () => setTimeout(() => ($("duties-count").textContent = "0")));

  function readForm() {
    const v = {};
    FIELDS.forEach((f) => (v[f] = $(`f-${f}`).value.replace(/[ \t]+/g, " ").trim()));
    v.hours = Number(v.hours);
    return v;
  }

  function validate(v) {
    const errors = {};
    FIELDS.forEach((f) => { if (v[f] === "" || v[f] === 0) errors[f] = "Required."; });
    if (!errors.hours && (!Number.isInteger(v.hours) || v.hours < 120)) errors.hours = "Internship must be at least 120 hours.";
    if (!errors.academic_year && !/^\d{4}-\d{2}$/.test(v.academic_year)) errors.academic_year = "Use the format 2026-27.";
    if (!errors.end_date && !errors.start_date && v.end_date < v.start_date) errors.end_date = "Completion date must be after the start date.";
    return errors;
  }

  function showErrors(errors) {
    document.querySelectorAll("#student-form .field").forEach((f) => {
      f.classList.remove("has-error");
      const e = f.querySelector(".error");
      if (e) e.remove();
    });
    Object.entries(errors).forEach(([k, msg]) => {
      const input = $(`f-${k}`);
      const field = input.closest(".field");
      field.classList.add("has-error");
      field.insertAdjacentHTML("beforeend", `<span class="error">${esc(msg)}</span>`);
    });
    const first = Object.keys(errors)[0];
    if (first) $(`f-${first}`).focus();
  }

  function buildPdf(rec) {
    return window.SYKCertificate.build(rec, verifyUrl(rec.certificate_id));
  }

  /**
   * Generates the PDF, stores it, then publishes the record.
   * The record only becomes public after the PDF upload succeeds.
   */
  async function publish(rec, retry) {
    const issuedAt = new Date().toISOString();
    const blob = await buildPdf({ ...rec, issued_at: issuedAt });
    const path = `${rec.certificate_id}.pdf`;
    const up = await db().storage.from(BUCKET).upload(path, blob, { contentType: "application/pdf", upsert: !!retry });
    if (up.error) throw up.error;
    const { error } = await db()
      .from("certificates")
      .update({ pdf_path: path, status: "published", issued_at: issuedAt })
      .eq("id", rec.id);
    if (error) throw error;
    return blob;
  }

  $("student-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("form-error");
    err.hidden = true;
    const v = readForm();
    const errors = validate(v);
    showErrors(errors);
    if (Object.keys(errors).length) return;
    if (!$("f-confirm").checked) {
      err.textContent = "Please confirm that you have checked the details.";
      err.hidden = false;
      return;
    }

    const btn = $("issue-btn");
    btn.disabled = true;
    try {
      let rec;
      let blob;
      if (previewMode) {
        btn.textContent = "Building preview…";
        rec = { ...v, certificate_id: "SYK-PREVIEW", issued_at: new Date().toISOString() };
        blob = await buildPdf(rec);
      } else {
        btn.textContent = "Saving record…";
        const ins = await db().from("certificates").insert(v).select("*").single();
        if (ins.error) throw ins.error;
        rec = ins.data;
        btn.textContent = "Generating certificate…";
        try {
          blob = await publish(rec, false);
        } catch (pubErr) {
          await loadRecords();
          throw new Error(`The student was saved as ${rec.certificate_id}, but the certificate could not be stored (${pubErr.message}). Open Student Records and choose "Finish issuing" to try again. The student is not public yet.`);
        }
        await loadRecords();
      }
      showResult(rec, blob);
      $("student-form").reset();
    } catch (ex) {
      console.error(ex);
      err.textContent = ex.message || "The certificate could not be issued.";
      err.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = "Generate & issue certificate";
    }
  });

  function showResult(rec, blob) {
    $("student-form").hidden = true;
    const box = $("issue-result");
    box.hidden = false;
    box.innerHTML = `
      <div class="emblem">${emblemSVG("valid")}</div>
      <p class="eyebrow-lines" style="margin-top:22px;font-size:12px;letter-spacing:.24em;text-transform:uppercase">${previewMode ? "Preview built (not saved)" : "Certificate issued"}</p>
      <h2 class="accent-text" style="font-size:clamp(32px,4vw,48px);font-weight:700;margin-top:12px">${esc(rec.certificate_id)}</h2>
      <p class="muted" style="margin:12px auto 0;max-width:620px">${previewMode
        ? "This is how the certificate will look. Connect Supabase to issue and publish real certificates."
        : `${esc(rec.student_name)}'s certificate is stored and now listed on the public Internship page. Its QR code opens ${esc(verifyUrl(rec.certificate_id))}.`}</p>
      <div class="form-actions" style="justify-content:center;margin-top:28px">
        <button class="btn btn-accent" type="button" id="res-download">Download PDF</button>
        ${previewMode ? "" : `<a class="btn btn-ghost" href="/certificate/${encodeURIComponent(rec.certificate_id)}" target="_blank" rel="noopener">Open verification page</a>`}
        <button class="btn btn-ghost" type="button" id="res-another">Add another student</button>
      </div>`;
    $("res-download").addEventListener("click", () => downloadBlob(blob, `${rec.certificate_id}.pdf`));
    $("res-another").addEventListener("click", () => {
      box.hidden = true;
      $("student-form").hidden = false;
      $("f-student_name").focus();
    });
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
