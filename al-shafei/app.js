/* Al Shafei site: header line, reveal on scroll, project swipe, full-screen photo viewer
   (swipe between photos, pinch or trackpad pinch to zoom, drag to pan, double tap to zoom, back button closes). */
(function () {
  "use strict";
  var top = document.querySelector(".top");
  function onScroll() { if (top) top.classList.toggle("line", window.scrollY > 8); }
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

  // reveal cards as they come into view
  var rise = document.querySelectorAll(".rise");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    rise.forEach(function (el) { io.observe(el); });
  } else rise.forEach(function (el) { el.classList.add("in"); });

  // ---- All work: room tabs; tap a tab or swipe the grid left/right (touch or two-finger trackpad) ----
  var tabBox = document.querySelector(".tabs"), grid = document.getElementById("allgrid");
  if (tabBox && grid) {
    var tabs = [].slice.call(tabBox.querySelectorAll("button")), tiles = [].slice.call(grid.children);
    var curTab = 0;
    var setTab = function (i, user) {
      i = Math.max(0, Math.min(tabs.length - 1, i));
      if (i === curTab && !user) return;
      curTab = i;
      var t = tabs[i].getAttribute("data-t");
      grid.setAttribute("data-on", t);
      tabs.forEach(function (b, k) { b.setAttribute("aria-selected", k === i ? "true" : "false"); });
      tabs[i].scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
      grid.classList.add("fade");
      setTimeout(function () {
        tiles.forEach(function (el) { el.hidden = !(t === "all" || (t === "best" ? el.hasAttribute("data-best") : (" " + el.getAttribute("data-tab") + " ").indexOf(" " + t + " ") >= 0)); });
        grid.classList.remove("fade");
        // (2026-11-14) a tapped tab always brings back the room's first project, just under the sticky tabs
        if (user) {
          // the sticky tabs' own reported spot can lag right after the page shrinks: use where they stick + their height
          var gap = grid.getBoundingClientRect().top - ((parseFloat(getComputedStyle(tabBox).top) || 0) + tabBox.offsetHeight);
          if (gap < 10) window.scrollTo({ top: Math.max(0, window.scrollY + gap - 18), behavior: "smooth" });
        }
      }, 160);
      try { sessionStorage.setItem("alshafei-tab", t); } catch (er) {}
      // each room has its own link (…/al-shafei/#dressings): the address bar follows the tab, ready to copy
      if (user && history.replaceState) try { history.replaceState(null, "", t === "all" ? "#projects" : "#" + t); } catch (er) {}
    };
    tabs.forEach(function (b, k) { b.addEventListener("click", function () { setTab(k, true); }); });
    var fromLink = function () {  // a link ending in #kitchens, #dressings, ... opens that tab
      var h = (location.hash || "").slice(1).toLowerCase(), hit = -1;
      tabs.forEach(function (b, k) { if (h && b.getAttribute("data-t") === h) hit = k; });
      if (hit < 0) return false;
      setTab(hit, false);
      var work = document.getElementById("projects");
      var go = function () { setTimeout(function () { window.scrollTo({ top: work.offsetTop + 30 }); }, 220); };
      if (document.readyState === "complete") go(); else window.addEventListener("load", go);
      return true;
    };
    if (!fromLink()) try {
      var saved = sessionStorage.getItem("alshafei-tab");
      tabs.forEach(function (b, k) { if (b.getAttribute("data-t") === saved) setTab(k, false); });
    } catch (er) {}
    window.addEventListener("hashchange", fromLink);
    // (2026-11-14) swiping the grid no longer changes the room: a sideways swipe now moves a project's own photos
  }
  // a project's "All work" link opens the same room tab
  document.querySelectorAll(".back[data-tab]").forEach(function (a) {
    a.addEventListener("click", function () {
      try {  // a project in two rooms (a bedroom also under Dressings) goes back to the room it was opened from
        var own = a.getAttribute("data-tab").split(" "), saved = sessionStorage.getItem("alshafei-tab");
        if (saved !== "all" && own.indexOf(saved) < 0) sessionStorage.setItem("alshafei-tab", own[0]);
      } catch (er) {}
    });
  });

  var V = document.getElementById("viewer");
  var body = document.body;
  var prevUrl = body.getAttribute("data-prev"), nextUrl = body.getAttribute("data-next");

  // ---- swipe left/right on a project page = next/previous project (touch and trackpad) ----
  if (prevUrl || nextUrl) {
    var sx = 0, sy = 0, st = 0;
    document.addEventListener("touchstart", function (e) {
      if (isOpen() || e.touches.length !== 1) { st = 0; return; }
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now();
    }, { passive: true });
    document.addEventListener("touchend", function (e) {
      if (!st || isOpen()) return;
      var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Date.now() - st < 700 && Math.abs(dx) > 90 && Math.abs(dx) > 2.2 * Math.abs(dy)) go(dx < 0 ? nextUrl : prevUrl);
      st = 0;
    }, { passive: true });
    var acc = 0, accT = 0, lockT = 0;
    window.addEventListener("wheel", function (e) {
      if (isOpen() || e.ctrlKey) return;
      if (Math.abs(e.deltaX) < 2 * Math.abs(e.deltaY)) { acc = 0; return; }
      var now = Date.now();
      if (now < lockT) return;
      if (now - accT > 300) acc = 0;
      accT = now; acc += e.deltaX;
      if (Math.abs(acc) > 160) { lockT = now + 1200; var u = acc > 0 ? nextUrl : prevUrl; acc = 0; go(u); }
    }, { passive: true });
  }
  function go(u) { if (u) location.href = u; }
  function isOpen() { return V && !V.hidden; }

  if (!V) return;
  var track = V.querySelector(".track"), slides = [].slice.call(track.children), count = V.querySelector(".count");
  var cap = V.querySelector(".vc"), onClose = null;
  var cur = 0, z = { s: 1, x: 0, y: 0 }, pushed = false;
  // Arabic pages run right to left: the photo strip then scrolls with negative scrollLeft
  function dir() { return getComputedStyle(track).direction === "rtl" ? -1 : 1; }
  function idxNow() { return Math.round(Math.abs(track.scrollLeft) / track.clientWidth); }
  function loadNear() {  // long lists (a whole room on the home page) load only the photos around the one shown
    for (var k = Math.max(0, cur - 2); k <= Math.min(slides.length - 1, cur + 2); k++) {
      var m = slides[k].querySelector("img"); if (!m.getAttribute("src")) m.src = m.getAttribute("data-src");
    }
  }
  // home page: show a room's photos (slides = HTML), open at photo i; done(i) runs on close
  V.show = function (html, i, done) { track.innerHTML = html; slides = [].slice.call(track.children); onClose = done || null; open(i); };
  function img() { return slides[cur].querySelector("img"); }
  function apply(anim) {
    var im = img();
    im.style.transition = anim ? "transform .3s cubic-bezier(.2,.7,.2,1)" : "none";
    im.style.transform = z.s === 1 ? "" : "translate(" + z.x + "px," + z.y + "px) scale(" + z.s + ")";
    V.classList.toggle("zoomed", z.s > 1.01);
  }
  function clamp() {
    var im = img(), w = im.offsetWidth, h = im.offsetHeight, sw = track.clientWidth, sh = track.clientHeight;
    var mx = Math.max(0, (w * z.s - sw) / 2), my = Math.max(0, (h * z.s - sh) / 2);
    z.x = Math.max(-mx, Math.min(mx, z.x)); z.y = Math.max(-my, Math.min(my, z.y));
  }
  function reset(anim) { z = { s: 1, x: 0, y: 0 }; apply(anim); }
  // zoom to scale s keeping the screen point (px,py) still
  function zoomAt(s, px, py, anim) {
    s = Math.max(1, Math.min(5, s));
    var r = slides[cur].getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var k = s / z.s;
    z.x = (px - cx) - ((px - cx) - z.x) * k; z.y = (py - cy) - ((py - cy) - z.y) * k; z.s = s;
    if (s <= 1.01) { reset(anim); return; }
    clamp(); apply(anim);
  }
  function label() {
    var s = slides[cur];
    if (s && s.hasAttribute("data-n")) {  // home page: "2 / 7" inside this project, and the project's name
      count.textContent = (+s.getAttribute("data-i") + 1) + " / " + s.getAttribute("data-n");
      if (cap) { cap.querySelector("b").textContent = s.getAttribute("data-name"); cap.querySelector("small").textContent = s.getAttribute("data-kind"); }
    } else count.textContent = (cur + 1) + " / " + slides.length;
    loadNear();
  }
  function goTo(i, smooth) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    track.scrollTo({ left: dir() * i * track.clientWidth, behavior: smooth ? "smooth" : "auto" });
    if (i !== cur) { reset(); cur = i; label(); }
  }
  function open(i) {
    if (slides.length <= 15) slides.forEach(function (s) { var im = s.querySelector("img"); if (!im.getAttribute("src")) im.src = im.getAttribute("data-src"); });
    V.style.background = ""; V.hidden = false; document.documentElement.classList.add("lock");
    cur = i; label();
    track.scrollLeft = dir() * i * track.clientWidth;
    requestAnimationFrame(function () { track.scrollLeft = dir() * i * track.clientWidth; });
    if (!pushed) { history.pushState({ viewer: 1 }, ""); pushed = true; }
    V.querySelector(".x").focus({ preventScroll: true });
  }
  function close(fromPop) {
    if (V.hidden) return;
    reset(); V.hidden = true; document.documentElement.classList.remove("lock");
    if (pushed && !fromPop) { pushed = false; history.back(); } else pushed = false;
    if (onClose) onClose(cur);
  }
  window.addEventListener("popstate", function () { if (!V.hidden) close(true); });
  document.querySelectorAll("[data-open]").forEach(function (b) {
    b.addEventListener("click", function () { open(+b.getAttribute("data-open")); });
  });
  V.querySelector(".x").addEventListener("click", function () { close(); });
  V.querySelector(".prev").addEventListener("click", function () { goTo(cur - 1, true); });
  V.querySelector(".nxt").addEventListener("click", function () { goTo(cur + 1, true); });
  document.addEventListener("keydown", function (e) {
    if (V.hidden) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowRight") goTo(cur + dir(), true);
    else if (e.key === "ArrowLeft") goTo(cur - dir(), true);
  });
  var scT;
  track.addEventListener("scroll", function () {
    clearTimeout(scT);
    scT = setTimeout(function () {
      var i = Math.min(slides.length - 1, idxNow());
      if (i !== cur) { reset(); cur = i; label(); }
    }, 60);
  }, { passive: true });
  window.addEventListener("resize", function () { if (!V.hidden) { reset(); track.scrollLeft = dir() * cur * track.clientWidth; } });
  // a tap on the dark space around the photo closes the viewer
  track.addEventListener("click", function (e) { if (e.target.classList.contains("slide") && z.s <= 1.01) close(); });

  // ---- touch: pinch to zoom, one finger pans when zoomed, double tap toggles zoom ----
  var t0 = null, lastTap = 0;
  function dist(a, b) { return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); }
  function mid(a, b) { return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 }; }
  track.addEventListener("touchstart", function (e) {
    if (e.touches.length === 2) {
      var m = mid(e.touches[0], e.touches[1]);
      t0 = { pinch: true, d: dist(e.touches[0], e.touches[1]), s: z.s, x: z.x, y: z.y, m: m };
    } else if (e.touches.length === 1) {
      var t = e.touches[0];
      var now = Date.now();
      if (lastTap && now - lastTap.t < 320 && Math.hypot(t.clientX - lastTap.x, t.clientY - lastTap.y) < 40) {
        e.preventDefault(); zoomAt(z.s > 1.01 ? 1 : 2.5, t.clientX, t.clientY, true); lastTap = 0; t0 = null; return;
      }
      t0 = { pinch: false, px: t.clientX, py: t.clientY, x: z.x, y: z.y, t: now };
    }
  }, { passive: false });
  track.addEventListener("touchmove", function (e) {
    if (!t0) return;
    if (t0.pinch && e.touches.length === 2) {
      e.preventDefault();
      var m = mid(e.touches[0], e.touches[1]), s = Math.max(1, Math.min(5, t0.s * dist(e.touches[0], e.touches[1]) / t0.d));
      var r = slides[cur].getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, k = s / t0.s;
      z.s = s;
      z.x = (m.x - cx) - ((t0.m.x - cx) - t0.x) * k;
      z.y = (m.y - cy) - ((t0.m.y - cy) - t0.y) * k;
      clamp(); apply(false);
    } else if (!t0.pinch && z.s > 1.01 && e.touches.length === 1) {
      e.preventDefault();
      z.x = t0.x + e.touches[0].clientX - t0.px; z.y = t0.y + e.touches[0].clientY - t0.py;
      clamp(); apply(false);
    } else if (!t0.pinch && e.touches.length === 1) {
      // swipe down to close: the photo follows the finger and the dark fades
      var dy = e.touches[0].clientY - t0.py, dx = e.touches[0].clientX - t0.px;
      if (!t0.down && dy > 12 && dy > 1.4 * Math.abs(dx)) t0.down = true;
      if (t0.down) {
        e.preventDefault();
        var im = img(); im.style.transition = "none"; im.style.transform = "translateY(" + Math.max(0, dy) + "px)";
        V.style.background = "rgba(20,19,17," + Math.max(0.35, 1 - Math.max(0, dy) / 500) + ")";
      }
    }
  }, { passive: false });
  track.addEventListener("touchend", function (e) {
    if (e.touches.length === 0 && t0 && t0.down) {
      var dyE = e.changedTouches[0].clientY - t0.py;
      t0 = null; lastTap = 0;
      if (dyE > 90) close(); else { V.style.background = ""; reset(true); }
      return;
    }
    if (e.touches.length === 0) {
      var c = e.changedTouches[0];
      lastTap = (t0 && !t0.pinch && Date.now() - t0.t < 250 && Math.hypot(c.clientX - t0.px, c.clientY - t0.py) < 10)
        ? { t: Date.now(), x: c.clientX, y: c.clientY } : 0;
      if (z.s < 1.05) reset(true); t0 = null;
    }
    else if (e.touches.length === 1 && t0 && t0.pinch) { var t = e.touches[0]; t0 = { pinch: false, px: t.clientX, py: t.clientY, x: z.x, y: z.y }; }
  });

  // ---- trackpad and mouse: pinch (ctrl+wheel) zooms, two-finger scroll pans when zoomed, drag pans, double click zooms ----
  var wAcc = 0, wT = 0, wLock = false;
  track.addEventListener("wheel", function (e) {
    if (e.ctrlKey) { e.preventDefault(); zoomAt(z.s * Math.exp(-e.deltaY * 0.012), e.clientX, e.clientY, false); return; }
    if (z.s > 1.01) { e.preventDefault(); z.x -= e.deltaX; z.y -= e.deltaY; clamp(); apply(false); return; }
    // two-finger sideways swipe or a mouse wheel steps one photo per gesture
    // (after a step, the rest of the same gesture and its glide are ignored until 300 ms of quiet)
    e.preventDefault();
    var now = Date.now(), d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX * dir() : e.deltaY;
    if (wLock && now - wT < 300) { wT = now; return; }
    if (now - wT > 300) wAcc = 0;
    wLock = false; wT = now; wAcc += d;
    if (Math.abs(wAcc) > 60) { goTo(cur + (wAcc > 0 ? 1 : -1), true); wAcc = 0; wLock = true; }
  }, { passive: false });
  track.addEventListener("dblclick", function (e) { zoomAt(z.s > 1.01 ? 1 : 2.5, e.clientX, e.clientY, true); });
  var drag = null;
  track.addEventListener("pointerdown", function (e) {
    if (e.pointerType !== "mouse" || z.s <= 1.01) return;
    drag = { px: e.clientX, py: e.clientY, x: z.x, y: z.y }; track.setPointerCapture(e.pointerId); e.preventDefault();
  });
  track.addEventListener("pointermove", function (e) {
    if (!drag) return; z.x = drag.x + e.clientX - drag.px; z.y = drag.y + e.clientY - drag.py; clamp(); apply(false);
  });
  track.addEventListener("pointerup", function () { drag = null; });
  track.addEventListener("pointercancel", function () { drag = null; });
})();

/* Home page (2026-11-14): one side-scroll strip per room. Tapping a project opens its photos full screen on the
   same page; swiping on past its last photo goes into the next project of that room. Closing lands on the project
   last seen. Laptop: arrow buttons beside each room's name, or two-finger swipe on the strip. */
(function () {
  var rows = document.querySelector(".rows"), V = document.getElementById("viewer");
  if (!rows) return;
  var base = rows.getAttribute("data-base") || "img/";
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }
  rows.querySelectorAll(".row").forEach(function (row) {
    var strip = row.querySelector(".strip"), tiles = [].slice.call(strip.querySelectorAll(".tile"));
    var btns = row.querySelectorAll(".sl"), rtl = getComputedStyle(strip).direction === "rtl";
    function ends() {
      var x = Math.abs(strip.scrollLeft), max = strip.scrollWidth - strip.clientWidth - 2;
      if (btns[0]) btns[0].disabled = x < 2;
      if (btns[1]) btns[1].disabled = x >= max;
    }
    btns.forEach(function (b) {
      b.addEventListener("click", function () {
        var step = Math.max(tiles[0] ? tiles[0].offsetWidth : 300, strip.clientWidth - 120);
        strip.scrollBy({ left: +b.getAttribute("data-d") * step * (rtl ? -1 : 1), behavior: "smooth" });
      });
    });
    strip.addEventListener("scroll", ends, { passive: true }); ends();
    if (!V || !V.show) return;
    tiles.forEach(function (t, k) {
      t.addEventListener("click", function (e) {
        if (e.ctrlKey || e.metaKey || e.shiftKey) return;  // new tab still opens the project page
        e.preventDefault();
        var html = "", start = 0, n = 0;
        tiles.forEach(function (p, j) {
          var ph = (p.getAttribute("data-ph") || "").split(" ").filter(Boolean);
          var name = p.querySelector(".c b").textContent, kind = p.querySelector(".c small").textContent;
          if (j === k) start = n;
          ph.forEach(function (f, i) {
            html += '<div class="slide" data-p="' + j + '" data-i="' + i + '" data-n="' + ph.length + '" data-name="' + esc(name) +
              '" data-kind="' + esc(kind) + '"><img data-src="' + esc(base + f) + '" alt="' + esc(name + ", " + kind + " " + (i + 1)) + '" draggable="false"></div>';
            n++;
          });
        });
        V.show(html, start, function (i) {  // back on the page: bring the project last seen into view
          var s = V.querySelectorAll(".slide")[i], p = s ? tiles[+s.getAttribute("data-p")] : null;
          if (p && p !== t) p.scrollIntoView({ inline: "start", block: "nearest", behavior: "auto" });
        });
      });
    });
  });
})();

/* Each project's picture is a side scroll of its own photos, Instagram style (2026-11-14): swipe (or two fingers on
   a trackpad, or the small arrows on a laptop) moves through the photos, dots show where you are; a tap opens them
   full screen on the same page at the photo shown, and closing comes back to that photo. */
(function () {
  var grid = document.getElementById("allgrid"), V = document.getElementById("viewer");
  if (!grid) return;
  var base = grid.getAttribute("data-base") || "img/";
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }
  [].forEach.call(grid.querySelectorAll(".tile[data-ph]"), function (t) {
    var ph = t.getAttribute("data-ph").split(" ").filter(Boolean), pic = t.querySelector(".pic"), first = pic.querySelector("img");
    var name = t.querySelector(".c b").textContent, kind = t.querySelector(".c small").textContent;
    // the cover photo comes first; it is not repeated and no other photo is skipped
    var cov = (first.getAttribute("src") || "").replace(/^.*?img\//, "").replace(/-s\.jpg$/, ".jpg"), ci = ph.indexOf(cov);
    if (ci > 0) { ph.splice(ci, 1); ph.unshift(cov); }
    var car = null, dots = [], at = 0;
    function idx() { return car ? Math.round(Math.abs(car.scrollLeft) / (car.clientWidth || 1)) : 0; }
    function rtl() { return car && getComputedStyle(car).direction === "rtl" ? -1 : 1; }
    function show(i, smooth) { if (car) car.scrollTo({ left: rtl() * i * car.clientWidth, behavior: smooth ? "smooth" : "auto" }); }
    if (ph.length > 1) {
      car = document.createElement("span"); car.className = "car";
      ph.forEach(function (f, i) {
        var im = first;
        if (i) {
          im = document.createElement("img");
          im.alt = first.alt + " " + (i + 1); im.loading = "lazy"; im.decoding = "async"; im.draggable = false;
          im.src = base + f.replace(/\.jpg$/, "-s.jpg");
        }
        car.appendChild(im);
      });
      pic.insertBefore(car, pic.firstChild);
      var d = document.createElement("span"); d.className = "dots"; d.setAttribute("aria-hidden", "true");
      ph.forEach(function (f, i) { var b = document.createElement("i"); if (!i) b.className = "on"; d.appendChild(b); dots.push(b); });
      pic.appendChild(d);
      var arrows = ["-1", "1"].map(function (s) {
        var b = document.createElement("button"); b.type = "button"; b.className = "cn " + (s === "1" ? "fw" : "bk");
        b.setAttribute("aria-label", s === "1" ? "›" : "‹"); b.innerHTML = s === "1" ? "&rsaquo;" : "&lsaquo;";
        b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); show(Math.max(0, Math.min(ph.length - 1, idx() + +s)), true); });
        pic.appendChild(b); return b;
      });
      var upd = function () {
        at = Math.min(ph.length - 1, idx());
        dots.forEach(function (b, k) { b.className = k === at ? "on" : ""; });
        arrows[0].hidden = at === 0; arrows[1].hidden = at === ph.length - 1;
      };
      car.addEventListener("scroll", upd, { passive: true }); upd();
    }
    if (!V || !V.show) return;
    t.addEventListener("click", function (e) {
      if (e.ctrlKey || e.metaKey || e.shiftKey) return;  // new tab still opens the project page
      e.preventDefault();
      var html = "";
      ph.forEach(function (f, i) {
        html += '<div class="slide" data-i="' + i + '" data-n="' + ph.length + '" data-name="' + esc(name) + '" data-kind="' + esc(kind) +
          '"><img data-src="' + esc(base + f) + '" alt="' + esc(name + ", " + kind + " " + (i + 1)) + '" draggable="false"></div>';
      });
      V.show(html, idx(), function (i) { show(i, false); });
    });
  });
})();

/* WhatsApp button on phones: shows after the first screen, hides at Contact */
(function () {
  var f = document.querySelector(".fab"), ct = document.getElementById("contact"), near = false;
  if (!f) return;
  function upd() { f.classList.toggle("on", window.scrollY > window.innerHeight * 0.6 && !near); }
  if (ct && "IntersectionObserver" in window) new IntersectionObserver(function (es) { near = es[0].isIntersecting; upd(); }).observe(ct);
  window.addEventListener("scroll", upd, { passive: true }); upd();
})();

/* The opening question typed live, the room pills under it open that room's projects, and the thin scroll line (2026-11-11) */
(function () {
  var t = document.querySelector(".ask .typed");
  if (t && !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) {
    var full = t.textContent, i = 0;
    t.textContent = "";
    var step = function () { i++; t.textContent = full.slice(0, i); if (i < full.length) setTimeout(step, 38 + Math.random() * 46); };
    setTimeout(step, 350);
  }
  document.querySelectorAll(".pills [data-go]").forEach(function (p) {
    p.addEventListener("click", function () {
      document.querySelectorAll(".pills button").forEach(function (b) { b.classList.toggle("on", b === p); });
      var tab = document.querySelector('.tabs [data-t="' + p.getAttribute("data-go") + '"]');
      if (tab) tab.click();
      var w = document.getElementById("projects"); if (w) w.scrollIntoView({ behavior: "smooth" });
    });
  });
  var bar = document.querySelector(".prog b");
  if (bar) {
    var upd = function () { var h = document.documentElement.scrollHeight - innerHeight; bar.style.transform = "scaleX(" + (h > 0 ? Math.min(1, scrollY / h) : 0) + ")"; };
    addEventListener("scroll", upd, { passive: true }); upd();
  }
})();
