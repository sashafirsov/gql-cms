import '@testing-library/jest-dom';

// Mock next/navigation to avoid real router side-effects in tests
jest.mock('next/navigation', () => {
  const actual = jest.requireActual('next/navigation');
  return {
    ...actual,
    useRouter: () => ({
      push: jest.fn(),
      replace: jest.fn(),
      refresh: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      prefetch: jest.fn(),
    }),
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(),
    useParams: () => ({}),
  };
});

// Mock usehooks-ts's useLocalStorage to a simple React state to avoid listeners/timers
jest.mock('usehooks-ts', () => {
  const React = require('react');
  return {
    ...jest.requireActual('usehooks-ts'),
    useLocalStorage: <T,>(key: string, initial: T) => React.useState<T>(initial),
  };
});

afterEach(() => {
  jest.clearAllTimers();
  jest.clearAllMocks();
});
