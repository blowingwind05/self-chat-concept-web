/* One pre-mixed stereo soundtrack. The media clock also drives the picture. */
(() => {
  "use strict";
  const TRACK_SOURCE = "assets/film-soundtrack.mp3?v=20";

  class InboxFilmSound {
    constructor({ duration = 114, source = TRACK_SOURCE } = {}) {
      this.duration = Number.isFinite(duration) && duration > 0 ? duration : 114;
      this.muted = false;
      this.failed = false;
      this.onError = null;
      this._timeline = 0;
      this._playing = false;
      this._waiting = false;
      this._pendingSeek = null;
      this._request = 0;
      this._waitTimer = 0;
      this._destroyed = false;
      this._listeners = [];
      this.supported = typeof window.Audio === "function";
      this._media = null;
      if (!this.supported) return;
      try {
        const media = this._media = new window.Audio(source);
        media.preload = "auto";
        media.loop = false;
        media.volume = 1;
        media.muted = false;
        const listen = (name, fn) => {
          media.addEventListener(name, fn);
          this._listeners.push([name, fn]);
        };
        listen("loadedmetadata", () => this._applySeek());
        listen("playing", () => this._ready());
        listen("seeked", () => this._ready());
        listen("waiting", () => this._hold());
        listen("seeking", () => this._hold());
        listen("ended", () => {
          this._timeline = this.duration;
          this._playing = false;
          this._waiting = false;
          this._clearWaitTimer();
        });
        listen("error", () => this._fail());
        // Preloading is silent; play() is invoked only from a user gesture.
        media.load();
      } catch (_) {
        this.supported = false;
        this._media = null;
      }
    }

    _safeTime(value) {
      return Math.max(0, Math.min(this.duration, Number.isFinite(value) ? value : 0));
    }

    _clearWaitTimer() {
      window.clearTimeout(this._waitTimer);
      this._waitTimer = 0;
    }

    _armWaitTimer() {
      if (!this._playing || this._waitTimer) return;
      this._waitTimer = window.setTimeout(() => {
        this._waitTimer = 0;
        if (this._playing && this._waiting) this._fail();
      }, 8000);
    }

    _hold() {
      if (this.failed || this._destroyed) return;
      if (this._pendingSeek === null && this._media?.readyState >= 1 && Number.isFinite(this._media.currentTime)) {
        this._timeline = this._safeTime(this._media.currentTime);
      }
      this._waiting = true;
      this._armWaitTimer();
    }

    _ready() {
      if (this.failed || this._destroyed) return;
      this._applySeek();
      if (this._pendingSeek === null && !this._media.seeking && this._media.readyState >= 2) {
        this._waiting = false;
        this._clearWaitTimer();
      }
    }

    _applySeek() {
      if (this._pendingSeek === null || !this._media || this._media.readyState < 1) return;
      const target = this._pendingSeek;
      this._pendingSeek = null;
      try {
        this._media.currentTime = target;
      } catch (_) { this._pendingSeek = target; }
    }

    _fail() {
      if (this.failed || this._destroyed) return;
      const heldTime = this.getTime();
      this._timeline = this._safeTime(Number.isFinite(heldTime) ? heldTime : this._timeline);
      this.failed = true;
      this._playing = false;
      this._waiting = false;
      this._request++;
      this._clearWaitTimer();
      this._media?.pause();
      this.onError?.(this._timeline);
    }

    setMuted(value) {
      this.muted = Boolean(value);
      if (this._media) this._media.muted = this.muted;
    }

    getTime() {
      if (!this.supported || this.failed || this._destroyed || !this._media) return null;
      if (this._media.ended) return this.duration;
      if (this._waiting || this._pendingSeek !== null || this._media.seeking || this._media.readyState < 2) {
        return this._timeline;
      }
      if (Number.isFinite(this._media.currentTime)) this._timeline = this._safeTime(this._media.currentTime);
      return this._timeline;
    }

    play(time = this._timeline) {
      if (!this.supported || this.failed || this._destroyed) return Promise.resolve(false);
      const target = this._safeTime(time);
      if (this._playing && Math.abs((this.getTime() ?? target) - target) < 0.05) {
        return Promise.resolve(true);
      }
      this.seek(target);
      this._playing = target < this.duration;
      if (!this._playing) return Promise.resolve(false);
      this._waiting = true;
      this._armWaitTimer();
      this._media.muted = this.muted;
      const request = ++this._request;
      try {
        // This call stays synchronous inside the play/seek button gesture.
        const pending = this._media.play();
        return Promise.resolve(pending).then(() => {
          if (request !== this._request || !this._playing || this._destroyed) return false;
          this._ready();
          return !this.failed;
        }, () => {
          if (request === this._request && this._playing && !this._destroyed) this._fail();
          return false;
        });
      } catch (_) {
        this._fail();
        return Promise.resolve(false);
      }
    }

    pause() {
      const time = this.getTime();
      if (Number.isFinite(time)) this._timeline = time;
      this._request++;
      this._playing = false;
      this._waiting = false;
      this._clearWaitTimer();
      this._media?.pause();
    }

    seek(time) {
      this._timeline = this._safeTime(time);
      if (!this._media || this.failed || this._destroyed) return;
      if (this._media.readyState < 1 || Math.abs(this._media.currentTime - this._timeline) > 0.001) {
        this._pendingSeek = this._timeline;
        this._applySeek();
      }
      this._waiting = this._playing && (this._pendingSeek !== null || this._media.seeking);
      if (this._waiting) this._armWaitTimer();
    }

    recover() {
      if (!this.supported || this._destroyed || !this._media) return false;
      this.failed = false;
      this._pendingSeek = this._timeline;
      this._media.load();
      return true;
    }

    destroy() {
      this.pause();
      this._destroyed = true;
      for (const [name, listener] of this._listeners) this._media?.removeEventListener(name, listener);
      this._listeners = [];
      this._media?.removeAttribute("src");
      this._media?.load();
      this._media = null;
    }
  }

  window.InboxFilmSound = InboxFilmSound;
})();
