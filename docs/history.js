import { coalesceKeyOf } from './commands.js';

const COALESCE_WINDOW_MS = 700;
// Cap the persisted history so the IndexedDB blob doesn't grow forever.
// Oldest entries are dropped as new ones come in.
const MAX_ENTRIES = 150;

export class History {
  constructor() {
    this.past = [];
    this.future = [];
  }

  hydrate({ past = [], future = [] } = {}) {
    this.past = Array.isArray(past) ? past.slice(-MAX_ENTRIES) : [];
    this.future = Array.isArray(future) ? future : [];
  }

  serialize() {
    return { past: this.past, future: this.future };
  }

  record(cmd) {
    const stamped = { ...cmd, t: Date.now() };
    const last = this.past[this.past.length - 1];
    // Coalesce only commands that opt in (coalesceKeyOf ≠ null); their
    // payloads are exactly ids + from/to, so the merge below is sound.
    const key = coalesceKeyOf(cmd);
    if (
      last &&
      key !== null &&
      coalesceKeyOf(last) === key &&
      stamped.t - last.t < COALESCE_WINDOW_MS
    ) {
      const merged = {
        ...last,
        payload: { ...last.payload, to: cmd.payload.to },
        t: stamped.t,
      };
      // A merge that lands back on its starting value is a no-op — drop the
      // entry instead of leaving a dead undo step.
      if (JSON.stringify(merged.payload.from) === JSON.stringify(merged.payload.to)) {
        this.past.pop();
      } else {
        this.past[this.past.length - 1] = merged;
      }
    } else {
      this.past.push(stamped);
      if (this.past.length > MAX_ENTRIES) this.past.shift();
    }
    this.future = [];
  }

  popUndo() { return this.past.pop() ?? null; }
  popRedo() { return this.future.pop() ?? null; }
  pushPast(cmd) { this.past.push(cmd); }
  pushFuture(cmd) { this.future.push(cmd); }
  clear() { this.past = []; this.future = []; }
  canUndo() { return this.past.length > 0; }
  canRedo() { return this.future.length > 0; }
}
