import { componer } from '../dominio/plantilla';
import { Marca } from '../dominio/tipos';

export interface AvisoDelResumen {
  /** Lo que se lee en la lista («Ana te asignó WEB-12 · Portada»). */
  texto: string;
  url: string;
}

/** El correo del resumen: cuántos avisos hay sin leer y un enlace por aviso. Sin avisos no se debe llamar. */
export function componerResumen(marca: Marca, nombrePersona: string, avisos: AvisoDelResumen[], enlacePreferencias: string): { asunto: string; html: string; texto: string } {
  const n = avisos.length;
  const asunto = `Tienes ${n} aviso${n === 1 ? '' : 's'} sin leer`;
  const { html, texto } = componer(marca, {
    titulo: asunto,
    parrafos: [`Hola ${nombrePersona}, esto es lo que tienes pendiente en ${marca.nombre}:`],
    enlaces: avisos,
    boton: { texto: 'Ver mis avisos', url: `${marca.url}/avisos` },
    notaPie: { texto: 'Cambia qué correos recibes', url: enlacePreferencias },
  });
  return { asunto, html, texto };
}
