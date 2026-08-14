/* FOUNDATION — shared behaviour (theme-agnostic).
   Light/dark toggle (persisted, dark-default unless a base
   overrides), Save-as-PDF via native print, and SharePoint-preview detection.
   Self-contained: no external deps. The theme restore runs in <head> separately
   to avoid a flash; this file wires the controls at end-of-body. */
(function () {
  var KEY = "hop-doc-theme";
  var html = document.documentElement;

  // ===== Links always open in a new tab (never navigate away from the artifact) =====
  // A link should pop a new tab, not
  // replace the doc the reader is in. Author-agnostic — rewrites every <a href> that doesn't
  // already declare a target, so no base/component/inline body content has to remember to set
  // it by hand. In-page anchors (href="#...", TOC/jump links) are excluded — those should stay
  // in the same tab and just scroll.
  document.querySelectorAll('a[href]:not([target])').forEach(function (a) {
    if (a.getAttribute('href').charAt(0) === '#') return;
    a.target = '_blank';
    a.rel = (a.rel ? a.rel + ' ' : '') + 'noopener';
  });

  // data-theme is always explicit ("light" | "dark"); the per-doc <head> restore
  // sets the default. Toggle just flips between the two explicit values.
  function setTheme(next) {
    if (next !== "light" && next !== "dark") next = html.getAttribute("data-theme") === "light" ? "dark" : "light";
    html.setAttribute("data-theme", next);
    // Sync root color-scheme with the ACTIVE theme. foundation.css ships a static
    // `color-scheme:light dark`; per CSS Color Adjustment L1 a root color-scheme that
    // disagrees with the visual theme makes the UA paint mismatched canvases (iframe
    // backdrops, form controls, scrollbars).
    html.style.colorScheme = next;
    try { localStorage.setItem(KEY, next); } catch (e) {}
  }
  // Initial sync too (an explicit data-theme from storage/attribute skips setTheme).
  if (html.getAttribute("data-theme") === "light" || html.getAttribute("data-theme") === "dark") {
    html.style.colorScheme = html.getAttribute("data-theme");
  }
  var t = document.getElementById("fdnTheme");
  if (t) t.onclick = function () { setTheme(); };

  // Save-as-PDF via native print — wired ONLY if the base ships the #fdnPdf button. The prose
  // base ships it (window.print → the doc's @media print profile does the work); a deck base
  // may omit it in favour of a pre-rendered export.
  var p = document.getElementById("fdnPdf");
  if (p) p.onclick = function () { window.print(); };

  // ===== data-fit text shrinker (vendored micro-fitter; same philosophy as the culture
  // deck's usePretextFit: binary-search the largest font-size that fits, re-run on resize).
  // Opt-in via data-fit (optional data-fit-min="px"); AUTO-applied to .stat-tile .label so
  // KPI strips never wrap sloppily. Shrink-only: max = the element's authored size. =====
  (function () {
    function fit(el) {
      var max = parseFloat(el.getAttribute("data-fit-max") || el.dataset.fitBase || "");
      if (!max) { max = parseFloat(getComputedStyle(el).fontSize) || 16; el.dataset.fitBase = String(max); }
      var min = parseFloat(el.getAttribute("data-fit-min") || "") || Math.max(9, Math.round(max * 0.6));
      var lo = min, hi = max, best = min;
      while (lo <= hi) {
        var mid = Math.floor((lo + hi) / 2);
        el.style.fontSize = mid + "px";
        var over = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
        if (over) { hi = mid - 1; } else { best = mid; lo = mid + 1; }
      }
      el.style.fontSize = best + "px";
    }
    function all() {
      var els = document.querySelectorAll("[data-fit], .stat-tile .label");
      for (var i = 0; i < els.length; i++) fit(els[i]);
    }
    if (document.fonts && document.fonts.ready) { document.fonts.ready.then(all); } else { all(); }
    if (typeof ResizeObserver !== "undefined") {
      var ro = new ResizeObserver(function () { all(); });
      ro.observe(document.documentElement);
    } else { window.addEventListener("resize", all); }
  })();

  // Modern SharePoint preview RUNS page JS but sandboxes navigation & printing (window.print
  // is a silent no-op, in-page section links land imprecisely). So the download banner must
  // key on the HOST, not on "did JS run" (the old, now-false premise). It ships VISIBLE and we
  // hide it everywhere the file is fully functional — standalone, an embedding viewer, a blob-URL
  // companion, mobile — keeping it ONLY inside SharePoint's own preview frame.
  function inSharePointPreview() {
    var rx = /(^|\.)sharepoint\.com$/i;
    try {                                                   // Chromium + WebKit; undefined in Firefox
      var ao = location.ancestorOrigins;
      for (var i = 0; ao && i < ao.length; i++) {
        try { if (rx.test(new URL(ao[i]).host)) return true; } catch (e) {}
      }
    } catch (e) {}
    var framed = false;
    try { framed = window.self !== window.top; } catch (e) { framed = true; }
    if (framed && document.referrer) {                      // Firefox fallback, embed-gated so an
      try {                                                 // "open in new tab from SharePoint" top-
        if (rx.test(new URL(document.referrer).host)) return true;   // level page can't false-positive
      } catch (e) {}
    }
    return false;
  }
  var w = document.getElementById("fdnSpWarn");
  if (w && !inSharePointPreview()) w.style.display = "none";

  // ===== Overflow backstop with INVARIANT TITLES (decks / report panels) =====
  // The slide TITLE is a fixed design element — it must read the SAME size on every slide, so the
  // fit backstop must NEVER scale it. Mechanism: wrap each slide-body's NON-heading content in a
  // .fit-zone and scale ONLY that zone when TEXT genuinely over-crams (media is already elastic via
  // the block model, so an image never drives this). Headings/kickers stay cqi-constant. When even
  // the FLOOR still clips, data-overflow="true" flags the slide to be SPLIT — the per-slide QA
  // signal (never a ship state). Same 16:9 on screen + print, so the bounded scale carries into the
  // PDF. Covers/dividers are intentional whitespace (centered) and are skipped.
  var FLOOR = 0.82;
  function fitZoneOf(body) {
    var fz = body.querySelector(':scope > .fit-zone');
    if (fz) return fz;
    var kids = Array.prototype.slice.call(body.children), i = 0;
    while (i < kids.length) {                                 // leading heading group is never scaled
      var el = kids[i], tag = el.tagName;
      if (!(tag === 'H1' || tag === 'H2' || el.classList.contains('kicker') || el.classList.contains('eyebrow'))) break;
      i++;
    }
    if (i >= kids.length) return null;                        // heading-only slide → nothing to scale
    fz = document.createElement('div');
    fz.className = 'fit-zone';
    body.insertBefore(fz, kids[i]);
    for (var j = i; j < kids.length; j++) fz.appendChild(kids[j]);
    return fz;
  }
  function markOverflow() {
    var panels = document.querySelectorAll('.slide:not(.cover):not(.divider) > .slide-body, .page > .slide-body');
    panels.forEach(function (body) {
      var fz = fitZoneOf(body);
      if (!fz) return;
      fz.style.transform = '';                                // reset before measuring
      fz.style.justifyContent = '';                           // restore the zone's CSS justify (e.g. .center) to measure
      body.removeAttribute('data-overflow');
      var avail = fz.clientHeight, need = fz.scrollHeight;
      if (need > avail + 1) {
        var raw = avail / need, k = Math.max(raw, FLOOR);
        fz.style.justifyContent = 'flex-start';               // top-anchor while scaled so a top-origin scale can't leave a .center zone clipped
        fz.style.transformOrigin = 'top center';
        fz.style.transform = 'scale(' + k + ')';
        if (raw < FLOOR) body.setAttribute('data-overflow', 'true');   // floor still clips → split it
      }
    });
  }
  if (document.querySelector('.slide, .page')) {
    markOverflow();
    var rt;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(markOverflow, 120); });
    window.addEventListener('beforeprint', markOverflow);
  }

  // ===== Auto page-numbering (decks) =====
  // Number every .panel-chrome .pageno "N / TOTAL" so adding/removing slides never
  // means hand-renumbering. Skips a slide whose .pageno has data-fixed (rare manual).
  var deck = document.querySelector('.hop-doc[data-doc-type="deck"]');
  if (deck) {
    var nums = deck.querySelectorAll('.slide .pageno');
    var total = nums.length;
    nums.forEach(function (el, i) {
      if (el.hasAttribute('data-fixed')) return;            // author-owned slot (e.g. a cover confidential line)
      // Cover slides don't carry "1 / N" (title pages typically show no page
      // number). Authors wanting center text on the cover set data-fixed with their own content.
      if (i === 0) { el.textContent = ''; return; }
      var n = String(i + 1);                                // no leading zero — "5 / 14", not "05 / 14"
      el.textContent = n + ' / ' + total;
    });
    // Chrome logos: render the creator (--logo, left) and recipient (--partner-logo, right) marks
    // as AUTO-SIZED <img> — fixed target height (--chrome-logo-h), width following the logo's OWN
    // aspect ratio — so any logo (a single mark, a wide wordmark, a two-logo lockup) sits at a
    // consistent height with no hand-set width. We read the data-URI out of the CSS var and set it
    // on an <img>, upgrading a <span> placeholder in place so existing decks need no markup change.
    // No mark → the slot is hidden (the 3-slot grid still centers the page number). Prints too.
    var logoUrl = function (name) {
      var v = getComputedStyle(html).getPropertyValue(name).trim();
      var m = v && v.match(/url\((['"]?)([^)]*?)\1\)/);
      return m ? m[2] : '';
    };
    var setChromeLogo = function (ch, cls, url, alt) {
      var el = ch.querySelector('.' + cls);
      if (!url) { if (el) el.style.display = 'none'; return; }
      if (!el || el.tagName !== 'IMG') {
        var img = document.createElement('img');
        img.className = cls; img.alt = alt;
        if (el) ch.replaceChild(img, el); else ch.appendChild(img);
        el = img;
      }
      el.src = url;
    };
    // LIGHT/DARK LOGO PAIRS: --logo / --partner-logo are the base marks (shown on the dark
    // theme). A counterparty whose mark only reads on ONE background declares the optional
    // --logo-light / --partner-logo-light variant; we swap src on theme change and always
    // print with the light variant (print pages are light unless data-print="dark").
    // One token still works everywhere a mark reads on both backgrounds.
    var brandUrl = logoUrl('--logo'), partnerUrl = logoUrl('--partner-logo');
    var brandUrlLight = logoUrl('--logo-light'), partnerUrlLight = logoUrl('--partner-logo-light');
    var applyChromeLogos = function (light) {
      deck.querySelectorAll('.panel-chrome').forEach(function (ch) {
        setChromeLogo(ch, 'brand-mini', (light && brandUrlLight) || brandUrl, 'creator logo');
        setChromeLogo(ch, 'partner-mini', (light && partnerUrlLight) || partnerUrl, 'recipient logo');
      });
    };
    var themeIsLight = function () { return html.getAttribute('data-theme') === 'light'; };
    applyChromeLogos(themeIsLight());
    if (brandUrlLight || partnerUrlLight) {
      new MutationObserver(function () { applyChromeLogos(themeIsLight()); })
        .observe(html, { attributes: true, attributeFilter: ['data-theme'] });
      var printsDark = html.getAttribute('data-print') === 'dark';
      window.addEventListener('beforeprint', function () { applyChromeLogos(!printsDark); });
      window.addEventListener('afterprint', function () { applyChromeLogos(themeIsLight()); });
      try {
        window.matchMedia('print').addEventListener('change', function (e) {
          applyChromeLogos(e.matches ? !printsDark : themeIsLight());
        });
      } catch (e) {}
    }
  }

  // ===== Presentation mode (opened with #present, or embedded) =====
  // Snappy one-slide-at-a-time — scroll-snap + keyboard + prev/next buttons + counter,
  // matching the culture-deck feel. The raw standalone file (no signal) keeps plain
  // scroll. Class-GATED: all the presenting CSS is @media screen + keyed on this class,
  // so it's inert until this runs (no-JS/SharePoint and PRINT are unaffected).
  // Trigger: "present" in the URL hash/query, [data-present] on <html>, or (fallback)
  // running embedded in an iframe (a host may append #present explicitly).
  var embedded = (function () { try { return window.self !== window.top; } catch (e) { return true; } })();
  var wantPresent = location.hash.indexOf("present") !== -1
    || /[?&]present(=|&|$)/.test(location.search)
    || html.hasAttribute("data-present")
    || (embedded && !inSharePointPreview());               // an embedding host uses an iframe;
                                                            // SharePoint preview must NOT auto-present
  if (deck && wantPresent) {
    html.classList.add("presenting");
    if (w && !inSharePointPreview()) w.style.display = "none";  // present mode hides the banner (never in SP preview)
    var slides = Array.prototype.slice.call(deck.querySelectorAll(".slide"));
    var cur = 0;
    // Wrap each slide in a full-viewport .slide-stage so exactly one shows at a time
    // (no neighbor peeking) with the 16:9 card centered. Idempotent.
    slides.forEach(function (s) {
      var par = s.parentNode;
      if (par && par.classList && par.classList.contains("slide-stage")) return;
      var stage = document.createElement("div");
      stage.className = "slide-stage";
      par.insertBefore(stage, s);
      stage.appendChild(s);
    });
    // Build the nav chrome if the deck didn't ship it in markup, so ANY deck gets it.
    var mkbtn = function (id, label, txt) {
      var el = document.getElementById(id);
      if (!el) {
        el = document.createElement("button");
        el.id = id; el.className = "fdn-btn"; el.type = "button";
        el.setAttribute("aria-label", label); el.title = label; el.textContent = txt;
        document.body.appendChild(el);
      }
      return el;
    };
    var counter = mkbtn("fdnCounter", "Slide position", "");
    var paint = function () { if (counter) counter.textContent = (cur + 1) + " / " + slides.length; };
    var prefersReducedMotion = function () {
      try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; }
    };
    var go = function (i) {
      cur = Math.max(0, Math.min(slides.length - 1, i));
      if (slides[cur]) slides[cur].scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
      paint();
      try { history.replaceState(null, "", "#present&s=" + (cur + 1)); } catch (e) {}   // deep-link
    };
    // Track the centered slide so keyboard/buttons resume from where the user scrolled.
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { var i = slides.indexOf(e.target); if (i >= 0) { cur = i; paint(); } }
        });
      }, { root: deck, threshold: 0.6 });
      slides.forEach(function (s) { io.observe(s); });
    }

    // ---- Fullscreen / takeover (platform-branched) ----
    // Real Fullscreen API where it exists (desktop / Android / iPadOS); on iPhone it NEVER
    // exists for elements (video-only), so the takeover is the CSS .fs-active layer alone.
    // requestFullscreen needs a user gesture, so on rotate we only attempt real fullscreen
    // harmlessly, if granted.
    var de = document.documentElement;
    var realFs = de.requestFullscreen || de.webkitRequestFullscreen;
    var isIPhone = /iPhone|iPod/.test(navigator.userAgent || "");
    var canRealFs = !!realFs && !isIPhone;
    var enterTakeover = function () {
      html.classList.add("fs-active");
      if (canRealFs) { try { realFs.call(de); } catch (e) {} }
    };
    var exitTakeover = function () {
      html.classList.remove("fs-active");
      var exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit && (document.fullscreenElement || document.webkitFullscreenElement)) { try { exit.call(document); } catch (e) {} }
    };
    var exitBtn = mkbtn("fdnExit", "Exit full screen", "✕");
    exitBtn.onclick = exitTakeover;
    document.addEventListener("fullscreenchange", function () {
      if (!(document.fullscreenElement || document.webkitFullscreenElement) && !embedded) html.classList.remove("fs-active");
    });

    // Mobile: rotate-to-landscape auto-takeover (pseudo-fullscreen primary on iPhone).
    var isTouch = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);
    var syncOrientation = function () {
      var landscape = window.matchMedia && window.matchMedia("(orientation:landscape)").matches;
      if (landscape && window.innerWidth <= 1024) enterTakeover();
      else if (!landscape) exitTakeover();
    };
    if (isTouch && window.matchMedia) {
      window.addEventListener("orientationchange", function () { setTimeout(syncOrientation, 250); });
      try { window.matchMedia("(orientation:landscape)").addEventListener("change", syncOrientation); } catch (e) {}
      syncOrientation();
    }

    window.addEventListener("keydown", function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var k = e.key;
      if (k === "ArrowDown" || k === "ArrowRight" || k === "PageDown" || k === " " || k === "Spacebar") { e.preventDefault(); go(cur + 1); }
      else if (k === "ArrowUp" || k === "ArrowLeft" || k === "PageUp") { e.preventDefault(); go(cur - 1); }
      else if (k === "Home") { e.preventDefault(); go(0); }
      else if (k === "End") { e.preventDefault(); go(slides.length - 1); }
      else if (k === "f" || k === "F") { e.preventDefault(); if (html.classList.contains("fs-active")) exitTakeover(); else enterTakeover(); }
      else if (k === "Escape") { exitTakeover(); }
    });
    var pv = mkbtn("fdnPrev", "Previous slide", "❮");
    var nx = mkbtn("fdnNext", "Next slide", "❯");
    pv.onclick = function () { go(cur - 1); };
    nx.onclick = function () { go(cur + 1); };

    // Re-fit on CONTAINER resize — the hosted iframe box can change without a window resize.
    if ("ResizeObserver" in window) {
      var ro = new ResizeObserver(function () { markOverflow(); });
      ro.observe(deck);
    }

    // Focus the scroller so arrow keys land inside the (possibly iframed) document.
    deck.setAttribute("tabindex", "-1");
    try { deck.focus({ preventScroll: true }); } catch (e) { try { deck.focus(); } catch (e2) {} }
    // Deep-link: open on the slide named in the hash/query (#present&s=3 or ?s=3).
    var sm = (location.hash + " " + location.search).match(/[?&#]s=(\d+)/);
    if (sm && parseInt(sm[1], 10) > 1) { setTimeout(function () { go(parseInt(sm[1], 10) - 1); }, 60); }
    else { paint(); }
  }
})();
