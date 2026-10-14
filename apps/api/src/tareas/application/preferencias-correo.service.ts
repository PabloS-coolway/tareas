import { BadRequestException, Injectable } from '@nestjs/common';
import { ErrorCorreo, ServicioCorreo, normalizarPreferencias, preferenciasPorDefecto } from '@modulos/correo';
import { CorreoPreferenciasDto, PRIORITY_LABELS, PerfilCorreoDto } from '@yorga/contracts';
import { PROPIETARIO_CORREO } from '../../correo/correo.providers';
import { CATALOGO_AVISOS, ESCALA_PRIORIDAD } from '../domain/avisos-correo';
import { PrismaAlmacenPreferencias } from '../infrastructure/prisma-almacen-preferencias';

/** Preferencias de correo de la persona de la sesión (solo las suyas: nunca recibe un id de usuario). */
@Injectable()
export class PreferenciasCorreoService {
  constructor(
    private readonly almacen: PrismaAlmacenPreferencias,
    private readonly correo: ServicioCorreo,
  ) {}

  async leer(userId: number): Promise<PerfilCorreoDto> {
    const guardadas = await this.almacen.leer(userId);
    const p = guardadas?.preferencias ?? preferenciasPorDefecto(CATALOGO_AVISOS);
    const cfg = await this.correo.leerConfig(PROPIETARIO_CORREO);
    return {
      preferencias: { ...p, ambitos: { modo: p.ambitos.modo, ids: p.ambitos.ids.map(Number) } },
      catalogo: CATALOGO_AVISOS.map((t) => ({ clave: t.clave, etiqueta: t.etiqueta, porDefecto: t.porDefecto })),
      niveles: ESCALA_PRIORIDAD.map((pr, valor) => ({ valor, etiqueta: PRIORITY_LABELS[pr] })),
      horarioResumen: 'de lunes a viernes a las 8:00 (hora de Madrid)',
      avisosCorreoActivos: cfg?.avisosActivos === true,
    };
  }

  async guardar(userId: number, dto: CorreoPreferenciasDto): Promise<PerfilCorreoDto> {
    try {
      const p = normalizarPreferencias(dto, CATALOGO_AVISOS, ESCALA_PRIORIDAD.length);
      if (p.ambitos.ids.some((id) => !Number.isInteger(Number(id)))) throw new ErrorCorreo('La lista de proyectos no es válida.');
      await this.almacen.guardar(userId, p);
    } catch (e) {
      if (e instanceof ErrorCorreo) throw new BadRequestException(e.message);
      throw e;
    }
    return this.leer(userId);
  }
}
