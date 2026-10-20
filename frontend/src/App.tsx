import { RouterProvider } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './shared/auth/AuthContext';
import { supabaseAuthRepository } from './shared/lib/auth/SupabaseAuthRepository';
import { queryClient } from './app/queryClient';
import { router } from './app/router';
import { supabase } from './shared/lib/supabaseClient';
import { crearCanalSupabase } from './shared/lib/realtime/canalSupabase';
import { SincronizacionRealtime } from './shared/lib/realtime/SincronizacionRealtime';

// Identidad estable (constante de módulo): el hook re-suscribe si cambia.
const crearCanalProduccion = () => crearCanalSupabase(supabase);

// Punto de composición de la app: QueryClientProvider > AuthProvider > RouterProvider
// (createBrowserRouter). Único lugar de producción que conoce supabaseAuthRepository
// (auth-frontend-real, design.md D1) — los tests inyectan createMockAuthRepository(...) en su
// lugar (ver renderConSesion). DesignSystem ya no es el home, ver src/app/router.tsx.
//
// migracion-react-query (design.md §D2): el QueryClientProvider va POR ENCIMA de AuthProvider, no
// debajo. El cierre de sesión tiene que poder llamar `queryClient.clear()`; si el cliente viviera
// dentro del árbol de auth, se desmontaría junto con él justo cuando hace falta vaciarlo.
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider repository={supabaseAuthRepository}>
        <SincronizacionRealtime crearCanal={crearCanalProduccion} />
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
