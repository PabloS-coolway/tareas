import { Prisma } from '@prisma/client';
import { Role, User } from '../domain/user';

/** Puerto de salida: persistencia de usuarios. `tx` permite escribir dentro de una transacción. */
export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: number): Promise<User | null>;
  create(input: { email: string; name: string; passwordHash: string; role: Role }, tx?: Prisma.TransactionClient): Promise<User>;
  update(id: number, data: { role?: Role; active?: boolean; passwordHash?: string }, tx?: Prisma.TransactionClient): Promise<User>;
  list(): Promise<User[]>;
  count(): Promise<number>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

/** Puerto de salida: hash y verificación de contraseñas. */
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  compare(plain: string, hash: string): Promise<boolean>;
}

export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
