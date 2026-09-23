import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PRIORITY_LABELS, type IntakeConfigDto, type PublicFormDto, type PublicFormResultDto, type PublicFormSubmitDto, type UpdateIntakeDto } from '@yorga/contracts';
import { PrismaService } from '../../infrastructure/db/prisma.service';
import { claveTarea } from '../domain/clave';
import { interesados, limpiarSeguidores } from '../domain/interesados';
import { fueraDePlazo, horasDePlazo, limpiarPlazos } from '../domain/plazos';
import { ActivityService } from './activity.service';
import { NotificationsService } from './notifications.service';
import { TasksService } from './tasks.service';

const ENVIOS_POR_HORA = 20;
const CADA = Number(process.env.PLAZOS_CADA_MS) || 5 * 60_000; // cada cuánto se vigilan los plazos (env para pruebas)

/**
 * Formulario público de alta (p. ej. incidencias de sucursales, sin cuenta) y vigilancia del plazo de
 * respuesta: cada 5 minutos avisa, una sola vez, de las tareas que siguen sin empezar pasado su plazo.
 */
@Injectable()
export class IntakeService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Plazos');
  private readonly envios = new Map<string, number[]>();
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksService,
    private readonly activity: ActivityService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.vigilarPlazos().catch((e) => this.log.error((e as Error).message)), CADA);
  }
  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  // ---------- Configuración (quien gestiona proyectos) ----------

  async config(projectId: number): Promise<IntakeConfigDto> {
    const p = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!p) throw new NotFoundException('Proyecto no encontrado.');
    return { projectId: p.id, active: p.intakeActive, token: p.intakeToken, sucursales: p.intakeSucursales, sla: limpiarPlazos(p.slaHours), slaNotifyUserIds: p.slaNotifyIds };
  }

  async update(projectId: number, dto: UpdateIntakeDto, actorId: number): Promise<IntakeConfigDto> {
    const p = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!p) throw new NotFoundException('Proyecto no encontrado.');
    const data: Record<string, unknown> = {};
    if (dto.sucursales !== undefined) data.intakeSucursales = [...new Set(dto.sucursales.map((s) => s.trim()).filter(Boolean))].slice(0, 300);
    if (dto.sla !== undefined) data.slaHours = limpiarPlazos(dto.sla) ?? null;
    if (dto.slaNotifyUserIds !== undefined) {
      const ids = limpiarSeguidores(dto.slaNotifyUserIds);
      if (ids.length && (await this.prisma.user.count({ where: { id: { in: ids }, active: true } })) !== ids.length) throw new BadRequestException('Alguna persona no es válida.');
      data.slaNotifyIds = ids;
    }
    if (dto.active !== undefined) {
      data.intakeActive = dto.active;
      // Quien lo activa consta como creador de lo que entre por el formulario.
      if (dto.active) data.intakeOwnerId = actorId;
    }
    if (dto.regenerate || (dto.active && !p.intakeToken)) data.intakeToken = randomBytes(18).toString('base64url');
    await this.prisma.project.update({ where: { id: projectId }, data: data as never });
    return this.config(projectId);
  }

  // ---------- Formulario público ----------

  private async porToken(token: string) {
    const p = token ? await this.prisma.project.findUnique({ where: { intakeToken: token } }) : null;
    if (!p || !p.intakeActive || p.archived) throw new NotFoundException('Este formulario no existe o está desactivado.');
    return p;
  }

  async form(token: string): Promise<PublicFormDto> {
    const p = await this.porToken(token);
    return { projectName: p.name, sucursales: p.intakeSucursales };
  }

  async submit(token: string, dto: PublicFormSubmitDto, ip: string): Promise<PublicFormResultDto> {
    const p = await this.porToken(token);
    if (dto.web) throw new BadRequestException('No se pudo enviar.'); // campo trampa: sólo lo rellenan los bots
    this.limitar(`${ip}|${p.id}`);
    const sucursal = (dto.sucursal ?? '').trim();
    const nombre = (dto.nombre ?? '').trim().slice(0, 80);
    const asunto = (dto.asunto ?? '').trim().slice(0, 140);
    const descripcion = (dto.descripcion ?? '').trim().slice(0, 5000);
    if (!sucursal || !nombre || !asunto) throw new BadRequestException('Indica la sucursal, tu nombre y qué pasa.');
    if (p.intakeSucursales.length && !p.intakeSucursales.includes(sucursal)) throw new BadRequestException('Elige tu sucursal de la lista.');
    const prioridad = (['NORMAL', 'HIGH', 'URGENT'] as const).includes(dto.urgencia) ? dto.urgencia : 'NORMAL';
    const dueno = p.intakeOwnerId ? await this.prisma.user.findFirst({ where: { id: p.intakeOwnerId, active: true } }) : null;
    if (!dueno) throw new BadRequestException('El formulario no está bien configurado: avisa a sistemas.');

    const t = await this.tasks.create(
      {
        projectId: p.id,
        title: `[${sucursal}] ${asunto}`,
        description: `**Sucursal:** ${sucursal}  \n**Quién lo envía:** ${nombre}  \n**Urgencia:** ${PRIORITY_LABELS[prioridad]}\n\n${descripcion || '_(sin más detalle)_'}\n\n_Entró por el formulario público._`,
        type: 'INCIDENT',
        priority: prioridad,
        tags: ['formulario', sucursal.toLowerCase().replace(/[^a-z0-9áéíóúñü]+/gi, '-').replace(/^-|-$/g, '').slice(0, 40)],
      },
      dueno.id,
    );
    await this.activity.record({ taskId: t.id, actorId: null, action: 'intake', after: `${nombre} · ${sucursal}` });
    return { key: t.key };
  }

  /** Como mucho N envíos por hora desde la misma IP a un mismo formulario. */
  private limitar(clave: string): void {
    const ahora = Date.now();
    const recientes = (this.envios.get(clave) ?? []).filter((t) => ahora - t < 3_600_000);
    if (recientes.length >= ENVIOS_POR_HORA) throw new HttpException('Demasiados envíos seguidos. Prueba en un rato.', HttpStatus.TOO_MANY_REQUESTS);
    recientes.push(ahora);
    this.envios.set(clave, recientes);
  }

  // ---------- Plazo de respuesta ----------

  /** Avisa (una vez) de las tareas sin empezar que ya pasaron su plazo. Devuelve cuántas avisó. */
  async vigilarPlazos(ahora = new Date()): Promise<number> {
    const proyectos = await this.prisma.project.findMany({ where: { archived: false, NOT: { slaHours: { equals: null as never } } }, select: { id: true, key: true, slaHours: true, slaNotifyIds: true } });
    let avisadas = 0;
    for (const p of proyectos) {
      const sla = limpiarPlazos(p.slaHours);
      if (!sla) continue;
      const candidatas = await this.prisma.task.findMany({
        where: { projectId: p.id, slaNotifiedAt: null, type: { not: 'EPIC' }, status: { category: 'TODO' } },
        select: { id: true, number: true, title: true, priority: true, createdAt: true, assigneeId: true, reporterId: true, followers: { select: { userId: true } } },
      });
      for (const t of candidatas) {
        if (!fueraDePlazo({ createdAt: t.createdAt, priority: t.priority, category: 'TODO' }, sla, ahora)) continue;
        const h = horasDePlazo(sla, t.priority)!;
        const quienes = [...interesados({ assigneeId: t.assigneeId, reporterId: t.reporterId, followerIds: t.followers.map((f) => f.userId) }), ...p.slaNotifyIds];
        await this.prisma.task.update({ where: { id: t.id }, data: { slaNotifiedAt: ahora } });
        await this.notifications.notify(quienes, 'SLA', `fuera de plazo: ${claveTarea(p.key, t.number)} · ${t.title} (${PRIORITY_LABELS[t.priority].toLowerCase()}, ${h} h sin empezar)`, { taskId: t.id, actorId: null });
        await this.activity.record({ taskId: t.id, actorId: null, action: 'sla', after: `${h} h` });
        avisadas++;
      }
    }
    if (avisadas) this.log.log(`${avisadas} tareas fuera de plazo avisadas`);
    return avisadas;
  }
}
