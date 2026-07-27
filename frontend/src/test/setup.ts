import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// vitest no limpia el DOM entre tests automáticamente salvo que `test.globals: true`
// esté seteado (no lo está, para no ensuciar el scope global) — se limpia explícito acá.
afterEach(() => {
  cleanup();
});
