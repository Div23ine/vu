import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Unmount every React tree between tests so assertions never leak across cases.
afterEach(() => {
  cleanup();
});
