import { localDay } from './todo';

// Check the wall clock while foregrounded: a fixed 24-hour delay misses DST,
// and a midnight-only timer misses manual clock or time-zone changes.
export function startDayClock(
  changed: (now: Date) => void,
  now = () => new Date(),
  schedule: (callback: () => void, delay: number) => () => void = (callback, delay) => {
    const timer = setTimeout(callback, delay);
    return () => clearTimeout(timer);
  },
) {
  let stopped = false;
  let cancel: (() => void) | undefined;
  let previous = '';
  const tick = () => {
    if (stopped) return;
    const date = now();
    const key = `${localDay(date)}:${date.getTimezoneOffset()}`;
    if (key !== previous) { previous = key; changed(date); }
    const midnight = new Date(date);
    midnight.setHours(24, 0, 0, 0);
    if (!stopped) cancel = schedule(tick, Math.max(1, Math.min(60_000, midnight.getTime() - date.getTime())));
  };
  tick();
  return () => { stopped = true; cancel?.(); };
}
