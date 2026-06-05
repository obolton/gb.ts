
const FRAME_DURATION = (1000 * 70224) / 4194304;
const MAX_FRAME_DELTA = FRAME_DURATION * 5;

export default class Scheduler {
  private request: number | null = null;
  private lastTime = 0;
  private accumulator = 0;
  private callback: (() => void) | null = null;

  start(onFrame: () => void) {
    if (this.callback) {
      return;
    }

    this.callback = onFrame;
    document.addEventListener('visibilitychange', this);
    this.resume();
  }

  stop() {
    document.removeEventListener('visibilitychange', this);
    this.pause();
    this.callback = null;
  }

  pause() {
    if (this.request !== null) {
      cancelAnimationFrame(this.request);
      this.request = null;
    }
  }

  resume() {
    if (this.request !== null || !this.callback) {
      return;
    }

    this.lastTime = performance.now();
    this.accumulator = 0;
    this.request = requestAnimationFrame(this.frame.bind(this));
  }

  private frame(now: number) {
    this.accumulator += Math.min(now - this.lastTime, MAX_FRAME_DELTA);
    this.lastTime = now;

    while (this.accumulator >= FRAME_DURATION) {
      this.accumulator -= FRAME_DURATION;
      this.callback?.();
      if (this.request === null) {
        return;
      }
    }

    this.request = requestAnimationFrame(this.frame.bind(this));
  }

  handleEvent(event: Event) {
    if (event.type === 'visibilitychange' && !document.hidden) {
      this.lastTime = performance.now();
    }
  }
}
