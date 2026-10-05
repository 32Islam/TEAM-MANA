/**
 * Safe clipboard copy utility with fallback for iframe environments where Document is not focused
 * or Permissions API rejects writeText.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // First attempt modern Clipboard API if document is focused and available
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Document is not focused, or permissions denied in iframe - fall back below
    }
  }

  // Fallback using textarea + execCommand('copy') which works reliably even inside iframes
  if (typeof document !== 'undefined') {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      // Prevent scrolling and positioning artifacts
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.width = '2em';
      textArea.style.height = '2em';
      textArea.style.padding = '0';
      textArea.style.border = 'none';
      textArea.style.outline = 'none';
      textArea.style.boxShadow = 'none';
      textArea.style.background = 'transparent';
      textArea.style.opacity = '0';
      textArea.setAttribute('readonly', '');

      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      textArea.setSelectionRange(0, text.length);

      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch {
      return false;
    }
  }

  return false;
}
