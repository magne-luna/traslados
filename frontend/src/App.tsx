import { RouterProvider } from 'react-router';
import { AuthProvider } from './shared/auth/AuthContext';
import { router } from './app/router';

// Punto de composición de la app: AuthProvider (sesión mock en memoria) envolviendo el
// RouterProvider (createBrowserRouter). DesignSystem ya no es el home, ver src/app/router.tsx.
function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

export default App;
