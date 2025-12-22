import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {
  createMockElectronAPI,
  resetAllMocks,
  type MockElectronAPI,
} from './mocks/electronAPI';

declare global {
  // eslint-disable-next-line no-var
  var mockElectronAPI: MockElectronAPI;
}

let mockAPI: MockElectronAPI;

beforeEach(() => {
  mockAPI = createMockElectronAPI();
  globalThis.mockElectronAPI = mockAPI;

  Object.defineProperty(window, 'electronAPI', {
    value: mockAPI,
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  resetAllMocks();
  vi.clearAllMocks();
  vi.useRealTimers();
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: MockResizeObserver,
});

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];

  private callback: IntersectionObserverCallback;
  private static instances: MockIntersectionObserver[] = [];

  constructor(callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn().mockReturnValue([]);

  triggerIntersection(isIntersecting: boolean): void {
    const entries: IntersectionObserverEntry[] = [
      {
        isIntersecting,
        boundingClientRect: {} as DOMRectReadOnly,
        intersectionRatio: isIntersecting ? 1 : 0,
        intersectionRect: {} as DOMRectReadOnly,
        rootBounds: null,
        target: document.createElement('div'),
        time: Date.now(),
      },
    ];
    this.callback(entries, this);
  }

  static getInstances(): MockIntersectionObserver[] {
    return MockIntersectionObserver.instances;
  }

  static resetInstances(): void {
    MockIntersectionObserver.instances = [];
  }
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: MockIntersectionObserver,
});

afterEach(() => {
  MockIntersectionObserver.resetInstances();
});

Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: vi.fn(),
});

Object.defineProperty(Element.prototype, 'scrollTo', {
  writable: true,
  value: vi.fn(),
});

Object.defineProperty(Element.prototype, 'scrollIntoView', {
  writable: true,
  value: vi.fn(),
});

const originalError = console.error;
beforeEach(() => {
  console.error = (...args: unknown[]) => {
    const message = args[0];
    if (
      typeof message === 'string' &&
      (message.includes('Warning: ReactDOM.render') ||
        message.includes('Warning: An update to') ||
        message.includes('act(...)'))
    ) {
      return;
    }
    originalError.apply(console, args);
  };
});

afterEach(() => {
  console.error = originalError;
});

export async function flushPromises(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

export async function advanceTimersAndFlush(ms: number): Promise<void> {
  vi.advanceTimersByTime(ms);
  await flushPromises();
}

export function getMockElectronAPI(): MockElectronAPI {
  return globalThis.mockElectronAPI;
}

export function triggerAllIntersectionObservers(isIntersecting: boolean): void {
  const instances = MockIntersectionObserver.getInstances();
  instances.forEach((instance) => {
    instance.triggerIntersection(isIntersecting);
  });
}
