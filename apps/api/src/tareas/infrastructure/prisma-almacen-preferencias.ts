import { Injectable } from '@nestjs/common';
import type { AlmacenPreferencias, ModoAmbitos, ModoEnvio, PreferenciasCorreo, PreferenciasGuardadas } from '@modulos/correo';
import type { Priority } from '@yorga/contracts';
import { PrismaService } from '../../infrastructure/db/prisma.service';
import { ESCALA_PRIORIDAD, nivelDePrioridad } from '../domain/avisos-correo';

/** Preferencias de correo en `email_pref` (una fila por persona, solo si cambió algo). Ámbito = proyecto; nivel = prioridad. */
@Injectable()
export class PrismaAlmacenPreferencias implements AlmacenPreferencias {
  constructor(private readonly prisma: PrismaService) {}

  async leer(persona: string | number): Promise<PreferenciasGuardadas | null> {
    const r = await this.prisma.emailPref.findUnique({ where: { userId: Number(persona) } });
    return r ? { preferencias: aPreferencias(r), ultimoResumen: r.lastDigestAt } : null;
  }

  async guardar(persona: string | number, p: PreferenciasCorreo): Promise<void> {
    const data = {
      enabled: p.activo,
      types: p.tipos,
      projectMode: p.ambitos.modo,
      projectIds: p.ambitos.ids.map(Number),
      minPriority: p.nivelMinimo === null ? null : ESCALA_PRIORIDAD[p.nivelMinimo],
      mode: p.modo,
    };
    await this.prisma.emailPref.upsert({ where: { userId: Number(persona) }, create: { userId: Number(persona), ...data }, update: data });
  }

  async marcarResumen(persona: string | number, cuando: Date): Promise<void> {
    await this.prisma.emailPref.update({ where: { userId: Number(persona) }, data: { lastDigestAt: cuando } });
  }
}

export function aPreferencias(r: { enabled: boolean; types: string[]; projectMode: string; projectIds: number[]; minPriority: string | null; mode: string }): PreferenciasCorreo {
  return {
    activo: r.enabled,
    tipos: r.types,
    ambitos: { modo: r.projectMode as ModoAmbitos, ids: r.projectIds },
    nivelMinimo: r.minPriority ? nivelDePrioridad(r.minPriority as Priority) : null,
    modo: r.mode as ModoEnvio,
  };
}
