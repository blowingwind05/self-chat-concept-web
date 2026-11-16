/* A small, real-time transport for the deterministic concept-film renderer. */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const player = $("player");
  if (!player) return;

  const startGate = $("start-gate");
  const endGate = $("end-gate");
  const playButton = $("play-pause");
  const playUse = $("play-use");
  const soundButton = $("sound-toggle");
  const soundUse = $("sound-use");
  const fullscreenButton = $("fullscreen");
  const transport = $("transport");
  const timecode = $("timecode");
  const seek = $("seek");
  const sceneLabel = $("scene-label");
  const sceneDescription = $("scene-description");
  const hint = $("playback-hint");
  const notice = $("screen-notice");
  const chapterButtons = [...document.querySelectorAll("[data-seek]")];
  const initialFilm = window.InboxConceptFilm;
  const duration = Number.isFinite(initialFilm?.duration) ? initialFilm.duration : 108;
  const sound = typeof window.InboxFilmSound === "function"
    ? new window.InboxFilmSound({ duration }) : null;
  let currentTime = 0;
  let state = "poster";
  let muted = false;
  let frame = 0;
  let resizeFrame = 0;
  let anchorTime = 0;
  let anchorWall = 0;
  let lastScene = -1;
  let lastSecond = -1;
  let noticeTimer = 0;
  let isScrubbing = false;
  let resumeAfterScrub = false;
  let disposed = false;
  let renderErrorShown = false;
  let controlsTimer = 0;
  let pointerOnTransport = false;
  let keyboardInput = false;
  sound?.setMuted(muted);
  if (sound) sound.onError = audioFailed;

  const clamp = (value) => Math.max(0, Math.min(duration, Number.isFinite(Number(value)) ? Number(value) : 0));
  const format = (value) => {
    const seconds = Math.floor(clamp(value));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  };
  const film = () => window.InboxConceptFilm;
  const playing = () => state === "playing";
  const posterTime = () => Number.isFinite(film()?.posterTime) ? film().posterTime : 2.1;

  function showNotice(message) {
    if (!notice) return;
    clearTimeout(noticeTimer);
    notice.textContent = message;
    notice.hidden = false;
    noticeTimer = window.setTimeout(() => { notice.hidden = true; }, 1100);
  }

  function sceneAt(time) {
    const scenes = film()?.scenes || [];
    let index = 0;
    for (let i = 0; i < scenes.length; i++) {
      if (time >= scenes[i].start) index = i;
      else break;
    }
    return { index, scene: scenes[index] || { label: "开篇", description: "一个只和自己聊天的 App · 项目构想展示。" } };
  }

  function updateUI(force = false) {
    player.dataset.state = state;
    player.dataset.time = currentTime.toFixed(3);
    player.dataset.playing = String(playing());
    if (startGate) startGate.hidden = state !== "poster";
    if (endGate) endGate.hidden = state !== "ended";
    if (playUse) playUse.setAttribute("href", playing() ? "#pause-icon" : "#play-icon");
    playButton?.setAttribute("aria-label", playing() ? "暂停短片" : state === "ended" ? "重新播放短片" : "播放短片");
    playButton?.setAttribute("aria-pressed", String(playing()));
    soundButton?.setAttribute("aria-label", muted ? "开启声音" : "关闭声音");
    soundButton?.setAttribute("aria-pressed", String(!muted));
    if (soundUse) soundUse.setAttribute("href", muted ? "#mute-icon" : "#sound-icon");
    if (seek) {
      seek.max = String(duration);
      if (!isScrubbing) seek.value = currentTime.toFixed(2);
      seek.style.setProperty("--progress", `${(currentTime / duration * 100).toFixed(3)}%`);
    }

    const second = Math.floor(currentTime);
    if (second !== lastSecond || force) {
      lastSecond = second;
      if (timecode) {
        const text = `${format(currentTime)} `;
        if (timecode.firstChild?.nodeType === 3) timecode.firstChild.nodeValue = text;
        else timecode.insertBefore(document.createTextNode(text), timecode.firstChild);
        const total = timecode.querySelector("span");
        if (total) total.textContent = `/ ${format(duration)}`;
      }
      seek?.setAttribute("aria-valuetext", `${Math.floor(second / 60)} 分 ${second % 60} 秒，共 ${Math.floor(duration / 60)} 分 ${duration % 60} 秒`);
    }

    const { index, scene } = sceneAt(currentTime);
    player.dataset.scene = String(index);
    player.dataset.sceneLabel = scene.label || "开篇";
    const sceneChanged = index !== lastScene;
    if (sceneChanged || force) {
      lastScene = index;
      if (sceneLabel) sceneLabel.textContent = scene.label || "开篇";
      if (sceneDescription && sceneChanged) sceneDescription.textContent = scene.description || scene.label || "";
      let chapterIndex = 0;
      chapterButtons.forEach((button, i) => {
        if (Number(button.dataset.seek) <= currentTime) chapterIndex = i;
      });
      chapterButtons.forEach((button, i) => {
        if (i === chapterIndex) button.setAttribute("aria-current", "true");
        else button.removeAttribute("aria-current");
      });
    }
    if (hint) {
      const nextHint = state === "poster" ? "点击播放，画面将自动展开"
        : state === "ended" ? "短片结束 · 可重播或选择章节"
          : playing() ? "自动播放中 · 空格暂停，左右键跳转"
            : "已暂停 · 点击播放继续观看";
      if (hint.textContent !== nextHint) hint.textContent = nextHint;
    }
    syncControls();
  }

  function draw(time = currentTime) {
    const renderer = film();
    if (!renderer || typeof renderer.render !== "function") return false;
    try {
      renderer.render(time);
      return true;
    } catch (_) {
      if (!renderErrorShown) {
        renderErrorShown = true;
        showNotice("画面暂未就绪，请稍后再试");
      }
      return false;
    }
  }

  function sampleClock(now = performance.now()) {
    if (!playing()) return;
    const mediaTime = sound?.getTime?.();
    if (Number.isFinite(mediaTime)) {
      currentTime = clamp(mediaTime);
      anchorTime = currentTime;
      anchorWall = now;
    } else {
      currentTime = clamp(anchorTime + Math.max(0, now - anchorWall) / 1000);
    }
  }

  function cancelFrame() {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
  }

  function finish() {
    cancelFrame();
    currentTime = duration;
    state = "ended";
    sound?.pause();
    draw();
    updateUI(true);
  }

  function tick(now) {
    frame = 0;
    if (!playing() || disposed) return;
    sampleClock(now);
    if (currentTime >= duration) {
      finish();
      return;
    }
    if (!draw()) {
      pausePlayback();
      return;
    }
    updateUI();
    frame = window.requestAnimationFrame(tick);
  }

  function beginPlayback() {
    if (disposed) return;
    if (!film() || typeof film().render !== "function") {
      showNotice("画面正在准备，请稍后再试");
      return;
    }
    if (playing()) return;
    if (state === "ended" || currentTime >= duration) currentTime = 0;
    cancelFrame();
    state = "playing";
    anchorTime = currentTime;
    anchorWall = performance.now();
    sound?.setMuted(muted);
    if (sound?.supported) sound.play(currentTime);
    else audioFailed(currentTime);
    draw();
    updateUI(true);
    frame = window.requestAnimationFrame(tick);
  }

  function pausePlayback() {
    if (playing()) sampleClock();
    cancelFrame();
    sound?.pause();
    if (currentTime >= duration) {
      finish();
      return;
    }
    if (state !== "poster") state = "paused";
    draw(state === "poster" ? posterTime() : currentTime);
    updateUI(true);
  }

  function togglePlayback() {
    if (playing()) pausePlayback();
    else gesturePlay();
  }

  function gesturePlay() {
    // The single soundtrack starts once, synchronously inside this gesture.
    beginPlayback();
  }

  function seekTo(time, resume = playing()) {
    if (disposed) return;
    cancelFrame();
    sound?.pause();
    currentTime = clamp(time);
    sound?.seek(currentTime);
    if (currentTime >= duration) {
      finish();
      return;
    }
    state = "paused";
    draw();
    updateUI(true);
    if (resume) gesturePlay();
  }

  function audioFailed(time) {
    if (Number.isFinite(time)) currentTime = clamp(time);
    anchorTime = currentTime;
    anchorWall = performance.now();
    muted = true;
    sound?.setMuted(true);
    showNotice("声轨暂时无法播放，继续静音观看");
    updateUI(true);
  }

  async function enableSound() {
    if (!sound?.supported) { audioFailed(currentTime); return false; }
    const recovering = sound.failed;
    if (recovering && !sound.recover()) return false;
    muted = false;
    sound.setMuted(false);
    updateUI(true);
    if (recovering && playing()) return sound.play(currentTime);
    return true;
  }

  function muteSound() {
    muted = true;
    sound?.setMuted(true);
    updateUI(true);
  }

  function toggleSound() {
    if (muted) {
      enableSound().then((ready) => { if (ready && !muted) showNotice("声音已开启"); });
    } else {
      muteSound();
      showNotice("声音已关闭");
    }
  }

  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement;
  }

  function controlsHeld() {
    return isScrubbing || pointerOnTransport ||
      (keyboardInput && Boolean(transport?.contains?.(document.activeElement)));
  }

  function clearControlsTimer() {
    clearTimeout(controlsTimer);
    controlsTimer = 0;
  }

  function syncControls() {
    const canHide = fullscreenElement() === player && playing() && !disposed;
    if (!canHide || controlsHeld()) {
      clearControlsTimer();
      player.dataset.controlsVisible = "true";
    } else if (player.dataset.controlsVisible !== "false" && !controlsTimer) {
      controlsTimer = window.setTimeout(() => {
        controlsTimer = 0;
        if (fullscreenElement() === player && playing() && !controlsHeld() && !disposed) {
          player.dataset.controlsVisible = "false";
        }
      }, 1800);
    }
  }

  function revealControls() {
    clearControlsTimer();
    player.dataset.controlsVisible = "true";
    syncControls();
  }

  function updateFullscreen() {
    const active = fullscreenElement() === player;
    player.dataset.fullscreen = String(active);
    fullscreenButton?.setAttribute("aria-label", active ? "退出全屏" : "全屏观看");
    fullscreenButton?.setAttribute("aria-pressed", String(active));
    pointerOnTransport = false;
    revealControls();
    redraw();
  }

  async function toggleFullscreen() {
    try {
      if (fullscreenElement()) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) await exit.call(document);
      } else {
        const request = player.requestFullscreen || player.webkitRequestFullscreen;
        if (!request) {
          showNotice("此浏览器不支持网页全屏");
          return;
        }
        await request.call(player);
      }
    } catch (_) {
      showNotice("暂时无法进入全屏，可横屏观看");
    }
  }

  function redraw() {
    if (resizeFrame || disposed) return;
    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = 0;
      film()?.resize?.();
      draw(state === "poster" ? posterTime() : currentTime);
    });
  }

  $("start-sound")?.addEventListener("click", () => {
    if (sound?.failed) {
      sound.recover();
      if (playing()) sound.play(currentTime);
    }
    muted = false;
    sound?.setMuted(false);
    updateUI(true);
    gesturePlay();
  });
  $("start-silent")?.addEventListener("click", () => { muteSound(); gesturePlay(); });
  $("end-replay")?.addEventListener("click", () => seekTo(0, true));
  $("restart")?.addEventListener("click", () => { seekTo(0, true); showNotice("从头播放"); });
  playButton?.addEventListener("click", togglePlayback);
  soundButton?.addEventListener("click", toggleSound);
  fullscreenButton?.addEventListener("click", toggleFullscreen);
  player.addEventListener("pointermove", revealControls, { passive: true });
  player.addEventListener("pointerdown", () => {
    keyboardInput = false;
    revealControls();
  }, { passive: true });
  transport?.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "touch") return;
    pointerOnTransport = true;
    revealControls();
  });
  transport?.addEventListener("pointerleave", () => {
    pointerOnTransport = false;
    revealControls();
  });
  transport?.addEventListener("focusin", revealControls);
  transport?.addEventListener("focusout", () => {
    // Let the browser finish moving focus before deciding whether to hide.
    window.setTimeout(revealControls, 0);
  });
  chapterButtons.forEach((button) => {
    button.addEventListener("click", () => seekTo(Number(button.dataset.seek), true));
  });

  function finishScrubbing() {
    if (!isScrubbing) return;
    isScrubbing = false;
    if (seek) seekTo(Number(seek.value), resumeAfterScrub);
    resumeAfterScrub = false;
  }

  seek?.addEventListener("pointerdown", () => {
    if (isScrubbing) return;
    resumeAfterScrub = playing();
    isScrubbing = true;
    pausePlayback();
  });
  seek?.addEventListener("input", () => {
    seekTo(Number(seek.value), isScrubbing ? false : playing());
  });
  seek?.addEventListener("change", finishScrubbing);
  seek?.addEventListener("blur", finishScrubbing);
  window.addEventListener("pointerup", finishScrubbing);
  window.addEventListener("pointercancel", finishScrubbing);

  document.addEventListener("keydown", (event) => {
    keyboardInput = true;
    revealControls();
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target;
    if (target instanceof Element && target.closest("input,textarea,select,summary,[contenteditable='true']")) return;
    const key = event.key.toLowerCase();
    if (key === " " && target instanceof Element && target.closest("button,a,[role='button']")) return;
    if ([" ", "k", "m", "f"].includes(key) && event.repeat) return;
    if (key === " " || key === "k") {
      event.preventDefault();
      togglePlayback();
    } else if (key === "arrowleft" || key === "arrowright") {
      event.preventDefault();
      sampleClock();
      seekTo(currentTime + (key === "arrowleft" ? -5 : 5));
      showNotice(key === "arrowleft" ? "后退 5 秒" : "前进 5 秒");
    } else if (key === "home" || key === "end") {
      event.preventDefault();
      seekTo(key === "home" ? 0 : duration);
    } else if (key === "m") {
      event.preventDefault();
      toggleSound();
    } else if (key === "f") {
      event.preventDefault();
      toggleFullscreen();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      resumeAfterScrub = false;
      isScrubbing = false;
      if (playing()) pausePlayback();
      else sound?.pause();
    }
  });
  // Only the actual embedding parent may request a pause. This also cancels
  // a scrub resume, so scrolling away cannot restart a hidden soundtrack.
  window.addEventListener("message", (event) => {
    if (event.source !== window.parent || event.data?.type !== "concept-film:pause") return;
    resumeAfterScrub = false;
    isScrubbing = false;
    pausePlayback();
  });
  window.addEventListener("pagehide", () => { pausePlayback(); sound?.pause(); });
  window.addEventListener("resize", redraw, { passive: true });
  window.addEventListener("orientationchange", redraw, { passive: true });
  document.addEventListener("fullscreenchange", updateFullscreen);
  document.addEventListener("webkitfullscreenchange", updateFullscreen);
  window.addEventListener("load", redraw, { once: true });
  if (document.fonts?.ready) document.fonts.ready.then(redraw).catch(() => {});

  updateUI(true);
  updateFullscreen();
  draw(posterTime());
})();
