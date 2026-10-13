import { Injectable } from '@nestjs/common';
import type { AlmacenConfigCorreo, ConfigCorreo, Proveedor } from '@modulos/correo';
import { PrismaService } from '../../infrastructure/db/prisma.service';

/** Configuración del correo en la tabla `mail_config` (una fila por propietario). */
@Injectable()
export class PrismaAlmacenConfigCorreo implements AlmacenConfigCorreo {
  constructor(private readonly prisma: PrismaService) {}

  async leer(owner: string): Promise<ConfigCorreo | null> {
    const r = await this.prisma.mailConfig.findUnique({ where: { owner } });
    if (!r) return null;
    return {
      proveedor: r.provider as Proveedor,
      credencialCifrada: r.secretEnc,
      credencialFinal: r.secretLast4,
      remitente: { nombre: r.fromName, email: r.fromEmail },
      responderA: r.replyTo,
      marca: { nombre: r.brandName, url: r.appUrl, pie: r.footer },
      avisosActivos: r.notificationsEnabled,
      avisosDesde: r.notificationsSince,
      actualizadoEn: r.updatedAt,
      actualizadoPor: r.updatedBy,
    };
  }

  async guardar(owner: string, c: ConfigCorreo): Promise<void> {
    const data = {
      provider: c.proveedor,
      secretEnc: c.credencialCifrada,
      secretLast4: c.credencialFinal,
      fromName: c.remitente.nombre,
      fromEmail: c.remitente.email,
      replyTo: c.responderA,
      brandName: c.marca.nombre,
      appUrl: c.marca.url,
      footer: c.marca.pie,
      notificationsEnabled: c.avisosActivos,
      notificationsSince: c.avisosDesde,
      updatedAt: c.actualizadoEn,
      updatedBy: c.actualizadoPor,
    };
    await this.prisma.mailConfig.upsert({ where: { owner }, create: { owner, ...data }, update: data });
  }
}
