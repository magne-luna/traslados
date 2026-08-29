import type { ReactElement, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  render,
  renderHook,
  type RenderHookResult,
  type RenderResult,
} from '@testing-library/react';

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

// Privado: el único componente del módulo. No se exporta a propósito — así el archivo exporta solo
// funciones de test y no dispara `react(only-export-components)`.
function envolver(client: QueryClient) {
  return function Envoltorio({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

/** `renderHook` con un `QueryClient` propio. Devuelve además el cliente, para los tests que
 * necesitan invalidar o inspeccionar la caché a mano, o compartirlo entre dos montajes para simular
 * una misma sesión de la app. */
export function renderHookConQuery<Resultado, Props>(
  callback: (props: Props) => Resultado,
  opciones: { initialProps?: Props; client?: QueryClient } = {},
): RenderHookResult<Resultado, Props> & { client: QueryClient } {
  const client = opciones.client ?? crearQueryClientDeTest();
  const resultado = renderHook(callback, {
    initialProps: opciones.initialProps,
    wrapper: envolver(client),
  });
  return { ...resultado, client };
}

/** `render` de RTL dentro de un `QueryClientProvider` con cliente propio. Es el reemplazo directo
 * de `render(...)` en los tests de componente que montan pantallas con hooks migrados: mismo uso,
 * mismo retorno, más el provider que React Query exige. Un cliente nuevo por llamada (§D7).
 *
 * ⚠️ Usa la opción `wrapper` de RTL, NO `render(<Provider>{ui}</Provider>)`. Con la segunda forma,
 * el `rerender` que devuelve RTL vuelve a montar el elemento nuevo SIN el provider y el test
 * revienta con "No QueryClient set" — un fallo que solo aparece en los tests que usan `rerender`. */
export function renderConQuery(ui: ReactElement, client: QueryClient = crearQueryClientDeTest()): RenderResult {
  return render(ui, { wrapper: envolver(client) });
}
