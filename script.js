/**
 * resume.js — Likhit Verma Resume Editor
 * ─────────────────────────────────────────────────────────────────
 * Features:
 *   1. Sticky toolbar — Edit, Save Now, Export HTML, Reset, Print
 *   2. Edit mode — toggles contenteditable on every content element
 *   3. Auto-save to localStorage with 1.2s debounce after typing
 *   4. Save status indicator (Unsaved → Saving… → ✓ Saved)
 *   5. Export HTML — downloads a clean standalone file with a
 *      timestamp in the filename (e.g. Likhit_Verma_Resume_20260415_143022.html)
 *   6. Reset — clears localStorage & reloads original content
 *   7. Keyboard shortcuts: Ctrl/Cmd+E (edit), Ctrl/Cmd+S (save)
 *   8. Browser unload warning when there are unsaved changes
 *   9. Toast notifications for all actions
 *  10. Auto-restores last saved session on page load
 * ─────────────────────────────────────────────────────────────────
 */

(function () {
  "use strict";

  /* ════════════════════════════════
     CONFIG
  ════════════════════════════════ */
  const STORAGE_KEY = "likhit_resume_v1";
  const DEBOUNCE_MS = 1200;

  /* ════════════════════════════════
     ALL EDITABLE ELEMENT IDs
     Add / remove IDs here to control
     which elements become editable.
  ════════════════════════════════ */
  const EDITABLE_IDS = [
    /* Header */
    "ce-name",
    "ce-title",
    "ce-phone",
    "ce-email",
    "ce-linkedin",
    "ce-portfolio",
    "ce-location",
    /* Summary */
    "ce-summary-role",
    "ce-summary-text",
    /* Experience — Concentrix */
    "ce-co1-name",
    "ce-co1-location",
    "ce-co1-role",
    "ce-co1-dates",
    "ce-co1-desc",
    "ce-co1-bullets",
    /* Experience — GlobalLogic */
    "ce-co2-name",
    "ce-co2-location",
    "ce-co2-role",
    "ce-co2-dates",
    "ce-co2-desc",
    "ce-co2-bullets",
    /* Experience — PureSoftware */
    "ce-co3-name",
    "ce-co3-location",
    "ce-co3-role",
    "ce-co3-dates",
    "ce-co3-desc",
    "ce-co3-bullets",
    /* Education */
    "ce-edu-school",
    "ce-edu-degree",
    "ce-edu-right",
    /* Achievements */
    "ce-ach-label",
    "ce-ach-bullets",
    /* Skills */
    "ce-skill-frontend",
    "ce-skill-backend",
    "ce-skill-testing",
    "ce-skill-devops",
    "ce-skill-pm",
    "ce-skill-soft",
    "ce-skill-lang",
  ];

  /* ════════════════════════════════
     STATE
  ════════════════════════════════ */
  let editMode = false;
  let isDirty = false;
  let saveTimer = null;

  /* ════════════════════════════════
     INJECT TOOLBAR + STYLES
  ════════════════════════════════ */
  const toolbarEl = document.createElement("div");
  toolbarEl.id = "resume-toolbar";
  toolbarEl.setAttribute("role", "toolbar");
  toolbarEl.setAttribute("aria-label", "Resume editor toolbar");
  toolbarEl.innerHTML = `
    <div class="tb-left">
      <span class="tb-brand">⚡ Resume Editor</span>
      <div class="tb-center">
        <button id="tb-btn-edit"   title="Toggle edit mode (Ctrl/Cmd + E)">✏️ Edit Resume</button>
        <button id="tb-btn-save"   title="Save changes now (Ctrl/Cmd + S)" class="tb-hidden">💾 Save Now</button>
        <span   id="tb-save-status" aria-live="polite"></span>
        <span   id="tb-edit-hint"  class="tb-hidden">Click any text on the resume to edit it</span>
      </div>
    </div>

    <div class="tb-right">
      <button id="tb-btn-reset"  title="Clear all edits and restore original content">↩ Reset</button>
      <button id="tb-btn-export" title="Download a standalone HTML file of your edited resume">⬇️ Export HTML</button>
      <button id="tb-btn-print"  title="Print or save as PDF (Ctrl/Cmd + P)">🖨️ Print / PDF</button>
      <button id="btn-edit-hint" title="How to edit this resume">
      ✏️ Edit Guide
    </button>
    </div>
  `;
  document.body.prepend(toolbarEl);

  /* Toast element */
  const toastEl = document.createElement("div");
  toastEl.id = "resume-toast";
  document.body.appendChild(toastEl);

  /* Styles */
  const styleEl = document.createElement("style");
  styleEl.textContent = `
    /* ── Toolbar ── */
    #resume-toolbar {
      position: sticky;
      top: 0;
      z-index: 1000;
      background: #e9e9e9;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 9px 20px;
      font-family: 'Source Sans 3', 'Helvetica Neue', Arial, sans-serif;
      box-shadow: 0 2px 12px rgba(0,0,0,0.35);
      flex-wrap: wrap;
    }
    .tb-left, .tb-center, .tb-right {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: 20px
    }
    .tb-brand {
      font-size: 1rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #373737;
      white-space: nowrap;
      margin-right: 4px;
    }

    /* ── Toolbar buttons ── */
    #resume-toolbar button {
      border: none;
      padding: 6px 14px;
      font-family: 'Source Sans 3', 'Helvetica Neue', Arial, sans-serif;
      font-size: 0.76rem;
      font-weight: 600;
      border-radius: 4px;
      cursor: pointer;
      letter-spacing: 0.03em;
      transition: background 0.18s, transform 0.1s;
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    #resume-toolbar button:active { transform: scale(0.97); }

    #tb-btn-edit   { background: #2563eb; color: #fff; }
    #tb-btn-edit:hover { background: #1d4ed8; }
    #tb-btn-edit.tb-active { background: #dc2626; color: #fff; }
    #tb-btn-edit.tb-active:hover { background: #b91c1c; }

    #tb-btn-save   { background: #16a34a; color: #fff; }
    #tb-btn-save:hover { background: #15803d; }

    #tb-btn-export { background: #1a1a2e; color: #e8e6f0; border: 1px solid rgba(255,255,255,0.12); }
    #tb-btn-export:hover { background: #2e2e4e; }

    #tb-btn-reset:hover { color: #ef4444; border-color: #ef4444; }

    #tb-btn-print, #btn-edit-hint, #tb-btn-reset { background: #1a1a2e; color: #e8e6f0; border: 1px solid rgba(255,255,255,0.12); }
    #tb-btn-print:hover { background: #2e2e4e; }

    /* ── Save status pill ── */
    #tb-save-status {
      font-size: 0.71rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      padding: 4px 10px;
      border-radius: 20px;
      white-space: nowrap;
      transition: all 0.25s;
    }
    #tb-save-status.status-unsaved { color: #f59e0b; background: rgba(245,158,11,0.15); }
    #tb-save-status.status-saving  { color: #60a5fa; background: rgba(96,165,250,0.15); }
    #tb-save-status.status-saved   { color: #22c55e; background: rgba(34,197,94,0.15); }

    /* ── Edit hint ── */
    #tb-edit-hint {
      font-size: 1rem;
      color: #0011a7;
      background: rgba(99,102,241,0.12);
      padding: 4px 10px;
      border-radius: 4px;
    }

    /* ── Utility ── */
    .tb-hidden { display: none !important; }

    /* ── Toast ── */
    #resume-toast {
      position: fixed;
      bottom: 28px;
      right: 28px;
      background: #111;
      color: #e8e6e1;
      font-family: 'Source Sans 3', 'Helvetica Neue', Arial, sans-serif;
      font-size: 0.78rem;
      font-weight: 600;
      padding: 10px 20px;
      border-radius: 6px;
      box-shadow: 0 6px 24px rgba(0,0,0,0.3);
      opacity: 0;
      transform: translateY(10px);
      transition: opacity 0.25s ease, transform 0.25s ease;
      pointer-events: none;
      z-index: 9999;
      max-width: 340px;
    }
    #resume-toast.show {
      opacity: 1;
      transform: translateY(0);
    }

    /* ── Print: hide toolbar & toast ── */
    @media print {
      #resume-toolbar,
      #resume-toast { display: none !important; }
    }

        /* Edit-guide modal */
    #edit-modal-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.55);
      display: flex; align-items: center; justify-content: center;
      z-index: 9999;
    }
    #edit-modal {
      background: #fff;
      max-width: 540px; width: 90%;
      border-radius: 8px;
      padding: 32px 36px;
      font-family: 'Source Sans 3', sans-serif;
      font-size: 0.9rem;
      line-height: 1.6;
      color: #222;
      box-shadow: 0 12px 48px rgba(0,0,0,0.2);
    }
    #edit-modal h3 {
      font-size: 1.1rem; font-weight: 700;
      margin-bottom: 14px; color: #111;
    }
    #edit-modal code {
      background: #f0efed; padding: 2px 6px;
      border-radius: 3px; font-size: 0.85rem;
    }
    #edit-modal ol { padding-left: 18px; }
    #edit-modal li { margin-bottom: 8px; }
    #close-modal {
      margin-top: 20px;
      background: #111; color: #fff;
      border: none; padding: 8px 20px;
      border-radius: 4px; cursor: pointer;
      font-size: 0.85rem;
    }
    #close-modal:hover { background: #333; }

    @media print {
      #resume-toolbar { display: none; }
    }
  `;
  document.head.appendChild(styleEl);

  /* ════════════════════════════════
     DOM REFS (toolbar elements)
  ════════════════════════════════ */
  const resumePage = document.getElementById("resume-page");
  const btnEdit = document.getElementById("tb-btn-edit");
  const btnSave = document.getElementById("tb-btn-save");
  const saveStatus = document.getElementById("tb-save-status");
  const editHint = document.getElementById("tb-edit-hint");

  document.getElementById("tb-btn-save").addEventListener("click", forceSave);
  document
    .getElementById("tb-btn-export")
    .addEventListener("click", exportHTML);
  document
    .getElementById("tb-btn-reset")
    .addEventListener("click", confirmReset);
  document
    .getElementById("tb-btn-print")
    .addEventListener("click", () => window.print());
  btnEdit.addEventListener("click", toggleEdit);

  /* ════════════════════════════════
     INIT — restore saved session
  ════════════════════════════════ */
  (function init() {
    const saved = loadFromStorage();
    if (saved) {
      applySnapshot(saved);
      setStatus("saved", "✓ Last session restored");
      setTimeout(() => clearStatus(), 3000);
    }
  })();

  /* ════════════════════════════════
     TOGGLE EDIT MODE
  ════════════════════════════════ */
  function toggleEdit() {
    editMode = !editMode;

    EDITABLE_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (editMode) {
        el.setAttribute("contenteditable", "true");
        el.setAttribute("spellcheck", "true");
      } else {
        el.removeAttribute("contenteditable");
        el.removeAttribute("spellcheck");
      }
    });

    if (editMode) {
      resumePage.classList.add("edit-mode");
      btnEdit.classList.add("tb-active");
      btnEdit.textContent = "🔒 Stop Editing";
      btnSave.classList.remove("tb-hidden");
      editHint.classList.remove("tb-hidden");
      showToast("Edit mode ON — click any text to start editing");
    } else {
      resumePage.classList.remove("edit-mode");
      btnEdit.classList.remove("tb-active");
      btnEdit.textContent = "✏️ Edit Resume";
      editHint.classList.add("tb-hidden");
      if (!isDirty) btnSave.classList.add("tb-hidden");
      showToast("Edit mode OFF");
    }
  }

  /* ════════════════════════════════
     INPUT → DEBOUNCED AUTO-SAVE
  ════════════════════════════════ */
  resumePage.addEventListener("input", function () {
    if (!editMode) return;
    isDirty = true;
    btnSave.classList.remove("tb-hidden");
    setStatus("unsaved", "● Unsaved changes");

    clearTimeout(saveTimer);
    saveTimer = setTimeout(autoSave, DEBOUNCE_MS);
  });

  /* ════════════════════════════════
     AUTO SAVE
  ════════════════════════════════ */
  function autoSave() {
    setStatus("saving", "⟳ Saving…");
    const snap = captureSnapshot();
    saveToStorage(snap);
    setTimeout(() => {
      isDirty = false;
      setStatus("saved", "✓ Saved automatically");
    }, 280);
  }

  /* ════════════════════════════════
     FORCE SAVE (button / shortcut)
  ════════════════════════════════ */
  function forceSave() {
    clearTimeout(saveTimer);
    autoSave();
    showToast("💾 Saved!");
  }

  /* ════════════════════════════════
    Edit guide modal
  ════════════════════════════════ */ 
  document.getElementById("btn-edit-hint").addEventListener("click", function () {
    if (document.getElementById("edit-modal-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "edit-modal-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "edit-modal-title");

    overlay.innerHTML = `
      <div id="edit-modal">
        <h3 id="edit-modal-title">✏️ How to Edit Your Resume</h3>
        <ol>
          <li>Open <code>resume.html</code> in any text editor
              (VS Code, Notepad++, Sublime Text, etc.).</li>
          <li>Find the section you want to change — every section is clearly
              commented with <code>&lt;!-- SECTION NAME --&gt;</code>.</li>
          <li>Edit the text between the HTML tags. <strong>Don't</strong>
              change the class names or tag names — just the inner text.</li>
          <li>Save the file, then refresh this page in your browser to see
              the changes instantly.</li>
          <li>To save as PDF: click <strong>Print / Save PDF</strong> →
              choose <em>Save as PDF</em> in the print dialog.
              Set margins to <em>None</em> for best results.</li>
        </ol>
        <p style="margin-top:14px; color:#555; font-size:0.82rem;">
          Tip: <code>resume.css</code> controls all styling. 
          <code>resume.js</code> handles the toolbar. You rarely need to touch either.
        </p>
        <button id="close-modal">Got it</button>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById("close-modal").addEventListener("click", closeModal);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeModal();
    });
    document.addEventListener("keydown", escClose);
  });

    function closeModal() {
    const overlay = document.getElementById("edit-modal-overlay");
    if (overlay) overlay.remove();
    document.removeEventListener("keydown", escClose);
  }

  function escClose(e) {
    if (e.key === "Escape") closeModal();
  }
  /* ════════════════════════════════
     SNAPSHOT — capture & apply
  ════════════════════════════════ */
  function captureSnapshot() {
    const snap = {};
    EDITABLE_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) snap[id] = el.innerHTML;
    });
    return snap;
  }

  function applySnapshot(snap) {
    EDITABLE_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el && snap[id] !== undefined) el.innerHTML = snap[id];
    });
  }

  /* ════════════════════════════════
     LOCAL STORAGE
  ════════════════════════════════ */
  function saveToStorage(snap) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
    } catch (e) {
      showToast("⚠️ Storage full — use Export HTML instead");
    }
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  /* ════════════════════════════════
     RESET
  ════════════════════════════════ */
  function confirmReset() {
    if (
      !confirm(
        "Reset all edits and restore the original resume content?\n\nThis cannot be undone.",
      )
    )
      return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    showToast("Resetting…");
    setTimeout(() => location.reload(), 500);
  }

  /* ════════════════════════════════
     EXPORT HTML
     ─────────────────────────────
     Produces a fully standalone HTML file:
     • Inline CSS (reads all <style> + <link> sheets)
     • All current edits baked in
     • No contenteditable attributes
     • No toolbar / toast
     • Timestamp in filename for uniqueness
  ════════════════════════════════ */
  async function exportHTML() {
    showToast("⏳ Preparing export…");

    /* 1. Capture latest snapshot */
    applySnapshot(captureSnapshot());

    /* 2. Clone the resume article */
    const clone = resumePage.cloneNode(true);
    clone.classList.remove("edit-mode");
    clone.querySelectorAll("[contenteditable]").forEach((el) => {
      el.removeAttribute("contenteditable");
      el.removeAttribute("spellcheck");
    });

    /* 3. Collect CSS — inline <style> blocks */
    let cssText = "";
    document.querySelectorAll("style").forEach((s) => {
      /* Skip toolbar/toast styles — they are in the dynamically injected sheet.
         We want only the resume layout styles. We identify them by checking for
         .resume-page which only lives in resume.css */
      if (
        s.textContent.includes(".resume-page") ||
        s.textContent.includes("@import")
      ) {
        cssText += s.textContent + "\n";
      }
    });

    /* 4. Also attempt to fetch the linked resume.css if present */
    const linkEl = document.querySelector('link[href*="resume.css"]');
    if (linkEl) {
      try {
        const resp = await fetch(linkEl.href);
        if (resp.ok) cssText = await resp.text();
      } catch (e) {
        /* offline / CORS — fall back to inline styles */
      }
    }

    /* 5. Build timestamp */
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const fname = `Likhit_Verma_Resume_${ts}.html`;

    /* 6. Build full HTML */
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Likhit Verma — Software Engineer II</title>
  <meta name="description" content="Resume of Likhit Verma, Senior Full Stack Engineer specialising in MERN Stack with 6+ years of experience."/>
  <meta name="author" content="Likhit Verma"/>
  <meta name="keywords" content="Software Engineer, Full Stack, MERN, React, Node.js, MongoDB, Express, JavaScript, TypeScript"/>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Source+Sans+3:wght@300;400;600;700&display=swap" rel="stylesheet"/>
  <style>
${cssText}
    /* Export overrides */
    body { background: white; padding: 40px 20px; }
    .resume-page { box-shadow: 0 4px 40px rgba(0,0,0,0.10); }
    @media print {
      body { background: white; padding: 0; }
      .resume-page { box-shadow: none; max-width: 100%; padding: 28px 36px; }
      @page { margin: 0.5in; }
      a { color: inherit !important; text-decoration: none !important; }
    }
  </style>
</head>
<body>
${clone.outerHTML}
</body>
</html>`;

    /* 7. Trigger download */
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 1200);

    showToast(`⬇️ Exported: ${fname}`);
  }

  /* ════════════════════════════════
     STATUS INDICATOR
  ════════════════════════════════ */
  function setStatus(type, text) {
    saveStatus.className = "";
    saveStatus.textContent = text;
    if (type) saveStatus.classList.add("status-" + type);
  }

  function clearStatus() {
    saveStatus.className = "";
    saveStatus.textContent = "";
  }

  /* ════════════════════════════════
     TOAST
  ════════════════════════════════ */
  let toastTimer = null;
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2800);
  }

  /* ════════════════════════════════
     KEYBOARD SHORTCUTS
  ════════════════════════════════ */
  document.addEventListener("keydown", function (e) {
    const mod = e.ctrlKey || e.metaKey;

    /* Ctrl/Cmd + E → toggle edit */
    if (mod && !e.shiftKey && e.key === "e") {
      e.preventDefault();
      toggleEdit();
    }

    /* Ctrl/Cmd + S → force save (only in edit mode) */
    if (mod && !e.shiftKey && e.key === "s" && editMode) {
      e.preventDefault();
      forceSave();
    }
  });

  /* ════════════════════════════════
     UNLOAD WARNING
  ════════════════════════════════ */
  window.addEventListener("beforeunload", function (e) {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
})();
