import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import Scheduler from '../../src/scheduler/scheduler';

const FRAME_DURATION = (1000 * 70224) / 4194304;

describe('Scheduler', () => {
  let scheduler: Scheduler;
  let now = 0;
  let pending: FrameRequestCallback | null = null;

  beforeEach(() => {
    now = 0;
    pending = null;
    scheduler = new Scheduler();
    vi.stubGlobal('performance', { now: () => now });
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      pending = callback;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {
      pending = null;
    });
  });

  afterEach(() => {
    scheduler.stop();
    vi.unstubAllGlobals();
  });

  // Advance the wall clock by `ms` and fire the pending animation frame.
  function tick(ms: number) {
    now += ms;
    const callback = pending;
    pending = null;
    callback?.(now);
  }

  test('runs one frame per frame-duration of elapsed time', () => {
    const onFrame = vi.fn<() => void>();
    scheduler.start(onFrame);

    for (let i = 0; i < 10; i++) {
      tick(FRAME_DURATION);
    }

    expect(onFrame).toHaveBeenCalledTimes(10);
  });

  test('runs the frames owed when a callback is delayed', () => {
    const onFrame = vi.fn<() => void>();
    scheduler.start(onFrame);

    tick(FRAME_DURATION * 3);

    expect(onFrame).toHaveBeenCalledTimes(3);
  });

  test('clamps a large gap so a stall cannot queue a burst of frames', () => {
    const onFrame = vi.fn<() => void>();
    scheduler.start(onFrame);

    tick(FRAME_DURATION * 100); // e.g. machine sleep or a paused debugger

    expect(onFrame).toHaveBeenCalledTimes(5); // MAX_FRAME_DELTA
  });

  test('resync drops elapsed time instead of replaying it', () => {
    const onFrame = vi.fn<() => void>();
    scheduler.start(onFrame);

    now += FRAME_DURATION * 100; // e.g. time passes while the tab is hidden
    scheduler.resync();

    tick(FRAME_DURATION);

    expect(onFrame).toHaveBeenCalledTimes(1);
  });

  test('ignores a second start while already running', () => {
    const onFrame = vi.fn<() => void>();
    scheduler.start(onFrame);
    scheduler.start(vi.fn<() => void>());

    tick(FRAME_DURATION);

    expect(onFrame).toHaveBeenCalledTimes(1);
  });

  test('runs no further frames after stop', () => {
    const onFrame = vi.fn<() => void>();
    scheduler.start(onFrame);
    scheduler.stop();

    tick(FRAME_DURATION);

    expect(onFrame).not.toHaveBeenCalled();
  });

  test('runs no frames while paused and continues after resume', () => {
    const onFrame = vi.fn<() => void>();
    scheduler.start(onFrame);

    tick(FRAME_DURATION);
    scheduler.pause();
    tick(FRAME_DURATION);

    expect(onFrame).toHaveBeenCalledTimes(1);

    scheduler.resume();
    tick(FRAME_DURATION);

    expect(onFrame).toHaveBeenCalledTimes(2);
  });

  test('stops the loop when the frame callback pauses it', () => {
    const onFrame = vi.fn<() => void>(() => scheduler.pause());
    scheduler.start(onFrame);

    tick(FRAME_DURATION);
    tick(FRAME_DURATION);

    expect(onFrame).toHaveBeenCalledTimes(1);
  });

  test('resume does nothing before start', () => {
    const onFrame = vi.fn<() => void>();
    scheduler.resume();

    tick(FRAME_DURATION);

    expect(onFrame).not.toHaveBeenCalled();
  });
});
