import { descifrar, cifrar } from './dominio/cifrado';
import { componer } from './dominio/plantilla';
import { siguienteIntento } from './dominio/reintentos';
import {
  CambioConfigCorreo,
  ConfigCorreo,
  ConfigCorreoPanel,
  ErrorCorreo,
  IdMensaje,
  Marca,
  MensajeCorreo,
  Propietario,
  Proveedor,
  RegistroCorreo,
  ResultadoPrueba,
} from './dominio/tipos';
import { conEtiqueta, enmascarar, esEmail, finalDeCredencial, validarCambio } from './dominio/validacion';
import { AlmacenConfigCorreo, ColaCorreo, DatosEnvio, Transporte } from './puertos';
import { crearTransporte } from './transportes';

/** Con qué se envía: el transporte y los datos del remitente. */
export interface Envio {
  transporte: Transporte;
  datos: DatosEnvio;
}

export interface OpcionesServicioCorreo {
  almacen: AlmacenConfigCorreo;
  cola: ColaCorreo;
  /** Clave maestra para cifrar la credencial (32 bytes). Sin ella no se puede guardar ni usar una credencial. */
  claveMaestra: Buffer | null;
  /** Envío de reserva cuando un propietario no tiene configuración guardada (p. ej. SMTP por variables de entorno). */
  reserva?: () => Envio | null;
  /** Marca cuando no hay configuración guardada. */
  marcaPorDefecto: Marca;
  /** Para pruebas: cómo se crea el transporte de un proveedor. */
  fabrica?: (proveedor: Proveedor, credencial: string) => Transporte;
  reloj?: () => Date;
}

export interface ResultadoCola {
  enviados: number;
  reintentos: number;
  fallidos: number;
}

/** Prefijo de tipo de los correos de avisos: se descartan todos juntos al apagar el interruptor. */
export const PREFIJO_AVISOS = 'aviso.';

/**
 * Motor de correo: configuración por propietario, prueba, cola con reintentos y registro. No sabe nada de la app
 * que lo usa: la app implementa los puertos y decide qué correos encolar.
 */
export class ServicioCorreo {
  private readonly fabrica: (p: Proveedor, c: string) => Transporte;
  private readonly reloj: () => Date;

  constructor(private readonly o: OpcionesServicioCorreo) {
    this.fabrica = o.fabrica ?? crearTransporte;
    this.reloj = o.reloj ?? (() => new Date());
  }

  get claveMaestraDisponible(): boolean {
    return this.o.claveMaestra !== null;
  }

  leerConfig(propietario: Propietario): Promise<ConfigCorreo | null> {
    return this.o.almacen.leer(propietario);
  }

  /** Lo que ve el panel: la credencial solo enmascarada. */
  async leerParaPanel(propietario: Propietario): Promise<ConfigCorreoPanel> {
    const c = await this.o.almacen.leer(propietario);
    const origen = c ? 'panel' : this.o.reserva?.() ? 'entorno' : 'ninguno';
    return {
      origen,
      claveMaestraDisponible: this.claveMaestraDisponible,
      proveedor: c?.proveedor ?? null,
      credencial: c ? enmascarar(c.credencialFinal) : null,
      remitente: c?.remitente ?? null,
      responderA: c?.responderA ?? null,
      marca: c?.marca ?? null,
      avisosActivos: c?.avisosActivos ?? false,
      avisosDesde: c?.avisosDesde ?? null,
      actualizadoEn: c?.actualizadoEn ?? null,
      actualizadoPor: c?.actualizadoPor ?? null,
    };
  }

  /** Guarda la configuración. Credencial vacía = se conserva la guardada (si es del mismo proveedor). */
  async configurar(propietario: Propietario, cambio: CambioConfigCorreo, autor: string | null): Promise<ConfigCorreoPanel> {
    const actual = await this.o.almacen.leer(propietario);
    const puedeConservar = !!actual?.credencialCifrada && actual.proveedor === cambio?.proveedor;
    const v = validarCambio(cambio, puedeConservar);
    let credencialCifrada = puedeConservar ? (actual?.credencialCifrada ?? null) : null;
    let credencialFinal = puedeConservar ? (actual?.credencialFinal ?? null) : null;
    if (v.credencial) {
      if (!this.o.claveMaestra) throw new ErrorCorreo('El servidor no tiene configurada la clave maestra de cifrado: no se puede guardar la clave del proveedor.');
      credencialCifrada = cifrar(v.credencial, this.o.claveMaestra);
      credencialFinal = finalDeCredencial(v.proveedor, v.credencial);
    }
    const ahora = this.reloj();
    const estabanActivos = actual?.avisosActivos === true;
    await this.o.almacen.guardar(propietario, {
      proveedor: v.proveedor,
      credencialCifrada,
      credencialFinal,
      remitente: v.remitente,
      responderA: v.responderA ?? null,
      marca: v.marca,
      avisosActivos: v.avisosActivos,
      // Al encender, solo cuenta lo que pase desde ahora; si ya estaban encendidos, se mantiene la fecha.
      avisosDesde: v.avisosActivos ? (estabanActivos ? (actual?.avisosDesde ?? ahora) : ahora) : null,
      actualizadoEn: ahora,
      actualizadoPor: autor,
    });
    if (estabanActivos && !v.avisosActivos) await this.o.cola.descartarPendientes(propietario, PREFIJO_AVISOS, 'Avisos por correo desactivados');
    return this.leerParaPanel(propietario);
  }

  /** Si este propietario puede enviar correo ahora mismo (configuración guardada o reserva). */
  async disponible(propietario: Propietario): Promise<boolean> {
    try {
      return (await this.envioPara(propietario)) !== null;
    } catch {
      return false;
    }
  }

  /** Marca para las plantillas: la guardada o la de por defecto. */
  async marca(propietario: Propietario): Promise<Marca> {
    return (await this.o.almacen.leer(propietario))?.marca ?? this.o.marcaPorDefecto;
  }

  /** Correo de prueba, síncrono: dice al momento si el proveedor lo aceptó. */
  async probar(propietario: Propietario, para: string): Promise<ResultadoPrueba> {
    if (!esEmail(para)) return { ok: false, error: 'La dirección de destino no es válida.' };
    let envio: Envio | null;
    try {
      envio = await this.envioPara(propietario);
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
    if (!envio) return { ok: false, error: 'No hay correo configurado.' };
    const marca = await this.marca(propietario);
    const { html, texto } = componer(marca, {
      titulo: 'Correo de prueba',
      parrafos: [`Si lees esto, ${marca.nombre} ya puede enviar correo con la configuración guardada.`],
      boton: { texto: `Abrir ${marca.nombre}`, url: marca.url },
    });
    try {
      await envio.transporte.enviar({ para: para.trim(), asunto: conEtiqueta(marca, `Correo de prueba · ${marca.nombre}`), html, texto, tipo: 'prueba' }, envio.datos);
      return { ok: true, error: null };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  /** Encola un correo; el asunto lleva la etiqueta de la marca del propietario (si tiene). */
  async encolar(propietario: Propietario, mensaje: MensajeCorreo): Promise<IdMensaje> {
    const marca = await this.marca(propietario);
    return this.o.cola.encolar(propietario, { ...mensaje, asunto: conEtiqueta(marca, mensaje.asunto) }, this.reloj());
  }

  /**
   * Un paso del trabajador: envía los pendientes que tocan. Un fallo se reintenta con esperas crecientes y, al
   * agotar los intentos, queda como fallido. Nunca lanza: lo que falla queda en el registro.
   */
  async procesarCola(limite = 20): Promise<ResultadoCola> {
    const r: ResultadoCola = { enviados: 0, reintentos: 0, fallidos: 0 };
    const pendientes = await this.o.cola.pendientes(this.reloj(), limite);
    const envios = new Map<Propietario, Promise<Envio | null>>();
    for (const m of pendientes) {
      if (!envios.has(m.propietario)) envios.set(m.propietario, this.envioPara(m.propietario));
      const intentos = m.intentos + 1;
      try {
        const envio = await envios.get(m.propietario)!;
        if (!envio) throw new Error('No hay correo configurado.');
        const { idProveedor } = await envio.transporte.enviar(m, envio.datos);
        await this.o.cola.marcarEnviado(m.id, intentos, idProveedor, this.reloj());
        r.enviados++;
      } catch (e) {
        const proximo = siguienteIntento(intentos, this.reloj());
        await this.o.cola.marcarFallo(m.id, intentos, (e as Error).message.slice(0, 1000), proximo);
        if (proximo) r.reintentos++;
        else r.fallidos++;
      }
    }
    return r;
  }

  registro(propietario: Propietario, limite = 100): Promise<RegistroCorreo[]> {
    return this.o.cola.registro(propietario, Math.min(Math.max(limite, 1), 500));
  }

  /** Borra el registro de más de `dias` días. */
  purgar(dias = 90): Promise<number> {
    return this.o.cola.purgar(new Date(this.reloj().getTime() - dias * 86_400_000));
  }

  private async envioPara(propietario: Propietario): Promise<Envio | null> {
    const c = await this.o.almacen.leer(propietario);
    if (!c) return this.o.reserva?.() ?? null;
    if (!c.credencialCifrada) return null;
    if (!this.o.claveMaestra) throw new ErrorCorreo('El servidor no tiene configurada la clave maestra de cifrado.');
    const credencial = descifrar(c.credencialCifrada, this.o.claveMaestra);
    return { transporte: this.fabrica(c.proveedor, credencial), datos: { remitente: c.remitente, responderA: c.responderA } };
  }
}


