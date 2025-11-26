/**
 * Test setup file
 */

import React from 'react';
import { expect } from 'vitest';
import '@testing-library/jest-dom';

// Make React available globally for components that don't import it explicitly
(global as any).React = React;

// Only apply browser polyfills if window exists (jsdom environment)
if (typeof window !== 'undefined') {
  // Polyfill for window.matchMedia (required by Tamagui)
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
}

// Mock IntersectionObserver (required by some components)
if (typeof global !== 'undefined') {
  global.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    disconnect() {}
    observe() {}
    takeRecords() {
      return [];
    }
    unobserve() {}
  } as any;

  // Mock ResizeObserver (required by React Flow)
  global.ResizeObserver = class ResizeObserver {
    constructor() {}
    disconnect() {}
    observe() {}
    unobserve() {}
  } as any;
}

