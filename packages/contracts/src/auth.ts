import { Feature } from './permissions';

/** Rol de un usuario = la **clave** de un rol gobernable. `miembro` y `admin` son de sistema; se pueden crear más. */
export type Role = string;

/** Usuario tal como lo expone la API (nunca incluye la contraseña). */
export interface UserDto {
  id: number;
  email: string;
  name: string;
  role: Role;
  /** Las features efectivas de ese rol — lo que el front usa para mostrar/ocultar y la API para permitir. */
  features: Feature[];
  active: boolean;
}

/** Referencia mínima a un usuario (asignado, autor…). */
export interface UserRefDto {
  id: number;
  name: string;
  email: string;
}

/** POST /api/users (alta de usuario; feature `usuarios.gestionar`). */
export interface CreateUserRequest {
  email: string;
  name: string;
  password: string;
  role: Role;
}

/** PATCH /api/users/:id (cambiar rol o activar/desactivar). */
export interface UpdateUserRequest {
  role?: Role;
  active?: boolean;
}

/** POST /api/users/:id/reset-password (feature `usuarios.password`). */
export interface ResetPasswordRequest {
  password: string;
}

/** POST /api/auth/login */
export interface LoginRequest {
  email: string;
  password: string;
}

/** POST /api/auth/cambiar-password (el propio usuario cambia su contraseña; exige la actual). */
export interface CambiarPasswordDto {
  actual: string;
  nueva: string;
}

/** Respuesta de login: token JWT + datos del usuario autenticado. */
export interface LoginResponse {
  token: string;
  user: UserDto;
}

/** Token de API personal (para Claude / MCP / scripts). El secreto sólo se enseña al crearlo. */
export interface ApiTokenDto {
  id: number;
  name: string;
  /** Primeros caracteres del token, para reconocerlo en la lista. */
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface CreatedApiTokenDto extends ApiTokenDto {
  /** El token completo. Se muestra UNA vez. */
  token: string;
}
