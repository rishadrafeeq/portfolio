/* Portfolio admin — edits content.json and publishes to GitHub (Vercel redeploys on push). */
(() => {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const DRAFT_KEY = "portfolio-draft";
  const DRAFT_TIME = "portfolio-draft-time";
  const GH_KEY = "portfolio-gh";
  const ACCENTS = ["#c8ff3d", "#7c5cff", "#00d4ff", "#ff5c35", "#ff4fa3", "#ffd23f", "#2fe6a6", "#f4f4f1"];

  const state = { c: null, base: "", editing: null, editIndex: -1 };
  const imgCache = new Map(); // published path -> dataURL (until Vercel redeploys)

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
  };

  /* ---------------- helpers ---------------- */
  function toast(msg, err = false, ms = 4200) {
    const t = document.createElement("div");
    t.className = "toast" + (err ? " err" : "");
    t.textContent = msg;
    $("#toasts").appendChild(t);
    setTimeout(() => t.remove(), ms);
  }

  function getPath(path) {
    if (path.startsWith("__proj.")) return state.editing?.[path.slice(7)];
    return path.split(".").reduce((o, k) => (o == null ? o : o[k]), state.c);
  }
  function setPath(path, val) {
    if (path.startsWith("__proj.")) { state.editing[path.slice(7)] = val; return; }
    const keys = path.split(".");
    let o = state.c;
    keys.slice(0, -1).forEach((k) => { if (o[k] == null) o[k] = {}; o = o[k]; });
    o[keys.at(-1)] = val;
  }

  const imgSrc = (v) => !v ? "" : /^(data:|https?:)/.test(v) ? v : imgCache.get(v) || "../" + v.replace(/^\.?\//, "");
  const slug = (s) => String(s || "item").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "item";

  function normalize(c) {
    c = c && typeof c === "object" ? c : {};
    c.profile = Object.assign({ name: "", initials: "", roles: [], headline: "", about: "", location: "", available: true, availableText: "", photo: "", aboutPhoto: "", email: "", whatsapp: "", resume: "" }, c.profile);
    ["stats", "socials", "skills", "projects", "experience", "gallery"].forEach((k) => { if (!Array.isArray(c[k])) c[k] = []; });
    c.settings = Object.assign({ accent: "#c8ff3d", seoTitle: "", seoDescription: "", showSkills: true, showExperience: true, showGallery: true }, c.settings);
    c.projects.forEach((p) => { if (!p.id) p.id = slug(p.title) + "-" + Math.random().toString(36).slice(2, 6); if (!Array.isArray(p.tags)) p.tags = []; });
    return c;
  }

  /* ---------------- dirty state + drafts ---------------- */
  let draftTimer;
  function changed() {
    const dirty = JSON.stringify(state.c) !== state.base;
    setStatus(dirty ? "dirty" : "ok", dirty ? "Unpublished changes (saved in this browser)" : "All changes published");
    clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraft, 400);
    renderDashboard();
  }
  function saveDraft() {
    const json = JSON.stringify(state.c);
    if (json === state.base) { store.del(DRAFT_KEY); store.del(DRAFT_TIME); return true; }
    const ok = store.set(DRAFT_KEY, json) && store.set(DRAFT_TIME, new Date().toISOString());
    if (!ok) toast("Browser storage is full — publish soon so you don't lose changes (large images use a lot of space).", true, 7000);
    return ok;
  }
  function setStatus(kind, text) {
    const s = $("#status");
    s.className = "status " + (kind === "ok" ? "" : kind);
    s.querySelector("span").textContent = text;
  }

  /* ---------------- simple field binding ---------------- */
  function bindFields(root = document) {
    $$("[data-path]", root).forEach((el) => {
      const path = el.dataset.path;
      const v = getPath(path);
      if (el.type === "checkbox") el.checked = v !== false && v != null ? !!v : false;
      else if (el.dataset.type === "lines") el.value = (v || []).join("\n");
      else el.value = v ?? "";
      if (el._bound) return;
      el._bound = true;
      el.addEventListener("input", () => {
        let val = el.type === "checkbox" ? el.checked : el.value;
        if (el.dataset.type === "lines") val = el.value.split("\n").map((x) => x.trim()).filter(Boolean);
        setPath(path, val);
        if (path === "settings.accent") renderSwatches();
        changed();
      });
    });
  }

  /* ---------------- images ---------------- */
  function compressImage(file, max = 1600, quality = 0.82) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith("image/")) return reject(new Error("Not an image"));
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement("canvas");
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        const ctx = cv.getContext("2d");
        ctx.fillStyle = "#0a0a0b"; ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        resolve(cv.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read image")); };
      img.src = url;
    });
  }

  function renderImageField(el) {
    const path = el.dataset.image;
    const v = getPath(path) || "";
    const src = imgSrc(v);
    el.innerHTML = `
      <div class="thumb ${src ? "has" : ""}" style="${src ? `background-image:url('${esc(src)}')` : ""}">${src ? "" : "No image"}</div>
      <div class="meta">
        <strong>${esc(el.dataset.label || "Image")}</strong>
        <div>
          <label class="btn sm">${v ? "Replace" : "Upload"}<input type="file" accept="image/*" hidden></label>
          ${v ? '<button type="button" class="btn sm ghost" data-remove>Remove</button>' : ""}
        </div>
        <input type="text" placeholder="…or paste an image URL / path" value="${v.startsWith("data:") ? "" : esc(v)}">
      </div>`;
    $("input[type=file]", el).onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const big = path === "__proj.image" || path.startsWith("gallery");
        setPath(path, await compressImage(f, big ? 1600 : 1200));
        renderImageField(el);
        if (!path.startsWith("__proj.")) changed();
      } catch (err) { toast(err.message, true); }
    };
    const rm = $("[data-remove]", el);
    if (rm) rm.onclick = () => { setPath(path, ""); renderImageField(el); if (!path.startsWith("__proj.")) changed(); };
    $("input[type=text]", el).onchange = (e) => { setPath(path, e.target.value.trim()); renderImageField(el); if (!path.startsWith("__proj.")) changed(); };
  }

  /* ---------------- generic lists ---------------- */
  const LISTS = {
    stats: {
      blank: () => ({ value: 0, suffix: "+", label: "" }),
      row: (x) => `<input type="number" data-k="value" value="${esc(x.value)}" placeholder="10">
        <input data-k="suffix" value="${esc(x.suffix)}" placeholder="K+">
        <input data-k="label" value="${esc(x.label)}" placeholder="Label, e.g. Happy clients">`,
    },
    skills: {
      blank: () => ({ name: "", level: 75 }),
      row: (x) => `<input data-k="name" value="${esc(x.name)}" placeholder="Skill name">
        <input type="range" min="0" max="100" data-k="level" value="${esc(x.level)}">
        <span class="num">${esc(x.level)}%</span>`,
    },
    socials: {
      blank: () => ({ label: "", url: "" }),
      row: (x) => `<input data-k="label" value="${esc(x.label)}" placeholder="LinkedIn">
        <input data-k="url" value="${esc(x.url)}" placeholder="https://…">`,
    },
    experience: {
      blank: () => ({ period: "", title: "", org: "", description: "" }),
      row: (x) => `<input data-k="period" value="${esc(x.period)}" placeholder="2023 — Present">
        <input data-k="title" value="${esc(x.title)}" placeholder="Job title / degree">
        <input data-k="org" value="${esc(x.org)}" placeholder="Company / college">
        <textarea data-k="description" rows="2" placeholder="What you did">${esc(x.description)}</textarea>`,
    },
  };

  function renderList(key) {
    const box = $(`[data-list="${key}"]`); if (!box) return;
    const arr = state.c[key];
    box.innerHTML = arr.length ? arr.map((x, i) => `
      <div class="row row-${key}" data-i="${i}">
        ${LISTS[key].row(x)}
        <div class="acts">
          <button type="button" data-act="up" title="Move up">↑</button>
          <button type="button" data-act="down" title="Move down">↓</button>
          <button type="button" data-act="del" class="del" title="Delete">✕</button>
        </div>
      </div>`).join("") : `<div class="empty">Nothing here yet.</div>`;
  }

  function wireList(key) {
    const box = $(`[data-list="${key}"]`); if (!box) return;
    box.addEventListener("input", (e) => {
      const row = e.target.closest("[data-i]"), k = e.target.dataset.k;
      if (!row || !k) return;
      const item = state.c[key][+row.dataset.i];
      item[k] = e.target.type === "number" || e.target.type === "range" ? Number(e.target.value) : e.target.value;
      if (e.target.type === "range") $(".num", row).textContent = e.target.value + "%";
      changed();
    });
    box.addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]"); if (!b) return;
      const i = +b.closest("[data-i]").dataset.i;
      moveOrDelete(state.c[key], i, b.dataset.act, () => renderList(key));
    });
  }

  function moveOrDelete(arr, i, act, rerender) {
    if (act === "del") {
      if (!confirm("Delete this item?")) return;
      arr.splice(i, 1);
    } else {
      const j = act === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= arr.length) return;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    rerender(); changed();
  }

  $$("[data-add]").forEach((b) => b.addEventListener("click", () => {
    const key = b.dataset.add;
    state.c[key].push(LISTS[key].blank());
    renderList(key); changed();
    const rows = $$(`[data-list="${key}"] .row`);
    rows.at(-1)?.querySelector("input, textarea")?.focus();
  }));

  /* ---------------- projects ---------------- */
  function renderProjects() {
    const q = $("#projSearch").value.toLowerCase();
    const cat = $("#projFilter").value;
    const cats = [...new Set(state.c.projects.map((p) => p.category).filter(Boolean))];
    $("#projFilter").innerHTML = `<option value="">All categories</option>` + cats.map((c) => `<option ${c === cat ? "selected" : ""}>${esc(c)}</option>`).join("");
    $("#catList").innerHTML = [...new Set([...cats, "Company", "Client", "My Product", "Social"])].map((c) => `<option value="${esc(c)}">`).join("");
    $("#projCount").textContent = state.c.projects.length;

    const list = state.c.projects.map((p, i) => ({ p, i })).filter(({ p }) =>
      (!cat || p.category === cat) && (!q || [p.title, p.description, p.client, ...(p.tags || [])].join(" ").toLowerCase().includes(q)));

    $("#projList").innerHTML = list.length ? list.map(({ p, i }) => {
      const src = imgSrc(p.image);
      return `<div class="proj" data-i="${i}">
        <div class="pthumb" style="${src ? `background-image:url('${esc(src)}')` : ""}">${src ? "" : esc((p.title || "?").slice(0, 2))}</div>
        <div>
          <h4>${esc(p.title || "Untitled")} ${p.featured ? '<span class="pill feat">★ Featured</span>' : ""} ${p.category ? `<span class="pill">${esc(p.category)}</span>` : ""}</h4>
          <p>${esc(p.description || "No description")}</p>
        </div>
        <div class="acts">
          <button data-act="feat" title="${p.featured ? "Unfeature" : "Make featured"}">${p.featured ? "★" : "☆"}</button>
          <button data-act="up" title="Move up">↑</button>
          <button data-act="down" title="Move down">↓</button>
          <button data-act="edit">Edit</button>
          <button data-act="del" class="del" title="Delete">✕</button>
        </div>
      </div>`;
    }).join("") : `<div class="empty">${state.c.projects.length ? "No projects match your search." : "No projects yet — click “New project”."}</div>`;
  }

  $("#projList").addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    const row = e.target.closest("[data-i]");
    if (!row) return;
    const i = +row.dataset.i;
    if (!b) return openProject(i);
    const act = b.dataset.act;
    if (act === "edit") return openProject(i);
    if (act === "feat") { state.c.projects[i].featured = !state.c.projects[i].featured; renderProjects(); return changed(); }
    moveOrDelete(state.c.projects, i, act, renderProjects);
  });
  $("#projSearch").addEventListener("input", renderProjects);
  $("#projFilter").addEventListener("change", renderProjects);
  $("#addProject").onclick = () => openProject(-1);

  function openProject(i) {
    state.editIndex = i;
    state.editing = i >= 0 ? structuredClone(state.c.projects[i]) :
      { id: "", title: "", category: "", featured: false, client: "", role: "", description: "", tags: [], image: "", live: "", github: "" };
    $("#drawerTitle").textContent = i >= 0 ? "Edit project" : "New project";
    $("#projDelete").style.visibility = i >= 0 ? "visible" : "hidden";
    const f = $("#projForm");
    ["title", "category", "client", "role", "description", "live", "github"].forEach((k) => (f.elements[k].value = state.editing[k] || ""));
    f.elements.tags.value = (state.editing.tags || []).join(", ");
    f.elements.featured.checked = !!state.editing.featured;
    renderImageField($('#drawer [data-image]'));
    document.body.classList.add("drawer-open");
    $("#drawer").setAttribute("aria-hidden", "false");
    setTimeout(() => f.elements.title.focus(), 300);
  }
  function closeProject() {
    document.body.classList.remove("drawer-open");
    $("#drawer").setAttribute("aria-hidden", "true");
    state.editing = null;
  }
  function saveProject() {
    const f = $("#projForm");
    const title = f.elements.title.value.trim();
    if (!title) { f.elements.title.focus(); return toast("Please give the project a title.", true); }
    const p = state.editing;
    ["title", "category", "client", "role", "description", "live", "github"].forEach((k) => (p[k] = f.elements[k].value.trim()));
    p.tags = f.elements.tags.value.split(",").map((t) => t.trim()).filter(Boolean);
    p.featured = f.elements.featured.checked;
    for (const k of ["live", "github"]) if (p[k] && !/^https?:\/\//i.test(p[k])) p[k] = "https://" + p[k];
    if (!p.id) p.id = slug(title) + "-" + Math.random().toString(36).slice(2, 6);
    if (state.editIndex >= 0) state.c.projects[state.editIndex] = p; else state.c.projects.unshift(p);
    closeProject(); renderProjects(); changed();
    toast(state.editIndex >= 0 ? "Project updated." : "Project added — press Publish to put it live.");
  }
  $("#projSave").onclick = saveProject;
  $("#projForm").addEventListener("submit", (e) => { e.preventDefault(); saveProject(); });
  $("#projCancel").onclick = closeProject;
  $("#drawerClose").onclick = closeProject;
  $("#drawerBg").onclick = closeProject;
  $("#projDelete").onclick = () => {
    if (state.editIndex < 0 || !confirm("Delete this project?")) return;
    state.c.projects.splice(state.editIndex, 1);
    closeProject(); renderProjects(); changed();
  };

  /* ---------------- gallery ---------------- */
  function renderGallery() {
    const g = state.c.gallery;
    $("#galleryList").innerHTML = g.length ? g.map((x, i) => `
      <div class="gitem" data-i="${i}">
        <div class="gimg" style="background-image:url('${esc(imgSrc(x.src))}')"></div>
        <div class="gbody">
          <input data-k="caption" value="${esc(x.caption)}" placeholder="Caption (optional)">
          <div class="acts"><button data-act="up" title="Move left">←</button><button data-act="down" title="Move right">→</button><button data-act="del" class="del" title="Delete">✕</button></div>
        </div>
      </div>`).join("") : `<div class="empty" style="grid-column:1/-1">No photos yet. Upload some — they appear in the “Behind the scenes” section.</div>`;
  }
  $("#galleryList").addEventListener("input", (e) => {
    const it = e.target.closest("[data-i]"); if (!it) return;
    state.c.gallery[+it.dataset.i].caption = e.target.value; changed();
  });
  $("#galleryList").addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    moveOrDelete(state.c.gallery, +b.closest("[data-i]").dataset.i, b.dataset.act, renderGallery);
  });
  $("#galleryUpload").onchange = async (e) => {
    const files = [...e.target.files];
    setStatus("busy", `Processing ${files.length} photo(s)…`);
    for (const f of files) {
      try { state.c.gallery.push({ src: await compressImage(f, 1600), caption: "" }); }
      catch (err) { toast(`${f.name}: ${err.message}`, true); }
    }
    e.target.value = "";
    renderGallery(); changed();
  };

  /* ---------------- settings ---------------- */
  function renderSwatches() {
    const cur = (state.c.settings.accent || "").toLowerCase();
    $("#swatches").innerHTML = ACCENTS.map((a) => `<button type="button" data-c="${a}" class="${a === cur ? "on" : ""}" style="background:${a}" title="${a}"></button>`).join("");
  }
  $("#swatches").addEventListener("click", (e) => {
    const b = e.target.closest("[data-c]"); if (!b) return;
    state.c.settings.accent = b.dataset.c;
    $('[data-path="settings.accent"]').value = b.dataset.c;
    renderSwatches(); changed();
  });

  /* ---------------- dashboard ---------------- */
  function renderDashboard() {
    const c = state.c;
    const k = [
      [c.projects.length, "Projects", "projects"],
      [c.projects.filter((p) => p.featured).length, "Featured case studies", "projects"],
      [c.skills.length, "Skills", "skills"],
      [c.gallery.length, "Gallery photos", "gallery"],
    ];
    $("#kpis").innerHTML = k.map(([n, l, t]) => `<div class="kpi" data-go="${t}"><b>${n}</b><span>${l}</span></div>`).join("");
    const gh = ghCfg();
    $("#ghHint").textContent = gh.token ? `Connected to ${gh.owner}/${gh.repo} (${gh.branch}).` : "⚠ Not connected to GitHub yet — open “GitHub connection” to set it up.";
    $("#ghDot").classList.toggle("ok", !!gh.token);
    $("#projCount").textContent = c.projects.length;
  }

  /* ---------------- tabs ---------------- */
  function go(tab) {
    if (!$(`[data-panel="${tab}"]`)) tab = "dashboard";
    $$("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
    $$(".panel").forEach((p) => p.classList.toggle("on", p.dataset.panel === tab));
    document.body.classList.remove("nav-open");
    history.replaceState(null, "", "#" + tab);
    window.scrollTo(0, 0);
  }
  $("#tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) go(b.dataset.tab); });
  document.addEventListener("click", (e) => {
    const g = e.target.closest("[data-go]"); if (!g) return;
    go(g.dataset.go);
    if (g.hasAttribute("data-new")) openProject(-1);
  });
  $("#menuToggle").onclick = () => document.body.classList.toggle("nav-open");

  /* ---------------- preview / download / import ---------------- */
  $("#previewBtn").onclick = () => {
    if (!store.set(DRAFT_KEY, JSON.stringify(state.c))) return toast("Not enough browser storage to preview — publish or remove some images.", true);
    store.set(DRAFT_TIME, new Date().toISOString());
    window.open("../?preview=1", "_blank");
  };
  function download() {
    const blob = new Blob([JSON.stringify(state.c, null, 2)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "content.json" });
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  $("#downloadBtn").onclick = download;
  $("#downloadBtn2").onclick = download;
  $("#importJson").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const data = normalize(JSON.parse(await f.text()));
      if (!confirm("Replace everything in the editor with this file?")) return;
      state.c = data; renderAll(); changed(); toast("Imported. Press Publish to put it live.");
    } catch { toast("That file is not valid JSON.", true); }
    e.target.value = "";
  };

  /* ---------------- GitHub ---------------- */
  function ghCfg() {
    try { return Object.assign({ owner: "", repo: "", branch: "main", path: "", token: "" }, JSON.parse(store.get(GH_KEY) || "{}")); }
    catch { return { owner: "", repo: "", branch: "main", path: "", token: "" }; }
  }
  const prefix = (gh) => (gh.path || "").replace(/^\/+|\/+$/g, "").replace(/(.+)/, "$1/");

  async function api(gh, path, opts = {}) {
    const res = await fetch("https://api.github.com" + path, {
      ...opts,
      headers: { Accept: "application/vnd.github+json", Authorization: "Bearer " + gh.token, "X-GitHub-Api-Version": "2022-11-28", ...(opts.body ? { "Content-Type": "application/json" } : {}) },
    });
    if (!res.ok) {
      let m = res.statusText; try { m = (await res.json()).message || m; } catch { /* ignore */ }
      const err = new Error(`GitHub: ${m} (${res.status})`); err.status = res.status; throw err;
    }
    return res.status === 204 ? null : res.json();
  }

  const b64encode = (bytes) => { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
  const utf8b64 = (str) => b64encode(new TextEncoder().encode(str));
  const b64utf8 = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), (c) => c.charCodeAt(0)));

  async function ghReadContent(gh) {
    const f = await api(gh, `/repos/${gh.owner}/${gh.repo}/contents/${prefix(gh)}content.json?ref=${encodeURIComponent(gh.branch)}`);
    return JSON.parse(b64utf8(f.content));
  }

  function fillGhForm() {
    const gh = ghCfg();
    $("#ghOwner").value = gh.owner; $("#ghRepo").value = gh.repo; $("#ghBranch").value = gh.branch; $("#ghPath").value = gh.path;
    $("#ghToken").value = gh.token ? "••••••••••••" : "";
  }
  $("#ghSave").onclick = async () => {
    const old = ghCfg();
    const tokenInput = $("#ghToken").value.trim();
    const gh = {
      owner: $("#ghOwner").value.trim(), repo: $("#ghRepo").value.trim(), branch: $("#ghBranch").value.trim() || "main",
      path: $("#ghPath").value.trim(), token: tokenInput.startsWith("•") ? old.token : tokenInput,
    };
    if (!gh.owner || !gh.repo || !gh.token) return ($("#ghResult").textContent = "Please fill in username, repository and token.");
    $("#ghResult").textContent = "Testing…";
    try {
      const repo = await api(gh, `/repos/${gh.owner}/${gh.repo}`);
      if (repo.permissions && !repo.permissions.push) throw new Error("This token cannot write to the repo. Give it “Contents: Read and write”.");
      await api(gh, `/repos/${gh.owner}/${gh.repo}/git/ref/heads/${encodeURIComponent(gh.branch)}`);
      store.set(GH_KEY, JSON.stringify(gh));
      $("#ghResult").textContent = `✅ Connected to ${repo.full_name} (${gh.branch}). You can publish now.`;
      fillGhForm(); renderDashboard();
    } catch (err) {
      $("#ghResult").textContent = "❌ " + (err.status === 404 ? "Repository or branch not found — check the names, and that the token has access to this repo." : err.message);
    }
  };
  $("#ghForget").onclick = () => {
    const gh = ghCfg(); gh.token = ""; store.set(GH_KEY, JSON.stringify(gh));
    fillGhForm(); renderDashboard(); $("#ghResult").textContent = "Token removed from this browser.";
  };

  let publishing = false;
  async function publish() {
    if (publishing) return;
    const gh = ghCfg();
    if (!gh.token) { go("github"); return toast("Connect GitHub first so I know where to publish.", true); }
    if (JSON.stringify(state.c) === state.base) return toast("Nothing new to publish.");
    publishing = true;
    $("#publishBtn").disabled = true;
    setStatus("busy", "Publishing…");
    try {
      const pre = prefix(gh);
      const out = structuredClone(state.c);
      const files = [];
      const stamp = Date.now().toString(36);
      let n = 0;
      const walk = (o) => {
        for (const k in o) {
          const v = o[k];
          if (typeof v === "string" && v.startsWith("data:image/")) {
            const mime = v.slice(5, v.indexOf(";"));
            const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" }[mime] || "jpg";
            const rel = `images/uploads/${stamp}-${++n}.${ext}`;
            files.push({ path: pre + rel, b64: v.slice(v.indexOf(",") + 1) });
            imgCache.set(rel, v);
            o[k] = rel;
          } else if (v && typeof v === "object") walk(v);
        }
      };
      walk(out);
      const json = JSON.stringify(out, null, 2) + "\n";
      files.push({ path: pre + "content.json", b64: utf8b64(json) });

      const R = `/repos/${gh.owner}/${gh.repo}`;
      const ref = await api(gh, `${R}/git/ref/heads/${encodeURIComponent(gh.branch)}`);
      const head = await api(gh, `${R}/git/commits/${ref.object.sha}`);
      const tree = [];
      for (const [i, f] of files.entries()) {
        setStatus("busy", `Uploading ${i + 1}/${files.length}…`);
        const blob = await api(gh, `${R}/git/blobs`, { method: "POST", body: JSON.stringify({ content: f.b64, encoding: "base64" }) });
        tree.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
      }
      const newTree = await api(gh, `${R}/git/trees`, { method: "POST", body: JSON.stringify({ base_tree: head.tree.sha, tree }) });
      const msg = `Update portfolio content via admin${n ? ` (+${n} image${n > 1 ? "s" : ""})` : ""}`;
      const commit = await api(gh, `${R}/git/commits`, { method: "POST", body: JSON.stringify({ message: msg, tree: newTree.sha, parents: [ref.object.sha] }) });
      await api(gh, `${R}/git/refs/heads/${encodeURIComponent(gh.branch)}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha }) });

      state.c = out;
      state.base = JSON.stringify(out);
      store.del(DRAFT_KEY); store.del(DRAFT_TIME);
      renderAll(); changed();
      toast("🚀 Published! Your live site will update in about a minute.", false, 6000);
    } catch (err) {
      setStatus("dirty", "Publish failed — your changes are still saved here");
      toast(err.message, true, 8000);
    } finally {
      publishing = false;
      $("#publishBtn").disabled = false;
    }
  }
  $("#publishBtn").onclick = publish;
  addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); publish(); }
    if (e.key === "Escape" && document.body.classList.contains("drawer-open")) closeProject();
  });

  /* ---------------- init ---------------- */
  function renderAll() {
    bindFields();
    $$("main [data-image]").forEach(renderImageField);
    Object.keys(LISTS).forEach(renderList);
    renderProjects(); renderGallery(); renderSwatches(); renderDashboard(); fillGhForm();
  }

  async function init() {
    Object.keys(LISTS).forEach(wireList);
    const gh = ghCfg();
    let c = null;
    if (gh.token) { try { c = await ghReadContent(gh); } catch (err) { console.warn(err); } }
    if (!c) {
      try { c = await (await fetch("../content.json?v=" + Date.now(), { cache: "no-store" })).json(); }
      catch { toast("Could not load content.json — starting with an empty portfolio.", true); c = {}; }
    }
    state.c = normalize(c);
    state.base = JSON.stringify(state.c);

    const draft = store.get(DRAFT_KEY);
    if (draft && draft !== state.base) {
      const t = store.get(DRAFT_TIME);
      $("#draftTime").textContent = t ? new Date(t).toLocaleString() : "earlier";
      $("#draftBanner").hidden = false;
      $("#restoreDraft").onclick = () => {
        try { state.c = normalize(JSON.parse(draft)); renderAll(); changed(); toast("Draft restored."); }
        catch { toast("Draft was corrupted.", true); }
        $("#draftBanner").hidden = true;
      };
      $("#discardDraft").onclick = () => { store.del(DRAFT_KEY); store.del(DRAFT_TIME); $("#draftBanner").hidden = true; };
    }

    renderAll();
    setStatus("ok", "All changes published");
    go(location.hash.slice(1) || "dashboard");
  }
  init();
})();
