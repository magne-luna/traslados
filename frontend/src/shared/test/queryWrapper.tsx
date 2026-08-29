import type { ReactElement, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, type RenderHookResult } from '@testing-library/react';

// Infraestructura de tests para React Query (design.md §D7). Previene las tres trampas conocidas,
// una sola vez, en vez de test por test:
//
//   1. QueryClient compartido entre tests ⇒ polución de caché ⇒ fallos que dependen del orden de
//      ejecución. Es el peor tipo de fallo: intermitente y no reproducible aislado.
//   2. Sin `retry: false`, un test que verifica un estado de error se queda esperando los
//      reintentos y CUELGA hasta el timeout.
//   3. `gcTime` por defecto deja datos vivos tras el desmontaje dentro del mismo test.
//
// Regla: una instancia NUEVA por test, siempre. Nunca importar `queryClient` de producción acá.

export function crearQueryClientDeTest(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}

/** Envuelve `children` en un `QueryClientProvider` con un cliente nuevo. Útil como `wrapper` de
 * `render`/`renderHook` cuando el test necesita quedarse con la referencia al cliente. */
export function ProveedorDeQuery({ client, children }: { client: QueryClient; children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** `renderHook` con un `QueryClient` propio. Devuelve además el cliente, para los tests que
 * necesitan invalidar o inspeccionar la caché a mano. */
export function renderHookConQuery<Resultado, Props>(
  callback: (props: Props) => Resultado,
  opciones: { initialProps?: Props; client?: QueryClient } = {},
): RenderHookResult<Resultado, Props> & { client: QueryClient } {
  const client = opciones.client ?? crearQueryClientDeTest();
  const resultado = renderHook(callback, {
    initialProps: opciones.initialProps,
    wrapper: ({ children }) => <ProveedorDeQuery client={client}>{children}</ProveedorDeQuery>,
  });
  return { ...resultado, client };
}

/** Envoltorio para pasar como `wrapper` a `render` de RTL en tests de componente. */
export function envoltorioDeQuery(client: QueryClient = crearQueryClientDeTest()) {
  return function Envoltorio({ children }: { children: ReactNode }) {
    return <ProveedorDeQuery client={client}>{children}</ProveedorDeQuery>;
  };
}

/** Render de un elemento suelto dentro de un `QueryClientProvider` nuevo. */
export function elementoConQuery(ui: ReactElement, client: QueryClient = crearQueryClientDeTest()): ReactElement {
  return <ProveedorDeQuery client={client}>{ui}</ProveedorDeQuery>;
}
