interface CaptureAnalysisRequest {
  working: { current: boolean };
  setBusy: (busy: boolean) => void;
  readConsent: () => Promise<string | null>;
  writeConsent: () => Promise<unknown>;
  analyze: () => Promise<void>;
  prompt: () => void;
}

// Photo selection and close handlers use the same ref to protect the draft.
export async function requestCaptureAnalysis({ working, setBusy, readConsent, writeConsent, analyze, prompt }: CaptureAnalysisRequest, grantConsent = false): Promise<void> {
  if (working.current) return;
  working.current = true;
  setBusy(true);
  try {
    if (grantConsent) await writeConsent();
    if (grantConsent || await readConsent() === 'yes') await analyze();
    else prompt();
  }
  finally { working.current = false; setBusy(false); }
}
