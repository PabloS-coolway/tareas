import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/db/prisma.service';
import { Role, User } from '../domain/user';
import { UserRepository } from '../application/ports';

/** Adapter: usuarios en Postgres vía Prisma. */
@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  create(input: { email: string; name: string; passwordHash: string; role: Role }, tx?: Prisma.TransactionClient): Promise<User> {
    return (tx ?? this.prisma).user.create({ data: input });
  }

  update(id: number, data: { role?: Role; active?: boolean; passwordHash?: string }, tx?: Prisma.TransactionClient): Promise<User> {
    return (tx ?? this.prisma).user.update({ where: { id }, data });
  }

  list(): Promise<User[]> {
    return this.prisma.user.findMany({ orderBy: [{ active: 'desc' }, { name: 'asc' }] });
  }

  count(): Promise<number> {
    return this.prisma.user.count();
  }
}
