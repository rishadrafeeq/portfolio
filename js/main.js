/* Portfolio renderer — all content comes from content.json (edited via /admin). */
(() => {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = (u) => (/^(https?:|mailto:|tel:|images\/|\.\/|\/|data:image\/)/i.test(String(u || "").trim()) ? String(u).trim() : "#");
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const ICONS = {
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
    whatsapp: '<svg class="wa-ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z"/><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.83 9.83 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.22 8.22 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24Z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8ZM9.7 15.1V8.9L15.5 12l-5.8 3.1Z"/></svg>',
  };

  // Skill groups (new format), with fallback for the old flat "skills" list.
  function skillGroups(c) {
    if (Array.isArray(c.skillGroups) && c.skillGroups.length) return c.skillGroups.filter((g) => g.title || g.items?.length);
    if (Array.isArray(c.skills) && c.skills.length) return [{ title: "Skills", note: "", items: c.skills.map((k) => k.name) }];
    return [];
  }
  // Multi-line text -> bullet list; single line -> paragraph.
  function lines(text) {
    const ls = String(text || "").split("\n").map((l) => l.trim()).filter(Boolean);
    if (ls.length < 2) return `<p>${esc(ls[0] || "")}</p>`;
    return `<ul class="bullets">${ls.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`;
  }

  async function loadContent() {
    const params = new URLSearchParams(location.search);
    if (params.has("preview")) {
      try {
        const draft = localStorage.getItem("portfolio-draft");
        if (draft) {
          document.body.insertAdjacentHTML("beforeend", '<div class="preview-banner">Preview — unsaved changes from admin</div>');
          return JSON.parse(draft);
        }
      } catch { /* fall through */ }
    }
    const res = await fetch("content.json?v=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("content.json not found");
    return res.json();
  }

  function render(c) {
    const p = c.profile || {};
    const s = c.settings || {};

    // theme + SEO
    if (s.accent) document.documentElement.style.setProperty("--accent", s.accent);
    if (s.seoTitle) document.title = s.seoTitle;
    if (s.seoDescription) $('meta[name="description"]').setAttribute("content", s.seoDescription);

    $$("[data-bind]").forEach((el) => { const v = p[el.dataset.bind]; if (v) el.textContent = v; });
    const ini = (p.initials || "RR").slice(0, 3);
    $("#loader span").innerHTML = [...ini].map((ch) => `<i>${esc(ch)}</i>`).join("");

    // hero name — last word in serif accent
    const parts = (p.name || "").trim().split(/\s+/);
    const last = parts.length > 1 ? parts.pop() : "";
    $("#heroName").innerHTML = `<span class="line"><span>${esc(parts.join(" "))}</span></span>` +
      (last ? `<span class="line"><span class="serif accent">${esc(last)}</span></span>` : "");
    $("#availBadge").style.display = p.available === false ? "none" : "";

    const photo = (src, alt) => src ? `<img src="${esc(safeUrl(src))}" alt="${esc(alt)}">` : `<div class="monogram">${esc(ini)}</div>`;
    $("#heroPhoto").innerHTML = photo(p.photo, p.name) + (p.location ? `<span class="tag">📍 ${esc(p.location)}</span>` : "");
    $("#aboutPhoto").innerHTML = photo(p.aboutPhoto || p.photo, p.name);

    // marquee
    const groups = skillGroups(c);
    const words = [...new Set([...groups.flatMap((g) => g.items || []), ...(c.projects || []).flatMap((x) => x.tags || [])])].slice(0, 16);
    const mq = words.map((w) => `<span>${esc(w)}</span>`).join("");
    $("#marquee").innerHTML = mq; $("#marquee2").innerHTML = mq;

    // projects
    const projects = c.projects || [];
    const featured = projects.filter((x) => x.featured);
    const rest = projects.filter((x) => !x.featured);
    $("#work").style.display = featured.length ? "" : "none";

    const browser = (x) => `
      <div class="browser">
        <div class="browser-bar"><i></i><i></i><i></i><span class="url">${esc(host(x.live) || x.title)}</span></div>
        <div class="browser-view"><img src="${esc(safeUrl(x.image))}" alt="${esc(x.title)} preview" loading="lazy"></div>
      </div>`;

    $("#cases").innerHTML = featured.map((x, i) => `
      <article class="case">
        <a class="case-media reveal reveal-img" href="${esc(safeUrl(x.live))}" target="_blank" rel="noopener" data-cursor>
          ${x.image ? browser(x) : `<div class="card-art default">${esc(x.title.slice(0, 2))}</div>`}
          <span class="view-pill">Visit<br>site ↗</span>
        </a>
        <div class="case-info reveal">
          <span class="case-num">${String(i + 1).padStart(2, "0")} / ${String(featured.length).padStart(2, "0")}</span>
          ${x.client ? `<div class="case-client">${esc(x.client)}</div>` : ""}
          <h3>${esc(x.title)}</h3>
          <p class="case-desc">${esc(x.description)}</p>
          <dl class="meta-row">
            ${x.role ? `<dt>Role</dt><dd>${esc(x.role)}</dd>` : ""}
            <dt>Type</dt><dd>${esc(x.category || "Project")}</dd>
            ${x.tags?.length ? `<dt>Stack</dt><dd class="chips">${x.tags.map((t) => `<span class="chip">${esc(t)}</span>`).join("")}</dd>` : ""}
          </dl>
          <div class="hero-actions" style="margin-top:0">
            ${x.live ? `<a class="btn btn-primary" href="${esc(safeUrl(x.live))}" target="_blank" rel="noopener">Visit live site <span class="arrow">↗</span></a>` : ""}
            ${x.github ? `<a class="btn btn-ghost" href="${esc(safeUrl(x.github))}" target="_blank" rel="noopener">GitHub</a>` : ""}
          </div>
        </div>
      </article>`).join("");

    const art = (x) => {
      const u = (x.live || "").toLowerCase();
      if (u.includes("instagram.com")) return `<div class="card-art instagram">${ICONS.instagram}</div>`;
      if (u.includes("youtube.com") || u.includes("youtu.be")) return `<div class="card-art youtube">${ICONS.youtube}</div>`;
      return `<div class="card-art default">${esc((x.title || "?").slice(0, 2))}</div>`;
    };

    $("#projects").style.display = rest.length ? "" : "none";
    $("#grid").innerHTML = rest.map((x) => `
      <article class="card reveal" data-cat="${esc(x.category)}">
        ${x.image ? `<a href="${esc(safeUrl(x.live))}" target="_blank" rel="noopener">${browser(x)}</a>` : art(x)}
        <div class="card-body">
          <div class="card-top"><span>${esc(x.category)}</span><span>${esc(x.role || "")}</span></div>
          <h4>${esc(x.title)}</h4>
          <p>${esc(x.description)}</p>
          ${x.tags?.length ? `<div class="chips">${x.tags.map((t) => `<span class="chip">${esc(t)}</span>`).join("")}</div>` : ""}
          <div class="card-links">
            ${x.live ? `<a href="${esc(safeUrl(x.live))}" target="_blank" rel="noopener">${/instagram|youtu/.test(x.live) ? "Visit" : "Live site"} ↗</a>` : ""}
            ${x.github ? `<a href="${esc(safeUrl(x.github))}" target="_blank" rel="noopener">GitHub ↗</a>` : ""}
          </div>
        </div>
      </article>`).join("");

    const cats = ["All", ...new Set(rest.map((x) => x.category).filter(Boolean))];
    $("#filters").innerHTML = cats.map((k, i) => `<button class="${i ? "" : "on"}">${esc(k)}</button>`).join("");
    $("#filters").style.display = cats.length > 2 ? "" : "none";
    $("#filters").onclick = (e) => {
      const b = e.target.closest("button"); if (!b) return;
      $$("#filters button").forEach((x) => x.classList.toggle("on", x === b));
      $$("#grid .card").forEach((card) => card.classList.toggle("hide", b.textContent !== "All" && card.dataset.cat !== b.textContent));
    };

    // about — word-by-word scroll highlight
    $("#aboutText").innerHTML = esc(p.about || "").split(/\s+/).map((w) => `<span class="w">${w}</span>`).join(" ");
    $("#aboutMeta").innerHTML = [p.location && `📍 ${esc(p.location)}`, p.email && `✉️ ${esc(p.email)}`].filter(Boolean).map((t) => `<span>${t}</span>`).join("");
    $("#stats").innerHTML = (c.stats || []).map((st) =>
      `<div class="stat"><b data-count="${Number(st.value) || 0}" data-suffix="${esc(st.suffix || "")}">0</b><span>${esc(st.label)}</span></div>`).join("");
    $("#stats").style.display = c.stats?.length ? "" : "none";

    // skills
    $("#skills").style.display = s.showSkills === false || !groups.length ? "none" : "";
    $("#skillList").className = "skill-groups";
    $("#skillList").innerHTML = groups.map((g, i) => `
      <div class="skill-group reveal">
        <span class="sg-num">${String(i + 1).padStart(2, "0")}</span>
        <h3>${esc(g.title)}</h3>
        ${g.note ? `<p class="sg-note">${esc(g.note)}</p>` : ""}
        <ul>${(g.items || []).map((it) => `<li>${esc(it)}</li>`).join("")}</ul>
      </div>`).join("");

    // experience
    const showExp = s.showExperience !== false && c.experience?.length;
    $("#experience").style.display = showExp ? "" : "none";
    $$('[data-section="experience"]').forEach((a) => (a.style.display = showExp ? "" : "none"));
    $("#expList").innerHTML = (c.experience || []).map((x) => `
      <div class="exp-row reveal"><span class="period">${esc(x.period)}</span>
      <h4>${esc(x.title)}<small>${esc(x.org)}</small></h4>${lines(x.description)}</div>`).join("");

    // gallery
    const gal = (c.gallery || []).filter((g) => g.src);
    $("#gallery").style.display = s.showGallery === false || !gal.length ? "none" : "";
    $("#galleryGrid").innerHTML = gal.map((g) => `
      <figure class="reveal"><img src="${esc(safeUrl(g.src))}" alt="${esc(g.caption || "")}" loading="lazy">${g.caption ? `<figcaption>${esc(g.caption)}</figcaption>` : ""}</figure>`).join("");

    // contact
    const waNum = String(p.whatsapp || "").replace(/\D/g, "");
    const wa = waNum ? `https://wa.me/${waNum}` : "";
    const li = (c.socials || []).find((x) => /linkedin/i.test(x.label));
    const primary = wa || (p.email ? `mailto:${p.email}` : li?.url || "#");
    const cb = $("#contactBtn");
    cb.href = safeUrl(primary);
    if (!primary.startsWith("mailto")) { cb.target = "_blank"; cb.rel = "noopener"; }
    cb.innerHTML = wa ? `${ICONS.whatsapp}<span>Chat on<br>WhatsApp</span>` : "Start a<br>project ↗";
    if (wa) {
      const hw = $("#heroWa");
      hw.href = wa; hw.target = "_blank"; hw.rel = "noopener";
      hw.innerHTML = `${ICONS.whatsapp} WhatsApp me`;
      const fl = $("#waFloat");
      fl.href = wa; fl.innerHTML = ICONS.whatsapp + "<span>Chat on WhatsApp</span>";
      fl.hidden = s.showWhatsappButton === false;
    }
    $("#contactActions").innerHTML = [
      wa && `<a class="btn btn-ghost" href="${esc(wa)}" target="_blank" rel="noopener">${ICONS.whatsapp} ${esc(p.whatsapp)}</a>`,
      p.email && `<a class="btn btn-ghost" href="mailto:${esc(p.email)}">${esc(p.email)}</a>`,
      p.resume && `<a class="btn btn-ghost" href="${esc(safeUrl(p.resume))}" target="_blank" rel="noopener">Download résumé</a>`,
    ].filter(Boolean).join("");
    $("#socials").innerHTML = (c.socials || []).filter((x) => x.url && !(wa && /wa\.me|whatsapp/i.test(x.url))).map((x) =>
      `<a href="${esc(safeUrl(x.url))}" target="_blank" rel="noopener">${esc(x.label)} ↗</a>`).join("");

    $("#year").textContent = new Date().getFullYear();
    return p;
  }

  /* ---------------- interactions ---------------- */
  function interactions(p) {
    // role typer
    const roles = (p.roles || []).filter(Boolean);
    const el = $("#role");
    if (roles.length) {
      let r = 0, i = 0, del = false;
      (function tick() {
        const w = roles[r];
        el.textContent = w.slice(0, (i += del ? -1 : 1));
        if (!del && i === w.length) { del = true; return setTimeout(tick, 1800); }
        if (del && i === 0) { del = false; r = (r + 1) % roles.length; }
        setTimeout(tick, del ? 35 : 70);
      })();
    }

    // reveal on scroll
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const t = en.target;
      t.classList.add("in");
      $$(".skill-bar i", t).forEach((b) => (b.style.width = b.dataset.w + "%"));
      if (t.id === "stats") $$("[data-count]", t).forEach(countUp);
      io.unobserve(t);
    }), { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
    $$(".reveal, .split").forEach((t) => {
      const sib = [...t.parentElement.children].filter((x) => x.classList.contains("reveal"));
      if (t.classList.contains("card") || t.classList.contains("skill")) t.style.transitionDelay = (sib.indexOf(t) % 3) * 0.08 + "s";
      io.observe(t);
    });

    function countUp(b) {
      const end = +b.dataset.count, suf = b.dataset.suffix, t0 = performance.now();
      (function step(now) {
        const k = Math.min((now - t0) / 1600, 1);
        b.textContent = Math.round(end * (1 - Math.pow(1 - k, 4))) + (k === 1 ? suf : "");
        if (k < 1) requestAnimationFrame(step);
      })(t0);
    }

    // about words highlight with scroll
    const words = $$("#aboutText .w");
    const aboutText = $("#aboutText");
    const nav = $("#nav");
    let lastY = scrollY;
    function onScroll() {
      const y = scrollY;
      nav.classList.toggle("scrolled", y > 30);
      nav.classList.toggle("hidden", y > lastY && y > 400 && !document.body.classList.contains("menu-open"));
      lastY = y;
      if (words.length) {
        const r = aboutText.getBoundingClientRect();
        const prog = Math.min(1, Math.max(0, (innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.35)));
        const n = Math.round(prog * words.length);
        words.forEach((w, i) => w.classList.toggle("on", i < n));
      }
    }
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    // mobile menu
    $("#menuBtn").onclick = () => document.body.classList.toggle("menu-open");
    $("#navLinks").onclick = (e) => { if (e.target.tagName === "A") document.body.classList.remove("menu-open"); };

    // lightbox
    $("#galleryGrid").onclick = (e) => {
      const img = e.target.closest("figure")?.querySelector("img");
      if (img) { $("#lightbox img").src = img.src; $("#lightbox").classList.add("open"); }
    };
    $("#lightbox").onclick = () => $("#lightbox").classList.remove("open");
    addEventListener("keydown", (e) => e.key === "Escape" && $("#lightbox").classList.remove("open"));

    if (reduced || matchMedia("(hover: none)").matches) return;

    // cursor + hero glow
    const cur = $(".cursor"), glow = $("#glow");
    addEventListener("mousemove", (e) => {
      cur.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
      if (scrollY < innerHeight) { glow.style.left = e.clientX + "px"; glow.style.top = e.clientY + "px"; }
    });
    document.addEventListener("mouseover", (e) => cur.classList.toggle("big", !!e.target.closest("a, button, [data-cursor]")));

    // card spotlight
    $$(".card").forEach((card) => card.addEventListener("mousemove", (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", e.clientX - r.left + "px");
      card.style.setProperty("--my", e.clientY - r.top + "px");
    }));

    // magnetic buttons
    $$(".magnetic, .btn-primary").forEach((b) => {
      b.addEventListener("mousemove", (e) => {
        const r = b.getBoundingClientRect();
        b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.25}px, ${(e.clientY - r.top - r.height / 2) * 0.25}px)`;
      });
      b.addEventListener("mouseleave", () => (b.style.transform = ""));
    });
  }

  function done() { setTimeout(() => document.body.classList.add("loaded"), reduced ? 0 : 700); }

  loadContent()
    .then((c) => { interactions(render(c)); done(); })
    .catch((err) => {
      console.error(err);
      done();
      document.querySelector("main").insertAdjacentHTML("afterbegin",
        '<p style="position:fixed;top:90px;left:16px;right:16px;z-index:100;padding:14px;border-radius:12px;background:#3a1212;color:#fff">Could not load content.json. Open the site through a web server (not by double-clicking the file).</p>');
    });
})();
