import { RouterProvider } from 'react-router';
import { AuthProvider } from './shared/auth/AuthContext';
import { supabaseAuthRepository } from './shared/lib/auth/SupabaseAuthRepository';
import { router } from './app/router';

// Punto de composición de la app: AuthProvider envolviendo el RouterProvider
// (createBrowserRouter). Único lugar de producción que conoce supabaseAuthRepository
// (auth-frontend-real, design.md D1) — los tests inyectan createMockAuthRepository(...) en su
// lugar (ver renderConSesion). DesignSystem ya no es el home, ver src/app/router.tsx.
function App() {
  return (
    <AuthProvider repository={supabaseAuthRepository}>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

export default App;
