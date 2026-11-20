// The native queue owns the files until take() returns. An event is only a wake-up:
// it can arrive before JS starts, during another read, or after a privacy purge.
export function observeSharedImageInbox(input: {
  subscribe: (wake: () => void) => () => void;
  take: () => Promise<string[]>;
  generation: () => number;
  deliver: (images: string[]) => void;
  discard: (uri: string) => void;
  failed: (retry: () => void) => void;
}) {
  let active = true;
  let reading = false;
  let requested = false;
  const wake = async () => {
    if (!active) return;
    requested = true;
    if (reading) return;
    reading = true;
    try {
      while (active && requested) {
        requested = false;
        const generation = input.generation();
        try {
          const images = await input.take();
          if (!active || generation !== input.generation()) images.forEach(input.discard);
          else if (images.length) input.deliver(images);
        } catch {
          if (active && generation === input.generation()) input.failed(wake);
        }
      }
    } finally { reading = false; }
  };
  const unsubscribe = input.subscribe(wake);
  void wake();
  return () => { active = false; unsubscribe(); };
}
