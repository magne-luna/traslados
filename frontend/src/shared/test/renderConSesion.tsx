import type { ReactElement } from 'react';
import { render, type RenderResult } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../auth/AuthContext';
import { createMockAuthRepository, type MockAuthRepositoryOptions } from '../lib/auth/mockAuthRepository';
import { crearQueryClientDeTest } from './queryWrapper';

// Helper de tests (design.md D11, tasks.md 5.1): monta AuthProvider con un mockAuthRepository
// configurable, para no tener que reescribir los ~190 tests de dominio existentes — que asumen
// implícitamente "admin con todos los permisos" (comportamiento por defecto acá) — y para que
// los tests nuevos de auth/permisos declaren su escenario explícitamente.
//
// migracion-react-query (tasks.md 1.10): incorpora también el QueryClientProvider, con un cliente
// NUEVO por llamada. Así los 12 archivos que ya usaban este helper quedan cubiertos sin editarlos,
// y sin compartir caché entre tests (design.md §D7, trampa 1). El orden de anidado replica el de
// App.tsx: QueryClientProvider POR ENCIMA de AuthProvider (§D2).
export function renderConSesion(ui: ReactElement, opciones: MockAuthRepositoryOptions = {}): RenderResult {
  const repository = createMockAuthRepository(opciones);
  const queryClient = crearQueryClientDeTest();
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider repository={repository}>{ui}</AuthProvider>
    </QueryClientProvider>,
  );
}
