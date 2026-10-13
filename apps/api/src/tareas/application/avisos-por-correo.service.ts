import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ServicioCorreo } from '@modulos/correo';
import { PrismaService } from '../../infrastructure/db/prisma.service';
import { PROPIETARIO_CORREO } from '../../correo/correo.providers';
import { claveTarea } from '../domain/clave';
import { AVISOS_POR_CORREO, componerAviso, motivoParaNoEnviar, type TipoAvisoCorreo } from '../domain/avisos-correo';
import { AccessService } from './access.service';

const CADA = Number(process.env.CORREO_CADA_MS) || 30_000; // cada cuánto trabaja la cola (env para pruebas)
const LOTE = 100;
const DIA = 86_400_000;

/**
 * Trabajador del correo: pasa a la cola los avisos que van por correo y envía lo pendiente. Lee los avisos ya
 * guardados (no se toca `notify`, que corre dentro de transacciones): un rollback nunca genera correo.
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
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.paso(), CADA);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Un paso: encolar avisos nuevos, enviar pendientes y, una vez al día, purgar el registro. Nunca se solapa. */
  async paso(): Promise<void> {
    if (this.trabajando) return;
    this.trabajando = true;
    try {
      await this.encolarAvisos();
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

  /** Avisos de los tipos que van por correo, posteriores a cuando se encendió el interruptor y aún sin pasar. */
  async encolarAvisos(): Promise<number> {
    const cfg = await this.correo.leerConfig(PROPIETARIO_CORREO);
    if (!cfg?.avisosActivos || !cfg.avisosDesde) return 0;
    const rows = await this.prisma.notification.findMany({
      where: { type: { in: Object.keys(AVISOS_POR_CORREO) as TipoAvisoCorreo[] }, emailQueuedAt: null, createdAt: { gte: cfg.avisosDesde } },
      orderBy: { id: 'asc' },
      take: LOTE,
      include: {
        user: { select: { email: true, name: true, active: true } },
        task: { select: { number: true, title: true, projectId: true, project: { select: { key: true } } } },
      },
    });
    if (!rows.length) return 0;
    const actorIds = [...new Set(rows.map((r) => r.actorId).filter((x): x is number => x !== null))];
    const actores = new Map((await this.prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
    const visibles = new Map<number, number[] | null>();
    let encolados = 0;
    for (const r of rows) {
      if (!visibles.has(r.userId)) visibles.set(r.userId, await this.access.visibleProjectIds(r.userId));
      const aviso = {
        tipo: r.type as string,
        texto: r.text,
        actor: r.actorId ? (actores.get(r.actorId) ?? null) : null,
        destinatario: { email: r.user.email, nombre: r.user.name, activo: r.user.active },
        tarea: r.task ? { clave: claveTarea(r.task.project.key, r.task.number), titulo: r.task.title, projectId: r.task.projectId } : null,
      };
      if (motivoParaNoEnviar(aviso, visibles.get(r.userId) ?? null) === null) {
        await this.correo.encolar(PROPIETARIO_CORREO, componerAviso({ ...aviso, tipo: r.type as TipoAvisoCorreo }, cfg.marca));
        encolados++;
      }
    }
    // Se marcan todos (también los que no se envían) para no volver a mirarlos.
    await this.prisma.notification.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { emailQueuedAt: new Date() } });
    return encolados;
  }
}
