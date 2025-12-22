function extractTextContent(content) {
  if (!content) return '';

  if (typeof content === 'string') {
    const trimmed = content.trim();
    if (
      trimmed.startsWith('<command-name>') ||
      trimmed.startsWith('<local-command-stdout>') ||
      trimmed.startsWith('<local-command-stderr>') ||
      trimmed.startsWith('Caveat: The messages below were generated')
    ) {
      return '';
    }
    return content;
  }

  if (Array.isArray(content)) {
    const textBlocks = content
      .filter((block) => {
        return block.type === 'text';
      })
      .map((block) => {
        return block.text || '';
      })
      .filter((text) => {
        const trimmed = text.trim();
        return (
          !trimmed.includes('[Request interrupted by user') &&
          !trimmed.includes('[Request cancelled by user') &&
          !trimmed.includes("The user doesn't want to proceed") &&
          !trimmed.includes('Tool use was rejected') &&
          trimmed.length > 0
        );
      })
      .join('\n');

    return textBlocks;
  }

  if (typeof content === 'object') {
    try {
      return JSON.stringify(content, null, 2);
    } catch (e) {
      return String(content);
    }
  }

  return String(content);
}

function extractTitleFromSummary(summary) {
  if (!summary || typeof summary !== 'string') {
    return 'Untitled Session';
  }

  const GENERIC_TERMS = [
    'summary',
    'development',
    'work',
    'session',
    'conversation',
    'analysis',
    'untitled',
    'coding',
  ];

  const domainMatch = summary.match(
    /\*\*\s*(?:\d+\.\s*)?(?:Main Topic\/Domain|Domain|Main Topic)\s*\*\*\s*:\s*([^\n]+)|\*\*\s*(?:\d+\.\s*)?(?:Main Topic\/Domain|Domain|Main Topic)\s*:\s*\*\*\s*([^\n]+)/i
  );

  if (domainMatch) {
    const rawTitle = (domainMatch[1] || domainMatch[2] || '').trim();

    let title = rawTitle
      .replace(/\s*\([^)]+\)\s*$/, '')
      .replace(/^["']|["']$/g, '')
      .trim();

    const words = title.split(/\s+/);
    if (words.length > 12) {
      title = words.slice(0, 12).join(' ');
    }

    title = title
      .split(' ')
      .map((word) => {
        if (word.match(/^[A-Z]{2,}$/)) return word;
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');

    if (title.length < 10) {
      return extractFromFirstMeaningfulLine(summary);
    }

    const titleLower = title.toLowerCase();
    const titleWords = titleLower.split(/\s+/);

    const isOnlyGeneric =
      titleWords.length <= 2 &&
      titleWords.every((word) =>
        GENERIC_TERMS.some((term) => word === term || word.includes(term))
      );

    if (isOnlyGeneric) {
      return extractFromFirstMeaningfulLine(summary);
    }

    return title || 'Untitled Session';
  }

  return extractFromFirstMeaningfulLine(summary);
}

function extractFromFirstMeaningfulLine(summary) {
  const SKIP_PATTERNS = [
    /^#+\s*Summary/i,
    /^Summary/i,
    /^#+\s*Analysis/i,
    /^Analysis/i,
    /^#+\s*Conversation/i,
    /^Conversation/i,
    /^#+\s*Session/i,
    /^Session/i,
    /^##/,
  ];

  const lines = summary
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  for (const line of lines) {
    if (SKIP_PATTERNS.some((pattern) => pattern.test(line))) {
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

module.exports = { extractTextContent, extractTitleFromSummary, extractFromFirstMeaningfulLine };
