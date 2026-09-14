import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './layout/AppShell';
import { InicioPage } from './pages/InicioPage';
import { LoginPage } from './pages/LoginPage';
import { UsuariosPage } from './pages/UsuariosPage';
import { RolesPage } from './pages/RolesPage';
import { ProyectosPage } from './pages/ProyectosPage';
import { TableroPage } from './pages/TableroPage';
import { TareaPage } from './pages/TareaPage';
import { MisTareasPage } from './pages/MisTareasPage';
import { TokensPage } from './pages/TokensPage';
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth, RequireFeature } from './auth/RequireAuth';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route index element={<Navigate to="/inicio" replace />} />
              <Route path="/inicio" element={<InicioPage />} />
              <Route path="/mis-tareas" element={<MisTareasPage />} />
              <Route path="/proyectos" element={<ProyectosPage />} />
              <Route path="/p/:key" element={<TableroPage />} />
              <Route path="/t/:key" element={<TareaPage />} />
              <Route path="/tokens" element={<TokensPage />} />
              <Route element={<RequireFeature feature="usuarios.gestionar" />}>
                <Route path="/usuarios" element={<UsuariosPage />} />
              </Route>
              <Route element={<RequireFeature feature="roles.gestionar" />}>
                <Route path="/roles" element={<RolesPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/inicio" replace />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
