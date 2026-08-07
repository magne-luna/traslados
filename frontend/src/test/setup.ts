import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// vitest no limpia el DOM entre tests automáticamente salvo que `test.globals: true`
// esté seteado (no lo está, para no ensuciar el scope global) — se limpia explícito acá.
afterEach(() => {
  cleanup();
});

// pdfjs-dist ejecuta `new DOMMatrix()` a nivel de módulo (necesario para su motor de canvas real),
// y jsdom no implementa `DOMMatrix` — cualquier test que importe transitivamente `PdfPreview.tsx`
// (vía `DocumentChecklist`, en los 4 dominios documentales) rompe al cargar el módulo, incluso sin
// renderizar el preview. Se mockea acá globalmente con el mismo shape que ya usa
// `PdfPreview.test.tsx` localmente — ese archivo sobreescribe este mock con sus propios fakes de
// `getDocument` cuando necesita comportamiento real de PDF.
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}));
