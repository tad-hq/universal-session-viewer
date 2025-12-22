// Debounce utility for search input
// V1 Reference: index.html lines 1033-1045 (search debouncing)
//
// V1 Pattern: 300ms debounce prevents excessive API calls during typing
// This is a simple debounce implementation - no external dependencies needed

/**
 * Creates a debounced function that delays invoking the provided function
 * until after the specified wait time has elapsed since the last call.
 *
 * @param fn - The function to debounce
 * @param delay - The number of milliseconds to delay (default: 300ms per V1)
 * @returns A debounced version of the function with a cancel method
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number = 300
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = ((...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  }) as T & { cancel: () => void };

  // Allow cancelling pending invocations
  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}
