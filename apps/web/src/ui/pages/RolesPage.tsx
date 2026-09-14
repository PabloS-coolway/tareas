import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Alert, Badge, Button, Card, Form, Modal, Spinner } from 'react-bootstrap';
import { PencilFill, PlusLg } from 'react-bootstrap-icons';
import { FEATURES, FEATURE_LABELS, type Feature, type RoleDto } from '@yorga/contracts';
import { rolesGateway } from '../composition';
import { Column, DataTable, useMemoryTable } from '../components/table';

const VACIO = { key: '', name: '', features: [] as Feature[] };

/**
 * REQ-006 · Roles. Antes «quién puede qué» estaba clavado en el código; aquí se gobierna desde el panel.
 * Dos límites que no son negociables: las **features son un catálogo cerrado** (checkboxes, no texto libre)
 * y **no se puede uno tapiar fuera** — la API rechaza dejar el sistema sin ningún rol que gestione roles.
 */
export function RolesPage() {
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<RoleDto | null>(null);
  const [form, setForm] = useState(VACIO);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    rolesGateway
      .list()
      .then(setRoles)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  function abrirNuevo() {
    setEditando(null);
    setForm(VACIO);
    setFormError('');
    setAbierto(true);
  }

  function abrirEdicion(r: RoleDto) {
    setEditando(r);
    setForm({ key: r.key, name: r.name, features: [...r.features] });
    setFormError('');
    setAbierto(true);
  }

  function cerrar() {
    setAbierto(false);
    setEditando(null);
    setForm(VACIO);
  }

  function toggleFeature(f: Feature) {
    setForm((s) => ({ ...s, features: s.features.includes(f) ? s.features.filter((x) => x !== f) : [...s.features, f] }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    setNotice('');
    setSaving(true);
    try {
      if (editando) {
        await rolesGateway.update(editando.id, { name: form.name, features: form.features });
        setNotice(`Rol ${editando.key} actualizado.`);
      } else {
        const r = await rolesGateway.create({ key: form.key, name: form.name, features: form.features });
        setNotice(`Rol ${r.key} creado.`);
      }
      cerrar();
      load();
    } catch (err) {
      // El modal se queda abierto con lo escrito (incluido el aviso anti-bloqueo de la API).
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActivo(r: RoleDto) {
    setError('');
    setNotice('');
    setBusyId(r.id);
    try {
      await rolesGateway.update(r.id, { active: !r.active });
      setNotice(`${r.key} ${r.active ? 'desactivado' : 'activado'}.`);
      load();
    } catch (err) {
      // Aquí cae el anti-bloqueo si intentas desactivar el último rol que gestiona roles.
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  const columns = useMemo<Column<RoleDto>[]>(
    () => [
      {
        key: 'key',
        label: 'código',
        value: (r) => r.key,
        render: (r) => (
          <>
            <code>{r.key}</code> {r.system && <Badge bg="secondary-subtle" text="secondary">sistema</Badge>}
          </>
        ),
      },
      { key: 'name', label: 'nombre', value: (r) => r.name },
      {
        key: 'features',
        label: 'permisos',
        value: (r) => r.features.length,
        render: (r) =>
          r.features.length ? (
            <div className="d-flex flex-wrap gap-1">
              {r.features.map((f) => (
                <span key={f} className="variant-badge">{FEATURE_LABELS[f]}</span>
              ))}
            </div>
          ) : (
            <span className="text-secondary small">sin permisos</span>
          ),
      },
      {
        key: 'active',
        label: 'estado',
        value: (r) => (r.active ? 'activo' : 'inactivo'),
        render: (r) =>
          r.active ? (
            <Badge bg="success-subtle" text="success">activo</Badge>
          ) : (
            <Badge bg="secondary-subtle" text="secondary">inactivo</Badge>
          ),
      },
      {
        key: 'acciones',
        label: 'acciones',
        align: 'end',
        sortable: false,
        filter: 'none',
        value: () => '',
        render: (r) => (
          <div className="d-inline-flex gap-2">
            <Button size="sm" variant="outline-secondary" disabled={busyId === r.id} aria-label={`Editar ${r.key}`} onClick={() => abrirEdicion(r)}>
              <PencilFill className="me-1" />
              editar
            </Button>
            <Button
              size="sm"
              variant={r.active ? 'outline-danger' : 'outline-success'}
              disabled={busyId === r.id}
              aria-label={`${r.active ? 'Desactivar' : 'Activar'} ${r.key}`}
              onClick={() => toggleActivo(r)}
            >
              {r.active ? 'desactivar' : 'activar'}
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busyId],
  );

  const tabla = useMemoryTable(roles, columns);

  return (
    <div className="page page-wide">
      <header className="page-head mb-4 d-flex justify-content-between align-items-start gap-3">
        <div>
          <h1 className="h4 mb-1">Roles</h1>
          <p className="text-secondary mb-0">
            Qué puede hacer cada rol. Marca los permisos con checkboxes; los usuarios ven y usan sólo lo que
            su rol permite.
          </p>
        </div>
        <Button className="btn-brand flex-shrink-0" onClick={abrirNuevo}>
          <PlusLg className="me-1" />
          Nuevo rol
        </Button>
      </header>

      {error && <Alert variant="danger" onClose={() => setError('')} dismissible>⚠ {error}</Alert>}
      {notice && <Alert variant="success" onClose={() => setNotice('')} dismissible>{notice}</Alert>}

      <Card>
        <Card.Body className="p-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <Card.Title className="mb-0">Roles ({roles.length})</Card.Title>
            {loading && <Spinner as="span" size="sm" animation="border" />}
          </div>
          <DataTable model={tabla} allRows={roles} rowKey={(r) => String(r.id)} empty="Ningún rol cumple el filtro." />
        </Card.Body>
      </Card>

      <Modal show={abierto} onHide={cerrar} centered backdrop="static">
        <Form onSubmit={onSubmit}>
          <Modal.Header closeButton>
            <Modal.Title className="h5">{editando ? `Editar rol ${editando.key}` : 'Nuevo rol'}</Modal.Title>
          </Modal.Header>

          <Modal.Body>
            {formError && <Alert variant="danger" className="py-2">⚠ {formError}</Alert>}

            <div className="row g-3">
              <div className="col-5">
                <Form.Label className="small" htmlFor="r-key">Código</Form.Label>
                <Form.Control
                  id="r-key"
                  value={form.key}
                  onChange={(e) => setForm({ ...form, key: e.target.value.toLowerCase() })}
                  placeholder="contable"
                  // El código es la identidad del rol: no se cambia al editar.
                  disabled={!!editando}
                  autoFocus={!editando}
                  required
                />
                {editando && <Form.Text muted>El código no se cambia: es la identidad del rol.</Form.Text>}
              </div>
              <div className="col-7">
                <Form.Label className="small" htmlFor="r-name">Nombre</Form.Label>
                <Form.Control
                  id="r-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Contable"
                  autoFocus={!!editando}
                  required
                />
              </div>

              <div className="col-12">
                <Form.Label className="small d-block mb-2">Permisos</Form.Label>
                <div className="d-flex flex-column gap-2">
                  {FEATURES.map((f) => (
                    <Form.Check
                      key={f}
                      type="checkbox"
                      id={`feat-${f}`}
                      label={FEATURE_LABELS[f]}
                      checked={form.features.includes(f)}
                      onChange={() => toggleFeature(f)}
                    />
                  ))}
                </div>
                {editando?.system && (
                  <Form.Text muted className="d-block mt-2">
                    Es un rol de sistema: puedes ajustar sus permisos, pero no borrarlo.
                  </Form.Text>
                )}
              </div>
            </div>
          </Modal.Body>

          <Modal.Footer>
            <Button variant="outline-secondary" onClick={cerrar} disabled={saving}>Cancelar</Button>
            <Button type="submit" className="btn-brand" disabled={saving}>
              {saving ? <Spinner as="span" size="sm" animation="border" /> : editando ? 'Guardar cambios' : 'Crear rol'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}
