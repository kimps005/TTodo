import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { startDayClock } from '../domain/dayClock';

export function useDayClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let stop: (() => void) | undefined;
    const update = (active: boolean) => {
      stop?.();
      stop = active ? startDayClock(setNow) : undefined;
    };
    update(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', state => update(state === 'active'));
    return () => { stop?.(); subscription.remove(); };
  }, []);
  return now;
}
