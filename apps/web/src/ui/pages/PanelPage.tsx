import { PanelEquipo } from '../components/PanelEquipo';

/** Panel completo del equipo (dirección): caudal, salud, carga por persona y por proyecto. */
export function PanelPage() {
  return (
    <div className="page page-wide">
      <header className="page-head mb-3">
        <h1 className="h4 mb-1">Panel del equipo</h1>
        <p className="text-secondary mb-0">Todo el equipo · últimos 7 días salvo que se indique.</p>
      </header>
      <PanelEquipo />
    </div>
  );
}
