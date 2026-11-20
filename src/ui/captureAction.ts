interface CaptureAnalysisRequest {
  working: { current: boolean };
  setBusy: (busy: boolean) => void;
  readConsent: () => Promise<string | null>;
  writeConsent: () => Promise<unknown>;
  analyze: () => Promise<void>;
  prompt: () => void;
  isCurrent?: () => boolean;
}

// Serialize consent and analysis for one image. The caller can invalidate the request.
export async function requestCaptureAnalysis({ working, setBusy, readConsent, writeConsent, analyze, prompt, isCurrent = () => true }: CaptureAnalysisRequest, grantConsent = false): Promise<void> {
  if (working.current || !isCurrent()) return;
  working.current = true;
  setBusy(true);
  try {
    if (grantConsent) await writeConsent();
    const consent = grantConsent || await readConsent() === 'yes';
    if (!isCurrent()) return;
    if (consent) await analyze();
    else prompt();
  }
  finally { working.current = false; setBusy(false); }
}
