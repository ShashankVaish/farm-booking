/**
 * Hands a downloaded file to the browser.
 *
 * The object URL is revoked on the next tick rather than immediately: some
 * browsers have not started reading the blob when `click()` returns, and
 * revoking too early produces a failed download with no error anywhere.
 */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
