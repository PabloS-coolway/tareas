import { Injectable } from '@nestjs/common';
import type { ColaCorreo, EstadoEnvio, IdMensaje, MensajeCorreo, MensajeEnCola, RegistroCorreo } from '@modulos/correo';
import { PrismaService } from '../../infrastructure/db/prisma.service';

/**
 * Cola y registro de correos en `mail_message`. Una sola instancia de API la trabaja (instance_count: 1); si se
 * escala, `pendientes` tendría que reservar filas (UPDATE … RETURNING / FOR UPDATE SKIP LOCKED) para no duplicar.
 */
@Injectable()
export class PrismaColaCorreo implements ColaCorreo {
  constructor(private readonly prisma: PrismaService) {}

  async encolar(owner: string, m: MensajeCorreo, cuando: Date): Promise<IdMensaje> {
    const r = await this.prisma.mailMessage.create({ data: { owner, to: m.para, subject: m.asunto, html: m.html, text: m.texto, kind: m.tipo, nextAttemptAt: cuando }, select: { id: true } });
    return r.id;
  }

  async pendientes(ahora: Date, limite: number): Promise<MensajeEnCola[]> {
    const rows = await this.prisma.mailMessage.findMany({ where: { status: 'pendiente', nextAttemptAt: { lte: ahora } }, orderBy: { id: 'asc' }, take: limite });
    return rows.map((r) => ({ id: r.id, propietario: r.owner, para: r.to, asunto: r.subject, html: r.html, texto: r.text, tipo: r.kind, intentos: r.attempts }));
  }

  async marcarEnviado(id: IdMensaje, intentos: number, idProveedor: string | null, cuando: Date): Promise<void> {
    await this.prisma.mailMessage.update({ where: { id: Number(id) }, data: { status: 'enviado', attempts: intentos, providerId: idProveedor, sentAt: cuando, nextAttemptAt: null } });
  }

  async marcarFallo(id: IdMensaje, intentos: number, error: string, proximo: Date | null): Promise<void> {
    await this.prisma.mailMessage.update({ where: { id: Number(id) }, data: { status: proximo ? 'pendiente' : 'fallido', attempts: intentos, lastError: error, nextAttemptAt: proximo } });
  }

  async descartarPendientes(owner: string, prefijoTipo: string, motivo: string): Promise<number> {
    const r = await this.prisma.mailMessage.updateMany({ where: { owner, status: 'pendiente', kind: { startsWith: prefijoTipo } }, data: { status: 'fallido', lastError: motivo, nextAttemptAt: null } });
    return r.count;
  }

  async registro(owner: string, limite: number): Promise<RegistroCorreo[]> {
    const rows = await this.prisma.mailMessage.findMany({ where: { owner }, orderBy: { id: 'desc' }, take: limite, select: { id: true, to: true, subject: true, kind: true, status: true, attempts: true, lastError: true, createdAt: true, sentAt: true, nextAttemptAt: true } });
    return rows.map((r) => ({ id: r.id, para: r.to, asunto: r.subject, tipo: r.kind, estado: r.status as EstadoEnvio, intentos: r.attempts, error: r.lastError, creadoEn: r.createdAt, enviadoEn: r.sentAt, proximoIntento: r.nextAttemptAt }));
  }

  async purgar(antesDe: Date): Promise<number> {
    const r = await this.prisma.mailMessage.deleteMany({ where: { createdAt: { lt: antesDe } } });
    return r.count;
  }
}
