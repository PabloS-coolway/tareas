import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Feature } from '@yorga/contracts';
import { PrismaService } from '../../infrastructure/db/prisma.service';
import { RoleRecord, RoleRepository } from '../application/role.port';

/** Adapter: roles en Postgres vía Prisma. Las features se guardan como texto[]; el dominio las tipa. */
@Injectable()
export class PrismaRoleRepository implements RoleRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toRecord(r: { id: number; key: string; name: string; features: string[]; active: boolean; system: boolean }): RoleRecord {
    return { ...r, features: r.features as Feature[] };
  }

  async findByKey(key: string): Promise<RoleRecord | null> {
    const r = await this.prisma.role.findUnique({ where: { key } });
    return r ? this.toRecord(r) : null;
  }

  async findById(id: number): Promise<RoleRecord | null> {
    const r = await this.prisma.role.findUnique({ where: { id } });
    return r ? this.toRecord(r) : null;
  }

  async findAll(): Promise<RoleRecord[]> {
    const rs = await this.prisma.role.findMany({ orderBy: [{ active: 'desc' }, { key: 'asc' }] });
    return rs.map((r) => this.toRecord(r));
  }

  async featuresOf(key: string): Promise<Feature[]> {
    const r = await this.prisma.role.findUnique({ where: { key } });
    return r && r.active ? (r.features as Feature[]) : [];
  }

  async create(input: { key: string; name: string; features: Feature[] }, tx?: Prisma.TransactionClient): Promise<RoleRecord> {
    return this.toRecord(await (tx ?? this.prisma).role.create({ data: { ...input, active: true, system: false } }));
  }

  async update(id: number, data: Partial<{ name: string; features: Feature[]; active: boolean }>, tx?: Prisma.TransactionClient): Promise<RoleRecord> {
    return this.toRecord(await (tx ?? this.prisma).role.update({ where: { id }, data }));
  }
}
