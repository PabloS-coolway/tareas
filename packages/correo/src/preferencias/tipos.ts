/** Un tipo de aviso que la app puede mandar por correo. La lista la define cada app. */
export interface TipoAviso {
  clave: string;
  etiqueta: string;
  /** Explicación corta para la pantalla. */
  descripcion?: string;
  /** Si viene activado para quien no ha tocado sus preferencias. */
  porDefecto: boolean;
}

export type CatalogoAvisos = readonly TipoAviso[];

/** Agrupación de la app que se puede filtrar (en un gestor de tareas, sus espacios de trabajo). */
export type IdAmbito = string | number;
export type IdPersona = string | number;

export const MODOS_AMBITOS = ['todos', 'solo', 'silenciar'] as const;
export type ModoAmbitos = (typeof MODOS_AMBITOS)[number];

export const MODOS_ENVIO = ['inmediato', 'resumen'] as const;
export type ModoEnvio = (typeof MODOS_ENVIO)[number];

/** Lo que cada persona decide sobre sus correos de avisos. */
export interface PreferenciasCorreo {
  /** Interruptor personal: apagado, ningún aviso por correo. */
  activo: boolean;
  /** Claves del catálogo que quiere por correo. */
  tipos: string[];
  ambitos: { modo: ModoAmbitos; ids: IdAmbito[] };
  /**
   * Nivel mínimo en la escala ordenada de la app (0 = el más bajo). Null = todos. Un aviso con nivel inferior no se
   * manda por correo.
   */
  nivelMinimo: number | null;
  modo: ModoEnvio;
}

/** Lo que hace falta de un aviso para decidir si va por correo. */
export interface AvisoFiltrable {
  tipo: string;
  /** Null si el aviso no pertenece a ningún ámbito (entonces el filtro de ámbitos no le afecta). */
  ambitoId: IdAmbito | null;
  /** Null si el aviso no tiene nivel (entonces el nivel mínimo no le afecta). */
  nivel: number | null;
}

/** Cuándo sale el resumen: zona horaria IANA, hora local (0-23) y días ISO (1 = lunes … 7 = domingo). */
export interface HorarioResumen {
  zona: string;
  hora: number;
  dias: readonly number[];
}

/** Preferencias guardadas de una persona y cuándo se le mandó el último resumen. */
export interface PreferenciasGuardadas {
  preferencias: PreferenciasCorreo;
  ultimoResumen: Date | null;
}

/** Dónde guarda cada app las preferencias. Sin nada guardado = valores por defecto. */
export interface AlmacenPreferencias {
  leer(persona: IdPersona): Promise<PreferenciasGuardadas | null>;
  guardar(persona: IdPersona, preferencias: PreferenciasCorreo): Promise<void>;
  marcarResumen(persona: IdPersona, cuando: Date): Promise<void>;
}
