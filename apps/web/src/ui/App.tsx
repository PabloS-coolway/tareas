import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './layout/AppShell';
import { InicioPage } from './pages/InicioPage';
import { LoginPage } from './pages/LoginPage';
import { OlvidePage } from './pages/OlvidePage';
import { RestablecerPage } from './pages/RestablecerPage';
import { UsuariosPage } from './pages/UsuariosPage';
import { RolesPage } from './pages/RolesPage';
import { EquiposPage } from './pages/EquiposPage';
import { ProyectosPage } from './pages/ProyectosPage';
import { TableroPage } from './pages/TableroPage';
import { TareaPage } from './pages/TareaPage';
import { MisTareasPage } from './pages/MisTareasPage';
import { EquipoPage } from './pages/EquipoPage';
import { CalendarioPage } from './pages/CalendarioPage';
import { TodasTareasPage } from './pages/TodasTareasPage';
import { SprintsPage } from './pages/SprintsPage';
import { SprintPage } from './pages/SprintPage';
import { BacklogPage } from './pages/BacklogPage';
import { AvisosPage } from './pages/AvisosPage';
import { ActividadPage } from './pages/ActividadPage';
import { PanelPage } from './pages/PanelPage';
import { IntegracionesPage } from './pages/IntegracionesPage';
import { PlantillasPage } from './pages/PlantillasPage';
import { TokensPage } from './pages/TokensPage';
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth, RequireFeature } from './auth/RequireAuth';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/olvide" element={<OlvidePage />} />
          <Route path="/restablecer" element={<RestablecerPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route index element={<Navigate to="/inicio" replace />} />
              <Route path="/inicio" element={<InicioPage />} />
              <Route path="/mis-tareas" element={<MisTareasPage />} />
              <Route path="/equipo" element={<EquipoPage />} />
              <Route path="/equipo/:userId" element={<EquipoPage />} />
              <Route path="/proyectos" element={<ProyectosPage />} />
              <Route path="/tareas" element={<TodasTareasPage />} />
              <Route path="/calendario" element={<CalendarioPage />} />
              <Route path="/sprints" element={<SprintsPage />} />
              <Route path="/sprints/:id" element={<SprintPage />} />
              <Route path="/backlog" element={<BacklogPage />} />
              <Route path="/avisos" element={<AvisosPage />} />
              <Route path="/actividad" element={<ActividadPage />} />
              <Route path="/panel" element={<PanelPage />} />
              <Route path="/plantillas" element={<PlantillasPage />} />
              <Route path="/p/:key" element={<TableroPage />} />
              <Route path="/t/:key" element={<TareaPage />} />
              <Route path="/tokens" element={<TokensPage />} />
              <Route element={<RequireFeature feature="usuarios.gestionar" />}>
                <Route path="/usuarios" element={<UsuariosPage />} />
                <Route path="/integraciones" element={<IntegracionesPage />} />
              </Route>
              <Route element={<RequireFeature feature="equipos.gestionar" />}>
                <Route path="/equipos" element={<EquiposPage />} />
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
