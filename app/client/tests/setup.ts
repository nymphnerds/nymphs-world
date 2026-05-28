import '@testing-library/jest-dom';

// Mock window.matchMedia (used by some components for responsive behavior)
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
    dispatchEvent: () => false,
  }),
});

// Mock window.confirm / window.prompt for dialog components
window.confirm = () => true;
window.prompt = () => null;

// Suppress React 19+ "startTransition" warnings in Testing Library
// (Not needed for React 18, but future-proof)