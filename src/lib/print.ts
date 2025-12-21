
/**
 * Print a PDF Blob by loading it in a hidden iframe and triggering the native print dialog.
 * - No file download is triggered.
 * - Works in Chrome, Edge, Firefox.
 * - Ensures window.print() is called only after PDF is fully loaded.
 * - Keeps invoice design/layout unchanged.
 * - No visible reloads or blank pages.
 */
export async function openPdfForPrint(blob: Blob) {
  const url = URL.createObjectURL(blob);
  // Create a hidden iframe to load the PDF
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  iframe.src = url;
  document.body.appendChild(iframe);

  // Wait for the PDF to fully load before printing
  iframe.onload = () => {
    // Focus the iframe's window and call print
    if (iframe.contentWindow) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }
    // Clean up after printing
    setTimeout(() => {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(url);
    }, 1000);
  };
}
