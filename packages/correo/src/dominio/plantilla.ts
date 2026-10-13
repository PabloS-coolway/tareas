import { Marca } from './tipos';

export function escapar(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export interface ContenidoCorreo {
  /** Primera línea destacada. */
  titulo: string;
  parrafos: string[];
  boton?: { texto: string; url: string };
}

/** Correo con la marca: HTML sencillo (tablas y estilos en línea, para que se vea bien en cualquier cliente) y texto plano. */
export function componer(marca: Marca, c: ContenidoCorreo): { html: string; texto: string } {
  const p = c.parrafos.map((t) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:#333">${escapar(t)}</p>`).join('');
  const boton = c.boton
    ? `<p style="margin:20px 0"><a href="${escapar(c.boton.url)}" style="background:#4f46e5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;display:inline-block">${escapar(c.boton.texto)}</a></p>`
    : '';
  const pie = [marca.pie, marca.url].filter(Boolean).map((t) => escapar(t)).join('<br>');
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f5f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:10px;padding:24px">
<tr><td>
<div style="font-size:13px;font-weight:700;color:#4f46e5;margin-bottom:16px">${escapar(marca.nombre)}</div>
<h1 style="margin:0 0 14px;font-size:18px;color:#111">${escapar(c.titulo)}</h1>
${p}${boton}
</td></tr></table>
<div style="font-size:12px;color:#888;margin-top:14px">${pie}</div>
</td></tr></table></body></html>`;
  const texto = [c.titulo, '', ...c.parrafos, ...(c.boton ? ['', `${c.boton.texto}: ${c.boton.url}`] : []), '', '—', marca.nombre, ...(marca.pie ? [marca.pie] : [])].join('\n');
  return { html, texto };
}
