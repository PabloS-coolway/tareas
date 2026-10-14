import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import type { Priority } from '@yorga/contracts';
import { ServicioCorreo, componerResumen, pasaPreferencias, preferenciasPorDefecto, tocaResumen, type ConfigCorreo, type PreferenciasCorreo } from '@modulos/correo';
import { PrismaService } from '../../infrastructure/db/prisma.service';
import { PROPIETARIO_CORREO } from '../../correo/correo.providers';
import { claveTarea } from '../domain/clave';
import { CATALOGO_AVISOS, HORARIO_RESUMEN, TIPO_EN_COLA, TIPO_RESUMEN, avisoFiltrable, componerAviso, fraseDelAviso, motivoParaNoEnviar, type AvisoParaCorreo } from '../domain/avisos-correo';
import { PrismaAlmacenPreferencias, aPreferencias } from '../infrastructure/prisma-almacen-preferencias';
import { AccessService } from './access.service';

const CADA = Number(process.env.CORREO_CADA_MS) || 30_000; // cada cuánto trabaja la cola (env para pruebas)
const LOTE = 100;
const DIA = 86_400_000;
/** La primera vez que alguien recibe resumen, cuánto hacia atrás se mira. */
const PRIMER_RESUMEN_DIAS = 3;

const TIPOS = Object.keys(TIPO_EN_COLA) as NotificationType[];

const incluirAviso = {
  user: { select: { email: true, name: true, active: true } },
  task: { select: { number: true, title: true, priority: true, projectId: true, project: { select: { key: true } } } },
} as const;

/**
 * Trabajador del correo: pasa a la cola los avisos que cada persona quiere por correo al momento, prepara los
 * resúmenes diarios y envía lo pendiente. Lee los avisos ya guardados (no se toca `notify`, que corre dentro de
 * transacciones): un rollback nunca genera correo.
 */
@Injectable()
export class AvisosPorCorreoService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Correo');
  private timer?: NodeJS.Timeout;
  private trabajando = false;
  private ultimaPurga = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly correo: ServicioCorreo,
    private readonly access: AccessService,
    private readonly preferencias: PrismaAlmacenPreferencias,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.paso(), CADA);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Un paso: avisos nuevos al momento, resúmenes que toquen, envío de pendientes y, una vez al día, purga. Nunca se solapa. */
  async paso(ahora = new Date()): Promise<void> {
    if (this.trabajando) return;
    this.trabajando = true;
    try {
      const cfg = await this.correo.leerConfig(PROPIETARIO_CORREO);
      if (cfg?.avisosActivos && cfg.avisosDesde) {
        await this.encolarAvisos(cfg);
        await this.encolarResumenes(cfg, ahora);
      }
      const r = await this.correo.procesarCola();
      if (r.enviados || r.fallidos) this.log.log(`enviados ${r.enviados}, reintentos ${r.reintentos}, fallidos ${r.fallidos}`);
      if (Date.now() - this.ultimaPurga > DIA) {
        this.ultimaPurga = Date.now();
        const n = await this.correo.purgar(90);
        if (n) this.log.log(`registro: ${n} correos de más de 90 días borrados`);
      }
    } catch (e) {
      this.log.error((e as Error).message);
    } finally {
      this.trabajando = false;
    }
  }

  /**
   * Avisos de tarea posteriores a cuando se encendió el interruptor y aún sin mirar. Se encolan los que la persona
   * quiere al momento; quien está en resumen los recibirá a las 8:00. Todos quedan marcados para no volver a mirarlos.
   */
  async encolarAvisos(cfg: ConfigCorreo): Promise<number> {
    const rows = await this.prisma.notification.findMany({
      where: { type: { in: TIPOS }, emailQueuedAt: null, createdAt: { gte: cfg.avisosDesde! } },
      orderBy: { id: 'asc' },
      take: LOTE,
      include: incluirAviso,
    });
    if (!rows.length) return 0;
    const actores = await this.nombres(rows.map((r) => r.actorId));
    const prefs = new Map<number, PreferenciasCorreo>();
    const visibles = new Map<number, number[] | null>();
    let encolados = 0;
    for (const r of rows) {
      if (!prefs.has(r.userId)) prefs.set(r.userId, await this.preferenciasDe(r.userId));
      if (!visibles.has(r.userId)) visibles.set(r.userId, await this.access.visibleProjectIds(r.userId));
      const aviso = aAviso(r, actores);
      const pref = prefs.get(r.userId)!;
      if (pref.modo === 'inmediato' && motivoParaNoEnviar(aviso, visibles.get(r.userId) ?? null) === null && pasaPreferencias(pref, avisoFiltrable(aviso))) {
        await this.correo.encolar(PROPIETARIO_CORREO, componerAviso(aviso, cfg.marca));
        encolados++;
      }
    }
    await this.prisma.notification.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { emailQueuedAt: new Date() } });
    return encolados;
  }

  /**
   * Resumen diario (L-V 8:00, Madrid) de quien lo eligió: sus avisos sin leer desde el resumen anterior que pasen
   * sus preferencias. `last_digest_at` se fija haya o no avisos: es lo que impide un segundo resumen el mismo día.
   */
  async encolarResumenes(cfg: ConfigCorreo, ahora: Date): Promise<number> {
    const quienes = await this.prisma.emailPref.findMany({ where: { mode: 'resumen', enabled: true }, include: { user: { select: { email: true, name: true, active: true } } } });
    let enviados = 0;
    for (const q of quienes) {
      if (!tocaResumen(ahora, q.lastDigestAt, HORARIO_RESUMEN)) continue;
      const desdeAnterior = q.lastDigestAt ?? new Date(ahora.getTime() - PRIMER_RESUMEN_DIAS * DIA);
      const desde = desdeAnterior > cfg.avisosDesde! ? desdeAnterior : cfg.avisosDesde!;
      const rows = await this.prisma.notification.findMany({
        where: { userId: q.userId, type: { in: TIPOS }, readAt: null, createdAt: { gt: desde, lte: ahora } },
        orderBy: { id: 'asc' },
        take: 200,
        include: incluirAviso,
      });
      const pref = aPreferencias(q);
      const visibles = await this.access.visibleProjectIds(q.userId);
      const actores = await this.nombres(rows.map((r) => r.actorId));
      const avisos = rows
        .map((r) => aAviso(r, actores))
        .filter((a) => motivoParaNoEnviar(a, visibles) === null && pasaPreferencias(pref, avisoFiltrable(a)))
        .map((a) => ({ texto: fraseDelAviso(a), url: a.tarea ? `${cfg.marca.url}/t/${a.tarea.clave}` : `${cfg.marca.url}/avisos` }));
      if (avisos.length && q.user.active && q.user.email.includes('@')) {
        const { asunto, html, texto } = componerResumen(cfg.marca, q.user.name, avisos, `${cfg.marca.url}/perfil`);
        await this.correo.encolar(PROPIETARIO_CORREO, { para: q.user.email, asunto, html, texto, tipo: TIPO_RESUMEN });
        enviados++;
      }
      await this.preferencias.marcarResumen(q.userId, ahora);
    }
    return enviados;
  }

  private async preferenciasDe(userId: number): Promise<PreferenciasCorreo> {
    return (await this.preferencias.leer(userId))?.preferencias ?? preferenciasPorDefecto(CATALOGO_AVISOS);
  }

  private async nombres(ids: (number | null)[]): Promise<Map<number, string>> {
    const unicos = [...new Set(ids.filter((x): x is number => x !== null))];
    if (!unicos.length) return new Map();
    return new Map((await this.prisma.user.findMany({ where: { id: { in: unicos } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  }
}

type FilaAviso = {
  type: NotificationType;
  text: string;
  actorId: number | null;
  user: { email: string; name: string; active: boolean };
  task: { number: number; title: string; priority: Priority; projectId: number; project: { key: string } } | null;
};

function aAviso(r: FilaAviso, actores: Map<number, string>): AvisoParaCorreo {
  return {
    tipo: r.type,
    texto: r.text,
    actor: r.actorId ? (actores.get(r.actorId) ?? null) : null,
    destinatario: { email: r.user.email, nombre: r.user.name, activo: r.user.active },
    tarea: r.task ? { clave: claveTarea(r.task.project.key, r.task.number), titulo: r.task.title, projectId: r.task.projectId, prioridad: r.task.priority } : null,
  };
}
