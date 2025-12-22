/**
 * Lazy-loaded markdown parser
 *
 * PERFORMANCE: marked is ~60KB and not needed until rendering session content.
 * Dynamic import defers loading until first use, reducing initial bundle size.
 *
 * V1 Pattern: Always loaded marked upfront
 * V2 Optimization: Lazy load on first parse, then cache
 */

import type { marked as MarkedType } from 'marked';

// Cache the marked instance
let cachedMarked: typeof MarkedType | null = null;

/**
 * Get the marked parser instance, loading lazily on first call.
 * Subsequent calls return the cached instance.
 */
export async function getMarked(): Promise<typeof MarkedType> {
  if (cachedMarked) {
    return cachedMarked;
  }

  // Dynamic import - only loads when first called
  const { marked } = await import('marked');

  // Configure marked options
  marked.setOptions({
    gfm: true, // GitHub Flavored Markdown
    breaks: true, // Line breaks as <br>
  });

  cachedMarked = marked;
  return marked;
}

/**
 * Parse markdown content to HTML.
 * Loads marked lazily on first call.
 *
 * @param content - Markdown content to parse
 * @returns HTML string
 */
export async function parseMarkdown(content: string): Promise<string> {
  const marked = await getMarked();
  return marked.parse(content, { async: false }) as string;
}

/**
 * Synchronous parse (requires marked to be pre-loaded).
 * Use getMarked() first to ensure it is loaded, or use parseMarkdown() instead.
 *
 * @param content - Markdown content to parse
 * @returns HTML string
 * @throws Error if marked is not loaded yet
 */
export function parseMarkdownSync(content: string): string {
  if (!cachedMarked) {
    throw new Error('Marked not loaded. Call getMarked() first or use parseMarkdown().');
  }
  return cachedMarked.parse(content, { async: false }) as string;
}

/**
 * Check if marked is loaded
 */
export function isMarkedLoaded(): boolean {
  return cachedMarked !== null;
}
