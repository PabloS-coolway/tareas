import { Prisma } from '@prisma/client';
import { Feature } from '@yorga/contracts';

export const ROLE_REPOSITORY = Symbol('ROLE_REPOSITORY');

/** Un rol tal como vive en la BD (REQ-006). Las features son un subconjunto del catálogo cerrado. */
export interface RoleRecord {
  id: number;
  key: string;
  name: string;
  features: Feature[];
  active: boolean;
  system: boolean;
}

/** Puerto: catálogo de roles (Postgres). La app es su dueña. */
export interface RoleRepository {
  findByKey(key: string): Promise<RoleRecord | null>;
  findById(id: number): Promise<RoleRecord | null>;
  findAll(): Promise<RoleRecord[]>;
  /**
   * Las features EFECTIVAS de un rol: lo que decide qué puede hacer un usuario. Un rol inexistente o
   * **inactivo** no da ninguna feature (desactivar un rol deja a sus usuarios sin permisos — deliberado).
   */
  featuresOf(key: string): Promise<Feature[]>;
  create(input: { key: string; name: string; features: Feature[] }, tx?: Prisma.TransactionClient): Promise<RoleRecord>;
  update(id: number, data: Partial<{ name: string; features: Feature[]; active: boolean }>, tx?: Prisma.TransactionClient): Promise<RoleRecord>;
}
