import { Injectable, Logger } from '@nestjs/common';
import { ServicioCorreo } from '@modulos/correo';
import type { RuleTrigger } from '@yorga/contracts';
import { PrismaService } from '../../infrastructure/db/prisma.service';
import { PROPIETARIO_CORREO } from '../../correo/correo.providers';
import { claveTarea } from '../domain/clave';
import { componerCorreoRegla, motivoParaNoEnviarRegla } from '../domain/avisos-correo';
import { PrismaAlmacenPreferencias } from '../infrastructure/prisma-almacen-preferencias';
import { AccessService } from './access.service';

/**
 * Acción «Enviar correo a» de las reglas: encola al momento un correo para cada persona de la lista. No pasa por los
 * avisos ni por las preferencias (la regla manda sobre ellas); solo lo paran el interruptor personal y el del admin.
 */
@Injectable()
export class CorreoReglasService {
  private readonly log = new Logger('Reglas/correo');

  constructor(
    private readonly prisma: PrismaService,
    private readonly correo: ServicioCorreo,
    private readonly access: AccessService,
    private readonly preferencias: PrismaAlmacenPreferencias,
  ) {}

  /** Devuelve cuántos correos se han encolado. Nunca lanza: un fallo se registra y la regla sigue. */
  async enviar(regla: { name: string; emailUserIds: number[] }, taskId: number, disparador: RuleTrigger): Promise<number> {
    try {
      const cfg = await this.correo.leerConfig(PROPIETARIO_CORREO);
      if (!cfg?.avisosActivos || !regla.emailUserIds.length) return 0;
      const t = await this.prisma.task.findUnique({
        where: { id: taskId },
        select: { number: true, title: true, priority: true, projectId: true, status: { select: { name: true } }, assignee: { select: { name: true } }, project: { select: { key: true, name: true } } },
      });
      if (!t) return 0;
      const personas = await this.prisma.user.findMany({ where: { id: { in: regla.emailUserIds } }, select: { id: true, name: true, email: true, active: true } });
      let encolados = 0;
      for (const p of personas) {
        const visibles = await this.access.visibleProjectIds(p.id);
        const interruptorPersonal = (await this.preferencias.leer(p.id))?.preferencias.activo ?? true;
        if (motivoParaNoEnviarRegla({ activo: p.active, email: p.email, interruptorPersonal, veProyecto: visibles === null || visibles.includes(t.projectId) }) !== null) continue;
        await this.correo.encolar(
          PROPIETARIO_CORREO,
          componerCorreoRegla(
            {
              regla: regla.name,
              disparador,
              estado: t.status.name,
              proyecto: t.project.name,
              tarea: { clave: claveTarea(t.project.key, t.number), titulo: t.title, prioridad: t.priority, responsable: t.assignee?.name ?? null },
              destinatario: { nombre: p.name, email: p.email },
            },
            cfg.marca,
          ),
        );
        encolados++;
      }
      return encolados;
    } catch (e) {
      this.log.error(`regla «${regla.name}», tarea ${taskId}: ${(e as Error).message}`);
      return 0;
    }
  }
}
