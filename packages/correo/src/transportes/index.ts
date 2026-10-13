import { Proveedor } from '../dominio/tipos';
import { Transporte } from '../puertos';
import { TransporteBrevo } from './brevo';
import { TransporteSmtp } from './smtp';

export { TransporteBrevo, URL_BREVO } from './brevo';
export { TransporteSmtp } from './smtp';

/** El transporte de un proveedor con su credencial ya descifrada. */
export function crearTransporte(proveedor: Proveedor, credencial: string): Transporte {
  return proveedor === 'brevo' ? new TransporteBrevo(credencial) : new TransporteSmtp(credencial);
}
