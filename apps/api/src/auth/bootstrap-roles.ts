import { FEATURES } from '@yorga/contracts';
import { PrismaService } from '../infrastructure/db/prisma.service';

/**
 * Roles de sistema. `admin` tiene TODAS las features (y se le añaden las nuevas que aparezcan en el
 * catálogo al actualizar); `miembro` ve y edita tareas. Idempotente: corre en cada arranque.
 */
export async function bootstrapRoles(prisma: PrismaService): Promise<string> {
  const admin = await prisma.role.findUnique({ where: { key: 'admin' } });
  if (!admin) {
    await prisma.role.create({ data: { key: 'admin', name: 'Administrador', features: [...FEATURES], system: true } });
  } else {
    const faltan = FEATURES.filter((f) => !admin.features.includes(f));
    if (faltan.length > 0) {
      await prisma.role.update({ where: { key: 'admin' }, data: { features: [...admin.features, ...faltan], system: true } });
    }
  }
  const miembro = await prisma.role.findUnique({ where: { key: 'miembro' } });
  if (!miembro) {
    await prisma.role.create({ data: { key: 'miembro', name: 'Miembro del equipo', features: ['tareas.ver', 'tareas.editar'], system: true } });
  }
  return 'roles de sistema comprobados (admin, miembro)';
}
