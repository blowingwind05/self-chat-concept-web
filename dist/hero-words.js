/* The loose things we send ourselves, arriving through the same input. */
(() => {
  "use strict";

  const hero = document.querySelector(".hero");
  const canvas = hero?.querySelector(".hero-word-field");
  const composer = hero?.querySelector(".hero-composer");
  const chat = hero?.querySelector(".hero-window");
  const stage = hero?.querySelector(".hero-stage");
  const ctx = canvas?.getContext("2d");
  if (!hero || !composer || !chat || !stage || !ctx) return;

  const words = [
    "灵感创意", "学习工作", "文案与稿件", "审美积累", "书影音清单",
    "生活回顾", "待办与日程", "网页收藏", "文件传输", "备忘录",
    "To-do List", "日程提醒", "面试稿", "汇报稿", "Presentation",
    "不认识的单词", "摄影", "绘画", "设计作品", "想看的书", "电影",
    "想补的番", "布达佩斯大饭店", "冰菓", "serendipity", "讲稿_v3.pdf",
    "project-files.zip", "截图", "链接", "代码片段", "截图.png",
    "想法", "备忘", "提醒", "待办", "笔记", "论文", "学习资料", "读书笔记",
    "摘录", "书单", "电影清单", "番剧清单", "照片", "素材", "灵感", "文案",
    "讲稿", "面试", "汇报", "截图粘贴", "文件拖放", "文件预览", "文件搜索",
    "备份", "附件", "文本片段", "网址", "日程", "原始记录",
  ];
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
  const noise = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let geometry = null;
  let particles = [];
  let raf = 0;
  let visible = false;
  let previous = 0;
  let elapsed = 0;
  let nextBirth = 0;
  let serial = 0;
  let geometryAge = 0;
  let sizeDirty = true;
  let destroyed = false;

  function rect(element, origin, padding = 0) {
    const r = element.getBoundingClientRect();
    return {
      left: r.left - origin.left - padding,
      right: r.right - origin.left + padding,
      top: r.top - origin.top - padding,
      bottom: r.bottom - origin.top + padding,
      width: r.width + padding * 2,
      height: r.height + padding * 2,
    };
  }

  function measure() {
    const origin = hero.getBoundingClientRect();
    const w = origin.width, h = origin.height;
    if (w < 20 || h < 20) return null;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const pixelW = Math.round(w * dpr), pixelH = Math.round(h * dpr);
    if (canvas.width !== pixelW || canvas.height !== pixelH) {
      canvas.width = pixelW; canvas.height = pixelH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const input = rect(composer, origin);
    const windowBox = rect(chat, origin);
    const stageBox = rect(stage, origin);
    const copyBox = rect(hero.querySelector(".hero-copy"), origin);
    // The receiving point sits in the input, to the right of its placeholder.
    const target = { x: input.left + input.width * .66, y: input.top + input.height * .54 };
    const protectedRects = Array.from(hero.querySelectorAll(
      ".hero-copy .eyebrow, .hero-copy h1, .hero-description, .hero-links a, .floating-note, .hero-annotation, .hero-bottom"
    )).map((element) => {
      const isCopy = Boolean(element.closest(".hero-copy"));
      if (isCopy && document.createRange) {
        const range = document.createRange(); range.selectNodeContents(element);
        const ink = range.getBoundingClientRect();
        if (ink.width && ink.height) return {
          left: ink.left - origin.left - 6, right: ink.right - origin.left + 6,
          top: ink.top - origin.top - 6, bottom: ink.bottom - origin.top + 6, fade: 8,
        };
      }
      return { ...rect(element, origin, isCopy ? 6 : 10), fade: isCopy ? 8 : 14 };
    });
    const copyRows = Array.from(hero.querySelectorAll(".hero-copy .eyebrow, .hero-copy h1, .hero-description, .hero-links"))
      .map(element => rect(element, origin)).sort((a, b) => a.top - b.top);
    const copyGaps = copyRows.slice(1).map((row, i) => ({ top: copyRows[i].bottom, bottom: row.top }))
      .filter(gap => gap.bottom - gap.top >= 26).sort((a, b) => (b.bottom - b.top) - (a.bottom - a.top));
    protectedRects.push({
      left: windowBox.left - 4, right: windowBox.right + 4,
      top: windowBox.top - 4, bottom: input.top - 3,
    });
    return {
      w, h, target, input, windowBox, stageBox, copyBox, copyGaps, protectedRects,
      narrow: w < 760,
      lower: Math.min(h - 62, input.bottom + (w < 760 ? 45 : 76)),
      right: w - 14,
    };
  }

  function bezier(points, t) {
    const s = 1 - t;
    return {
      x: s * s * s * points[0].x + 3 * s * s * t * points[1].x + 3 * s * t * t * points[2].x + t * t * t * points[3].x,
      y: s * s * s * points[0].y + 3 * s * s * t * points[1].y + 3 * s * t * t * points[2].y + t * t * t * points[3].y,
    };
  }

  function pathPoint(segments, t) {
    const part = Math.min(segments.length - 1, Math.floor(t * segments.length));
    return bezier(segments[part], clamp(t * segments.length - part));
  }

  function route(points) {
    const segments = Array.isArray(points[0]) ? points : [points];
    const samples = [{ t: 0, length: 0 }];
    let previousPoint = segments[0][0], length = 0;
    const count = 72 * segments.length;
    for (let i = 1; i <= count; i++) {
      const t = i / count, point = pathPoint(segments, t);
      length += Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y);
      samples.push({ t, length });
      previousPoint = point;
    }
    return { segments, samples, length };
  }

  function atDistance(path, progress) {
    const distance = clamp(progress) * path.length;
    let low = 0, high = path.samples.length - 1;
    while (high - low > 1) {
      const mid = (low + high) >> 1;
      if (path.samples[mid].length < distance) low = mid; else high = mid;
    }
    const a = path.samples[low], b = path.samples[high];
    return pathPoint(path.segments, mix(a.t, b.t, (distance - a.length) / Math.max(.001, b.length - a.length)));
  }

  function visibility(point, halfW, halfH, g) {
    let fade = 1;
    for (const box of g.protectedRects) {
      const dx = Math.max(box.left - halfW - point.x, 0, point.x - box.right - halfW);
      const dy = Math.max(box.top - halfH - point.y, 0, point.y - box.bottom - halfH);
      // Main copy remains readable through a lower-contrast layer of words.
      // It is a soft depth change, never a large empty cut-out in the word cloud.
      fade = Math.min(fade, .25 + .75 * smooth(Math.hypot(dx, dy) / (box.fade || 14)));
      if (!fade) break;
    }
    return fade;
  }

  function makePath(index, family, g) {
    const n = noise(index + 5), k = noise(index + 27), end = { ...g.target };
    const win = g.windowBox;
    const rightLane = Math.min(g.w + 26, Math.max(win.right + 62, g.w * .91));
    if (family === 6 && !g.narrow) {
      const start = { x: -80 - n * 80, y: g.h * (.1 + k * .73) };
      return route([start,
        { x: g.w * .27, y: start.y + (n - .5) * 100 },
        { x: end.x - 220, y: end.y + (k - .5) * 150 }, end]);
    }
    if (family === 7 && !g.narrow) {
      const start = { x: g.w * (.025 + n * .25), y: (index % 2 ? .09 : .86) * g.h };
      return route([start,
        { x: g.w * .38, y: start.y + (index % 2 ? -32 : 35) },
        { x: end.x - 125, y: end.y + (index % 2 ? -75 : 55) }, end]);
    }
    if (family === 4 && !g.narrow) {
      // A broad lower-left relay uses the clear strip beneath the reading copy.
      const y = Math.min(g.lower - 8, Math.max(g.copyBox.bottom + 25, end.y + 22));
      const start = { x: -58 - n * 75, y };
      const corner = { x: Math.max(g.w * .52, win.left - 55), y: Math.min(g.lower, y + 13) };
      return route([
        [start, { x: g.w * .19, y: y - 10 }, { x: corner.x - 140, y: corner.y + 6 }, corner],
        [corner, { x: corner.x + 88, y: Math.min(g.lower, end.y + 48) },
          { x: end.x - 96, y: Math.min(g.lower, end.y + 45) }, end],
      ]);
    }
    if (family === 5 && !g.narrow) {
      // A near-horizontal sentence fragment crosses a real gap in the copy,
      // then bends down the outside of the chat. No solid copy-sized exclusion.
      const gap = g.copyGaps[index % Math.max(1, g.copyGaps.length)];
      const y = gap ? (gap.top + gap.bottom) / 2 : Math.max(22, g.copyBox.top - 38);
      const start = { x: g.w * (.025 + n * .09), y };
      const corner = { x: Math.max(g.copyBox.right + 28, win.left - 65), y };
      return route([
        [start, { x: mix(start.x, corner.x, .32), y: y - 6 }, { x: corner.x - 115, y: y + 4 }, corner],
        [corner, { x: corner.x + 10, y: Math.min(g.lower, end.y + 50) },
          { x: end.x - 114, y: Math.min(g.lower, end.y + 47) }, end],
      ]);
    }
    if (family === 3 && !g.narrow) {
      // A wide two-part arc begins over the copy's clear upper margin, travels
      // along the top of the page, then descends outside the conversation.
      const start = { x: g.w * (.07 + n * .25), y: 26 + k * 24 };
      const corner = { x: rightLane, y: Math.max(30, win.top - 48) };
      return route([
        [start,
          { x: mix(start.x, corner.x, .35), y: 10 },
          { x: corner.x - 120, y: Math.max(12, corner.y - 12) }, corner],
        [corner,
          { x: rightLane + 56, y: Math.max(corner.y + 80, end.y - 175) },
          { x: rightLane + 12, y: end.y + 78 }, end],
      ]);
    }
    if (family === 0) {
      // A broad upper arc bends around the conversation before entering below.
      const start = { x: mix(Math.max(win.left + 35, g.w * .56), g.w + 70, n), y: mix(14, Math.max(40, win.top - 22), k) };
      return route([start,
        { x: rightLane + 35, y: mix(start.y + 70, end.y - 40, .48) },
        { x: rightLane, y: end.y + 68 + k * 24 }, end]);
    }
    if (family === 1) {
      // Lower diagonals stay in the white space beneath the floating window.
      const fromLeft = index % 2 === 0;
      const start = {
        x: fromLeft ? Math.max(g.w * .46, win.left - 180) : g.w + 72,
        y: Math.max(end.y + 33, g.lower - n * 34),
      };
      return route([start,
        { x: mix(start.x, end.x, .25), y: start.y + 14 },
        { x: end.x + (fromLeft ? -88 : 100), y: end.y + 49 }, end]);
    }
    // A staggered side-entry group; shallower than the full upper arcs.
    const start = { x: g.w + 64 + n * 50, y: mix(Math.max(48, win.top + 55), end.y + 58, k) };
    return route([start,
      { x: rightLane + 45, y: start.y + 26 },
      { x: Math.min(g.w + 20, end.x + 132), y: end.y + 48 + n * 24 }, end]);
  }

  function spawn(initialAge = 0) {
    if (!geometry) return;
    const index = serial++;
    const word = words[(index * 7 + Math.floor(index / words.length) * 3) % words.length];
    const type = /\.(pdf|zip)$/.test(word) ? "file" : /[a-zA-Z]/.test(word) ? "latin" : "word";
    const size = geometry.narrow ? 12 + noise(index + 6) * 4
      : index % 11 === 0 && word.length < 9 ? 29 : 14 + noise(index + 6) * 11;
    const font = type === "file" ? `500 ${size * .87}px Consolas,monospace`
      : word === "serendipity" ? `400 ${size + 1}px Georgia,serif`
        : `${index % 5 === 0 ? 650 : 450} ${size}px -apple-system,"Microsoft YaHei","PingFang SC",sans-serif`;
    ctx.font = font;
    const metrics = ctx.measureText(word);
    const width = Math.max(metrics.width,
      (metrics.actualBoundingBoxLeft || 0) + (metrics.actualBoundingBoxRight || 0));
    const height = Math.max(size * .95,
      (metrics.actualBoundingBoxAscent || size * .75) + (metrics.actualBoundingBoxDescent || size * .23));
    const family = geometry.narrow ? index % 3 : [6, 3, 7, 4, 6, 5, 7, 1, 6, 2, 3, 7][index % 12];
    const port = .25 + (index % 5) * .14;
    const portY = .44 + noise(index + 47) * .13;
    const target = { x: geometry.input.left + geometry.input.width * port,
      y: geometry.input.top + geometry.input.height * portY };
    const localGeometry = { ...geometry, target };
    let path = makePath(index, family, localGeometry);
    // Select a different lane if a wide label would spend most of its flight hidden.
    let bestScore = -1;
    for (let attempt = 0; attempt < 3; attempt++) {
      const candidate = makePath(index + attempt * 41, (family + attempt) % (geometry.narrow ? 3 : 8), localGeometry);
      let score = 0;
      for (let i = 2; i < 24; i++) {
        const p = atDistance(candidate, i / 24);
        if (p.x > 0 && p.x < geometry.w && p.y > 0 && p.y < geometry.h) score += visibility(p, width * .5, size * .6, geometry);
      }
      if (score > bestScore) { bestScore = score; path = candidate; }
      // Keep the intended choreography whenever it has enough visible space;
      // choosing the absolute clearest lane every time would flatten the variety.
      if (attempt === 0 && score >= 3.5) break;
    }
    if (bestScore < 3) return;
    const duration = family >= 3 ? 3.7 + noise(index + 11) * .3 : 3.2 + noise(index + 11) * .6;
    particles.push({
      word, font, size, width, height, path, birth: elapsed - initialAge, duration,
      opacity: .4 + noise(index + 14) * .38,
      rotation: (noise(index + 21) - .5) * .085,
      target, port, portY,
    });
  }

  function paused() {
    return document.body.classList.contains("motion-paused")
      || (reducedMotion.matches && !document.documentElement.classList.contains("js-ready"));
  }

  function clear() {
    if (geometry) ctx.clearRect(0, 0, geometry.w, geometry.h);
    canvas.dataset.active = "0";
    canvas.dataset.drawn = "0";
  }

  function stop(state) {
    if (raf) window.cancelAnimationFrame(raf);
    raf = 0; previous = 0; particles = [];
    canvas.dataset.state = state;
    clear();
  }

  function start() {
    if (destroyed || raf || !visible || document.hidden || paused()) return;
    geometry = measure();
    if (!geometry) return;
    elapsed = 0; nextBirth = .09; geometryAge = 0; sizeDirty = false;
    particles = [];
    // A few already-separated arrivals make returning to the hero feel alive.
    const initial = geometry.narrow ? 6 : 38;
    for (let i = 0; i < initial; i++) spawn(.1 + (i % initial) * (geometry.narrow ? .42 : .084));
    canvas.dataset.state = "running";
    raf = window.requestAnimationFrame(draw);
  }

  function reconcile() {
    if (destroyed) return;
    if (!visible || document.hidden || paused()) stop(paused() ? "paused" : "offscreen");
    else start();
  }

  function draw(timestamp) {
    raf = 0;
    if (destroyed || !visible || document.hidden || paused()) { reconcile(); return; }
    const dt = previous ? Math.min(.05, (timestamp - previous) / 1000) : 0;
    previous = timestamp; elapsed += dt; geometryAge += dt;
    if (sizeDirty || geometryAge >= .12) {
      geometry = measure(); geometryAge = 0; sizeDirty = false;
    }
    if (!geometry) { reconcile(); return; }
    ctx.clearRect(0, 0, geometry.w, geometry.h);
    particles = particles.filter((p) => elapsed - p.birth < p.duration);
    const limit = geometry.narrow ? 8 : 42;
    if (elapsed >= nextBirth) {
      if (particles.length < limit) spawn();
      nextBirth = elapsed + (geometry.narrow ? .37 : .08) + noise(serial + 7) * (geometry.narrow ? .13 : .055);
    }
    const occupied = [];
    let drawn = 0;
    for (const p of particles) {
      const age = elapsed - p.birth;
      const progress = clamp(age / p.duration);
      const remaining = p.duration - age;
      const point = atDistance(p.path, progress);
      // Follow the original window's gentle float; don't let the destination drift.
      const currentTarget = { x: geometry.input.left + geometry.input.width * p.port,
        y: geometry.input.top + geometry.input.height * p.portY };
      point.x += (currentTarget.x - p.target.x) * progress;
      point.y += (currentTarget.y - p.target.y) * progress;
      const capture = smooth(1 - remaining / .38);
      const scale = mix(1, .07, capture);
      const opacity = p.opacity * smooth(age / .16) * (1 - smooth(1 - remaining / .24));
      const angle = p.rotation * (1 - capture);
      const halfW = (p.width * Math.cos(angle) + p.height * Math.abs(Math.sin(angle))) * scale * .5 + 2;
      const halfH = (p.height * Math.cos(angle) + p.width * Math.abs(Math.sin(angle))) * scale * .5 + 2;
      let safe = visibility(point, halfW, halfH, geometry);
      // Reveal only once the complete word has cleared the viewport edge.
      const edgeClearance = Math.min(point.x - halfW - 5, geometry.w - point.x - halfW - 5,
        point.y - halfH - 5, geometry.h - point.y - halfH - 5);
      safe *= smooth(edgeClearance / 22);
      // Keep the dense open-page flow. Only the last part inside the receiving
      // input gently reduces a following word when its ink box meets another.
      const bounds = { left: point.x - halfW, right: point.x + halfW,
        top: point.y - halfH, bottom: point.y + halfH };
      if (remaining < .38) {
        for (const other of occupied) {
          const dx = Math.max(bounds.left - other.right, other.left - bounds.right, 0);
          const dy = Math.max(bounds.top - other.bottom, other.top - bounds.bottom, 0);
          safe *= .16 + .84 * smooth(Math.hypot(dx, dy) / 7);
        }
      }
      const alpha = opacity * safe;
      if (alpha < .006) continue;
      if (alpha >= .055 && remaining < .38) occupied.push(bounds);
      if (alpha > .10) drawn++;
      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.rotate(angle);
      ctx.scale(scale, scale);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#484a47";
      ctx.font = p.font;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(p.word, 0, 0);
      ctx.restore();
    }
    canvas.dataset.active = String(particles.length);
    canvas.dataset.drawn = String(drawn);
    raf = window.requestAnimationFrame(draw);
  }

  const motionObserver = new MutationObserver(reconcile);
  motionObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  const observer = "IntersectionObserver" in window ? new IntersectionObserver((entries) => {
    const entry = entries[0];
    const nextVisible = entry.isIntersecting && entry.intersectionRatio > 0;
    if (visible !== nextVisible) { visible = nextVisible; reconcile(); }
  }, { threshold: [0, .05] }) : null;
  if (observer) observer.observe(hero);
  else { visible = true; reconcile(); }
  const resized = () => { sizeDirty = true; if (visible && !paused()) { stop("resizing"); start(); } };
  const resizeObserver = "ResizeObserver" in window ? new ResizeObserver(resized) : null;
  resizeObserver?.observe(hero);
  window.addEventListener("resize", resized, { passive: true });
  document.addEventListener("visibilitychange", reconcile);
  window.addEventListener("pageshow", reconcile);
  document.fonts?.ready.then(resized);
  window.addEventListener("pagehide", () => {
    stop("offscreen");
  });
  window.addEventListener("beforeunload", () => {
    destroyed = true;
    stop("stopped");
    observer?.disconnect(); resizeObserver?.disconnect(); motionObserver.disconnect();
  }, { once: true });
})();
