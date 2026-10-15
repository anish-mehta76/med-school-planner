/**
 * Saves a file the way the device expects. On phones and tablets (touch, with
 * file sharing) this opens the share sheet, where iPhone offers "Save to Files"
 * (iCloud Drive) and AirDrop. Elsewhere it downloads the file.
 */
export async function saveFile(blob: Blob, fileName: string): Promise<void> {
  const file = new File([blob], fileName, { type: blob.type });
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return;
    } catch (e) {
      // The user closed the share sheet: nothing to do. Any other failure falls back to a download.
      if (e instanceof DOMException && e.name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** File-picker types iPhone's Files app accepts (MIME types alone can grey files out). */
export const JSON_ACCEPT = '.json,application/json';
export const CSV_ACCEPT = '.csv,text/csv,text/comma-separated-values,application/vnd.ms-excel';
