
export type OpenPdfForPrintOptions = {
  /**
   * If provided (and not blocked by popup blockers), the PDF is rendered in this window.
   * This is the most reliable approach when printing is triggered after async work.
   */
  preOpenedWindow?: Window | null;
  /**
   * Whether to attempt printing automatically (some browsers may block this).
   * Defaults to true.
   */
  autoPrint?: boolean;
};

/**
 * Print a PDF Blob by rendering it and triggering the native print dialog.
 * - If `preOpenedWindow` is provided: renders PDF in that window (best for popup policies).
 * - Otherwise: falls back to a hidden iframe.
 */
export async function openPdfForPrint(blob: Blob, options?: OpenPdfForPrintOptions) {
  const url = URL.createObjectURL(blob);
  const autoPrint = options?.autoPrint !== false;

  const scheduleRevoke = () => {
    // Do not revoke too early: some browsers need the blob URL alive while the print dialog is open.
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 2 * 60 * 1000);
  };

  // Preferred: use a pre-opened window to avoid popup blockers/user-gesture loss.
  // IMPORTANT: Do not attempt to call print() on an embedded PDF iframe's contentWindow.
  // In Firefox the PDF viewer may be cross-origin, which throws a security error.
  if (options?.preOpenedWindow && !options.preOpenedWindow.closed) {
    const w = options.preOpenedWindow;
    try {
      // Navigate the window directly to the blob URL (best compatibility).
      w.location.href = url;

      if (autoPrint) {
        // Give the built-in PDF viewer time to initialize.
        await new Promise<void>((resolve) => window.setTimeout(() => resolve(), 600));
        try {
          w.focus();
          w.print();
        } catch {
          // If auto-print is blocked, keep the PDF window open for manual printing.
        }
      }

      scheduleRevoke();
      return;
    } catch {
      // Fall back to iframe method below.
    }
  }

  // Fallback: hidden iframe in the current window.
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  iframe.style.width = '1px';
  iframe.style.height = '1px';
  iframe.style.opacity = '0';
  iframe.style.border = '0';
  iframe.src = url;
  document.body.appendChild(iframe);

  await new Promise<void>((resolve) => {
    iframe.onload = () => resolve();
    window.setTimeout(() => resolve(), 2500);
  });

  if (autoPrint && iframe.contentWindow) {
    await new Promise<void>((resolve) => window.setTimeout(() => resolve(), 250));
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch {
      // Some browsers treat the PDF viewer as cross-origin.
      // As a fallback, open the PDF in a new tab; user can print manually.
      window.open(url, '_blank');
    }
  }

  // Cleanup iframe, but keep blob URL around for a bit.
  window.setTimeout(() => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  }, 10_000);
  scheduleRevoke();
}
