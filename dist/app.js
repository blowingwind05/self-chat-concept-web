(() => {
  "use strict";

  const root = document.documentElement;
  const body = document.body;
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const motionToggle = document.getElementById("motion-toggle");
  const motionLabel = motionToggle?.querySelector(".motion-label");
  const pageProgress = document.getElementById("page-progress");
  const core = document.getElementById("core-section");
  const stepNumber = document.getElementById("core-step-number");
  const phaseTitle = document.getElementById("core-phase-title");
  const phaseDescription = document.getElementById("core-phase-description");
  const sceneCounter = document.getElementById("scene-counter");
  const steps = Array.from(document.querySelectorAll(".core-steps li"));
  const revealElements = Array.from(document.querySelectorAll("[data-reveal]"));
  const revealVisibility = new WeakMap();
  const navigation = Array.from(document.querySelectorAll(".site-header nav a[href^='#']"))
    .map((link) => ({ link, section: document.getElementById(link.hash.slice(1)) }))
    .filter(({ section }) => section);

  const phases = [
    {
      title: "多种用途",
      description: "灵感、学习工作、文案、收藏……零零碎碎的信息，都先作为消息留下来。",
    },
    {
      title: "同一个聊天入口",
      description: "不需要提前分类，直接发送。所有内容进入同一条时间线。",
    },
    {
      title: "保存与整理",
      description: "云端保存原始记录，AI 负责理解和整理。",
    },
    {
      title: "按需组织信息",
      description: "形成不同的信息视图。整理结果可以修改，不影响原始消息。",
    },
  ];
  const stageStops = [0, 0.22, 0.48, 0.73, 1];
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  let motionPaused = motionPreference.matches;
  let userMotionChoice = null;
  let currentStage = -1;
  let frame = 0;

  function setStage(stage) {
    if (currentStage === stage || !core) return;
    currentStage = stage;
    core.dataset.stage = String(stage);
    const phase = phases[stage];
    if (stepNumber) stepNumber.textContent = String(stage + 1).padStart(2, "0");
    if (phaseTitle) phaseTitle.textContent = phase.title;
    if (phaseDescription) phaseDescription.textContent = phase.description;
    if (sceneCounter) sceneCounter.textContent = String(stage + 1);
    steps.forEach((step, index) => {
      step.classList.toggle("is-active", index === stage);
      step.classList.toggle("is-complete", index < stage);
      if (index === stage) step.setAttribute("aria-current", "step");
      else step.removeAttribute("aria-current");
    });
  }

  function updateScroll() {
    frame = 0;
    const viewportHeight = window.innerHeight;
    const scrollableHeight = root.scrollHeight - viewportHeight;
    if (pageProgress) {
      const progress = scrollableHeight > 0 ? clamp(window.scrollY / scrollableHeight) : 0;
      pageProgress.style.transform = `scaleX(${progress.toFixed(5)})`;
    }

    if (core) {
      const bounds = core.getBoundingClientRect();
      const travel = Math.max(1, bounds.height - viewportHeight);
      const progress = motionPaused ? 0 : clamp(-bounds.top / travel);
      const stage = progress < stageStops[1] ? 0
        : progress < stageStops[2] ? 1
          : progress < stageStops[3] ? 2 : 3;
      const localProgress = clamp((progress - stageStops[stage]) / (stageStops[stage + 1] - stageStops[stage]));
      core.style.setProperty("--core-progress", progress.toFixed(5));
      core.style.setProperty("--stage-progress", localProgress.toFixed(5));
      core.style.setProperty("--gather", (motionPaused ? 0 : clamp((progress - 0.07) / 0.15)).toFixed(5));
      setStage(stage);
    }

    let activeLink = null;
    for (const entry of navigation) {
      if (entry.section.getBoundingClientRect().top <= viewportHeight * 0.3) activeLink = entry.link;
    }
    navigation.forEach(({ link }) => {
      const active = link === activeLink;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }

  function scheduleUpdate() {
    if (!frame) frame = window.requestAnimationFrame(updateScroll);
  }

  function applyMotionPreference() {
    body.classList.toggle("motion-paused", motionPaused);
    if (motionToggle) {
      motionToggle.setAttribute("aria-pressed", String(motionPaused));
      motionToggle.setAttribute("aria-label", motionPaused ? "开启页面动画" : "暂停页面动画");
    }
    if (motionLabel) motionLabel.textContent = motionPaused ? "动态 关" : "动态 开";
    revealElements.forEach((element) => {
      element.classList.toggle("is-visible", motionPaused || revealVisibility.get(element) === true);
    });
    scheduleUpdate();
  }

  motionToggle?.addEventListener("click", () => {
    motionPaused = !motionPaused;
    userMotionChoice = motionPaused;
    applyMotionPreference();
  });

  const preferenceChanged = () => {
    if (userMotionChoice === null) {
      motionPaused = motionPreference.matches;
      applyMotionPreference();
    }
  };
  if (motionPreference.addEventListener) motionPreference.addEventListener("change", preferenceChanged);
  else motionPreference.addListener(preferenceChanged);

  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        // Enter after a small visible portion; reset only after fully leaving.
        if (entry.isIntersecting && entry.intersectionRatio >= 0.08) revealVisibility.set(entry.target, true);
        else if (!entry.isIntersecting) revealVisibility.set(entry.target, false);
        entry.target.classList.toggle("is-visible", motionPaused || revealVisibility.get(entry.target) === true);
      });
    }, { threshold: [0, 0.08], rootMargin: "0px 0px -24px 0px" });
    revealElements.forEach((element) => revealObserver.observe(element));

    const activityObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => entry.target.classList.toggle("is-inview", entry.isIntersecting));
    }, { threshold: 0, rootMargin: "100px" });
    document.querySelectorAll(".architecture-diagram, .hero, .core-sticky, .core-scene")
      .forEach((element) => activityObserver.observe(element));
  } else {
    revealElements.forEach((element) => {
      revealVisibility.set(element, true);
      element.classList.add("is-visible");
    });
    document.querySelectorAll(".architecture-diagram, .hero, .core-sticky, .core-scene")
      .forEach((element) => element.classList.add("is-inview"));
  }

  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", scheduleUpdate, { passive: true });
  window.addEventListener("load", scheduleUpdate, { once: true });
  window.addEventListener("pageshow", scheduleUpdate);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) scheduleUpdate();
  });
  if (document.fonts?.ready) document.fonts.ready.then(scheduleUpdate);

  const embeddedFilm=document.getElementById("concept-film");
  const pauseFilm=()=>embeddedFilm?.contentWindow?.postMessage({type:"concept-film:pause"},"*");
  if(embeddedFilm&&"IntersectionObserver" in window){
    const filmObserver=new IntersectionObserver(entries=>{
      if(entries.some(entry=>!entry.isIntersecting)&&!document.fullscreenElement)pauseFilm();
    },{threshold:0});
    filmObserver.observe(embeddedFilm);
  }
  document.addEventListener("visibilitychange",()=>{if(document.hidden)pauseFilm()});
  applyMotionPreference();
  updateScroll();
  root.classList.add("js-ready");
})();
