import { Role } from '@yorga/contracts';

export { Role };

/** Usuario del sistema (incluye el hash de contraseña; nunca sale del dominio/infra). */
export interface User {
  id: number;
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  active: boolean;
}
