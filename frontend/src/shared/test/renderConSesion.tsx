import type { ReactElement } from 'react';
import { render, type RenderResult } from '@testing-library/react';
import { AuthProvider } from '../auth/AuthContext';
import { createMockAuthRepository, type MockAuthRepositoryOptions } from '../lib/auth/mockAuthRepository';

// Helper de tests (design.md D11, tasks.md 5.1): monta AuthProvider con un mockAuthRepository
// configurable, para no tener que reescribir los ~190 tests de dominio existentes — que asumen
// implícitamente "admin con todos los permisos" (comportamiento por defecto acá) — y para que
// los tests nuevos de auth/permisos declaren su escenario explícitamente.
export function renderConSesion(ui: ReactElement, opciones: MockAuthRepositoryOptions = {}): RenderResult {
  const repository = createMockAuthRepository(opciones);
  return render(<AuthProvider repository={repository}>{ui}</AuthProvider>);
}
