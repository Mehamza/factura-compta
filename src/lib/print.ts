export async function openPdfForPrint(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const win = window.open(url);
  if (!win) {
    throw new Error('La fenêtre d’impression a été bloquée par le navigateur.');
  }
  const onLoad = () => {
    win.focus();
    win.print();
  };
  // Attempt to print after a short delay to ensure load
  setTimeout(onLoad, 300);
}
