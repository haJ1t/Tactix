import '@testing-library/jest-dom/vitest';

// Mock IntersectionObserver for jsdom
class MockIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}

// In-memory localStorage mock
const storage = new Map<string, string>();

const localStorageMock = {
    getItem: (key: string) => (storage.has(key) ? storage.get(key)! : null),
    setItem: (key: string, value: string) => {
        storage.set(key, value);
    },
    removeItem: (key: string) => {
        storage.delete(key);
    },
    clear: () => {
        storage.clear();
    },
};

Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: MockIntersectionObserver,
});

Object.defineProperty(globalThis, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: MockIntersectionObserver,
});

Object.defineProperty(window, 'localStorage', {
    writable: true,
    configurable: true,
    value: localStorageMock,
});
