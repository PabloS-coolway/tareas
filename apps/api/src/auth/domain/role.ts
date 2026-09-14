import { Feature, FEATURE_GESTION_ROLES, isFeature } from '@yorga/contracts';

/** Un dato del rol que no vale, con el porqué en lenguaje del usuario. */
export class InvalidRoleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRoleError';
  }
}

/** El `key` es la identidad del rol: se normaliza para que "Contable" y "contable" sean el mismo. */
export function normalizeRoleKey(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, '_');
}

/**
 * Las features de un rol tienen que estar en el catálogo CERRADO (REQ-006). No se inventan desde la web:
 * una feature que el código no protege sería un permiso que no hace nada — o peor, que da falsa seguridad.
 */
export function validateFeatures(features: unknown): Feature[] {
  if (!Array.isArray(features)) throw new InvalidRoleError('Las features deben ser una lista.');
  const out: Feature[] = [];
  for (const f of features) {
    if (typeof f !== 'string' || !isFeature(f)) {
      throw new InvalidRoleError(`Feature desconocida: "${String(f)}". Sólo valen las del catálogo, no se inventan.`);
    }
    if (!out.includes(f)) out.push(f);
  }
  return out;
}

/** Valida y normaliza un rol nuevo. */
export function validateNewRole(input: { key?: string; name?: string; features?: unknown }): {
  key: string;
  name: string;
  features: Feature[];
} {
  const key = normalizeRoleKey(input.key ?? '');
  if (!key) throw new InvalidRoleError('El código del rol es obligatorio (p.ej. contable).');
  if (!/^[a-z0-9_]+$/.test(key)) {
    throw new InvalidRoleError(`El código "${key}" sólo puede llevar minúsculas, números y guión bajo.`);
  }
  const name = (input.name ?? '').trim();
  if (!name) throw new InvalidRoleError('El nombre del rol es obligatorio.');
  return { key, name, features: validateFeatures(input.features) };
}

/**
 * ⚠️ Invariante ANTI-BLOQUEO: tras cualquier cambio, tiene que quedar **al menos un rol activo con
 * `roles.gestionar`**. Si no, nadie podría volver a administrar roles nunca: el sistema se tapiaría solo.
 * `roles.gestionar` es la meta-feature (desde ella se recupera todo lo demás), así que basta con protegerla.
 */
export function assertGestionAlcanzable(rolesResultantes: { active: boolean; features: Feature[] }[]): void {
  const alcanzable = rolesResultantes.some((r) => r.active && r.features.includes(FEATURE_GESTION_ROLES));
  if (!alcanzable) {
    throw new InvalidRoleError(
      'Este cambio dejaría al sistema sin ningún rol activo que pueda gestionar roles: nadie podría volver a ' +
        'administrar. Deja al menos un rol activo con «Gestionar roles y permisos».',
    );
  }
}
