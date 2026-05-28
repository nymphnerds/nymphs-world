import '@testing-library/jest-dom/vitest';

// Mock localStorage for client-side tests
const localStorageMock = {
  store: new Map(),
  getItem: function (key: string) {
    return this.store.get(key) || null;
  },
  setItem: function (key: string, value: string) {
    this.store.set(key, value);
  },
  removeItem: function (key: string) {
    this.store.delete(key);
  },
  clear: function () {
    this.store.clear();
  },
  get length() {
    return this.store.size;
  },
  key: function (index: number) {
    const keys = Array.from(this.store.keys());
    return keys[index] || null;
  },
};

globalThis.localStorage = localStorageMock as Storage;

// Mock window.location for auth redirect tests
Object.defineProperty(globalThis, 'location', {
  value: {
    href: '',
    reload: () => {},
  },
  writable: true,
});