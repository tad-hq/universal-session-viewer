// COPIED VERBATIM from v1 index.html lines 1290-1341, 1828-1836
// DO NOT MODIFY - These are exact copies of v1 logic

/**
 * Escape HTML special characters
 * Source: v1 index.html lines 1290-1294, 1800-1804
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Extract a short title from summary text
 * Uses same regex as main.js extractTitleFromSummary
 * Source: v1 index.html lines 1297-1341 (updated to handle next-line content)
 */
export function extractShortTitle(text: string | null | undefined): string {
  if (!text || typeof text !== 'string') return 'Untitled Session';

  // Pattern handles both same-line and next-line content:
  // **Domain:** content OR **Domain:**\ncontent
  const domainMatch = text.match(
    /\*\*\s*(?:\d+\.\s*)?(?:Main Topic\/Domain|Domain|Main Topic)\s*(?:\*\*\s*)?:\s*(?:\*\*)?\s*([^\n*]+(?:\n[^\n*]+)?)/i
  );

  if (domainMatch) {
    let rawTitle = (domainMatch[1] || '').trim();

    // Handle content that may be on the next line
    if (rawTitle.includes('\n')) {
      rawTitle = rawTitle.split('\n')[0].trim() || rawTitle.split('\n')[1]?.trim() || '';
    }

    // If still empty, look for content on the line after
    if (!rawTitle) {
      const nextLineMatch = text.match(
        /\*\*\s*(?:\d+\.\s*)?(?:Main Topic\/Domain|Domain|Main Topic)[^*]*\*\*[:\s]*\n+([^\n*]+)/i
      );
      if (nextLineMatch) {
        rawTitle = nextLineMatch[1].trim();
      }
    }

    let title = rawTitle;
    // Remove trailing parentheticals
    title = title.replace(/\s*\([^)]+\)\s*$/, '');
    // Remove quotes
    title = title.replace(/^["']|["']$/g, '').trim();
    // Limit to 12 words
    const words = title.split(/\s+/);
    if (words.length > 12) {
      title = words.slice(0, 12).join(' ');
    }
    if (title.length >= 10) {
      return title;
    }
  }

  // Fallback: first meaningful line
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  for (const line of lines) {
    if (/^#+\s*(Summary|Analysis|Conversation|Session)|^##/i.test(line)) {
      continue;
    }
    let cleaned = line
      .replace(/^#+\s*/, '')
      .replace(/\*\*/g, '')
      .replace(/^["']|["']$/g, '')
      .trim();
    if (cleaned.includes(' - ')) {
      cleaned = cleaned.split(' - ')[0].trim();
    }
    if (cleaned.length > 0 && cleaned.length < 120) {
      return cleaned;
    }
  }

  return 'Untitled Session';
}

/**
 * Get human-readable status text
 * Source: v1 index.html lines 1828-1836
 */
export function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    pending: 'Pending',
    analyzing: 'Analyzing',
    completed: 'Completed',
    error: 'Error',
  };
  return statusMap[status] || status;
}
