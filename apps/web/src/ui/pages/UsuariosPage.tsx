import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Alert, Badge, Button, Card, Form, Spinner } from 'react-bootstrap';
import { KeyFill, ListCheck, PersonPlus } from 'react-bootstrap-icons';
import { Link } from 'react-router-dom';
import type { RoleDto, UserDto } from '@yorga/contracts';
import { rolesGateway, usersGateway } from '../composition';
import { useAuth } from '../auth/AuthContext';
import { Column, DataTable, useMemoryTable } from '../components/table';

export function UsuariosPage() {
  const { user: me, hasFeature } = useAuth();
  const [users, setUsers] = useState<UserDto[]>([]);
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');
  const [creating, setCreating] = useState(false);

  const activos = useMemo(() => roles.filter((r) => r.active), [roles]);
  const roleName = (key: string) => roles.find((r) => r.key === key)?.name ?? key;

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([usersGateway.list(), rolesGateway.list()])
      .then(([us, rs]) => {
        setUsers(us);
        setRoles(rs);
        setRole((cur) => cur || rs.find((r) => r.key === 'miembro')?.key || rs.find((r) => r.active)?.key || '');
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    setCreating(true);
    try {
      const u = await usersGateway.create({ email, name, password, role });
      setNotice(`Usuario ${u.email} creado.`);
      setEmail('');
      setName('');
      setPassword('');
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function patch(id: number, data: { role?: string; active?: boolean }, ok: string) {
    setError('');
    setNotice('');
    setBusyId(id);
    try {
      await usersGateway.update(id, data);
      setNotice(ok);
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function resetPassword(u: UserDto) {
    const pwd = window.prompt(`Nueva contraseña para ${u.email} (mínimo 6 caracteres):`);
    if (pwd == null) return;
    if (pwd.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setBusyId(u.id);
    try {
      await usersGateway.resetearPassword(u.id, pwd);
      setNotice(`Contraseña de ${u.email} actualizada.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  const columns = useMemo<Column<UserDto>[]>(
    () => [
      { key: 'name', label: 'nombre', value: (u) => u.name, render: (u) => <>{u.name} {u.id === me?.id && <span className="text-secondary small">(tú)</span>}</> },
      { key: 'email', label: 'email', value: (u) => u.email },
      { key: 'role', label: 'rol', value: (u) => u.role, render: (u) => <Badge bg={u.role === 'admin' ? 'primary' : 'secondary'}>{roleName(u.role)}</Badge> },
      {
        key: 'active',
        label: 'estado',
        value: (u) => (u.active ? 'activo' : 'inactivo'),
        render: (u) => (u.active ? <Badge bg="success-subtle" text="success">activo</Badge> : <Badge bg="secondary-subtle" text="secondary">inactivo</Badge>),
      },
      {
        key: 'acciones',
        label: 'acciones',
        align: 'end',
        sortable: false,
        filter: 'none',
        value: () => '',
        render: (u) => {
          const isMe = u.id === me?.id;
          const busy = busyId === u.id;
          return (
            <div className="d-inline-flex gap-2 align-items-center">
              <Link to={`/equipo/${u.id}`} className="btn btn-sm btn-outline-secondary" title={`Tareas de ${u.name}`}><ListCheck /></Link>
              <Form.Select size="sm" style={{ width: 'auto' }} value={u.role} disabled={busy || isMe} aria-label={`Rol de ${u.email}`} onChange={(e) => patch(u.id, { role: e.target.value }, `${u.email} ahora es ${roleName(e.target.value)}.`)}>
                {activos.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
                {!activos.some((r) => r.key === u.role) && <option value={u.role}>{roleName(u.role)}</option>}
              </Form.Select>
              {hasFeature('usuarios.password') && (
                <Button size="sm" variant="outline-secondary" disabled={busy} title="Resetear contraseña" onClick={() => resetPassword(u)}><KeyFill /></Button>
              )}
              <Button size="sm" variant={u.active ? 'outline-danger' : 'outline-success'} disabled={busy || isMe} onClick={() => patch(u.id, { active: !u.active }, `${u.email} ${u.active ? 'desactivado' : 'activado'}.`)}>
                {u.active ? 'desactivar' : 'activar'}
              </Button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [me?.id, busyId, roles, hasFeature],
  );

  const tabla = useMemoryTable(users, columns);

  return (
    <div className="page page-wide">
      <header className="page-head mb-4">
        <h1 className="h4 mb-1">Usuarios</h1>
        <p className="text-secondary mb-0">Da de alta y gestiona quién accede.</p>
      </header>

      {error && <Alert variant="danger" onClose={() => setError('')} dismissible>⚠ {error}</Alert>}
      {notice && <Alert variant="success" onClose={() => setNotice('')} dismissible>{notice}</Alert>}

      <Card className="mb-4">
        <Card.Body className="p-4">
          <Card.Title className="mb-3">Nuevo usuario</Card.Title>
          <Form onSubmit={onCreate}>
            <div className="row g-3 align-items-end">
              <div className="col-md-3">
                <Form.Label className="small">Nombre</Form.Label>
                <Form.Control id="u-name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="col-md-3">
                <Form.Label className="small">Email</Form.Label>
                <Form.Control id="u-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="col-md-3">
                <Form.Label className="small">Contraseña</Form.Label>
                <Form.Control id="u-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
              </div>
              <div className="col-md-2">
                <Form.Label className="small">Rol</Form.Label>
                <Form.Select id="u-role" value={role} onChange={(e) => setRole(e.target.value)} required>
                  {activos.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-1">
                <Button type="submit" className="btn-brand w-100" disabled={creating} title="Crear usuario">
                  {creating ? <Spinner as="span" size="sm" animation="border" /> : <PersonPlus />}
                </Button>
              </div>
            </div>
          </Form>
        </Card.Body>
      </Card>

      <Card>
        <Card.Body className="p-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <Card.Title className="mb-0">Usuarios ({users.length})</Card.Title>
            {loading && <Spinner as="span" size="sm" animation="border" />}
          </div>
          <DataTable model={tabla} allRows={users} rowKey={(u) => String(u.id)} empty="Ningún usuario cumple el filtro." />
        </Card.Body>
      </Card>
    </div>
  );
}
