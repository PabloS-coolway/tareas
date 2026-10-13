import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { cifrar, componer, descifrar, enmascarar, ErrorCorreo, finalDeCredencial, leerClaveMaestra, MAX_INTENTOS, siguienteIntento, validarCambio, type CambioConfigCorreo } from '../src';

const clave = randomBytes(32);
const base: CambioConfigCorreo = {
  proveedor: 'brevo',
  credencial: 'xkeysib-0123456789abcdef0123456789abcdef-ABCD',
  remitente: { nombre: 'Tareas Acme', email: 'tareas@acme.test' },
  marca: { nombre: 'Tareas Acme', url: 'https://tareas.acme.test/', pie: 'Acme S.L.' },
  avisosActivos: false,
};

describe('cifrado de la credencial', () => {
  it('ida y vuelta, y cada cifrado es distinto', () => {
    const a = cifrar('secreto', clave);
    expect(a).not.toContain('secreto');
    expect(a).not.toBe(cifrar('secreto', clave));
    expect(descifrar(a, clave)).toBe('secreto');
  });
  it('con otra clave maestra falla con un mensaje claro', () => {
    expect(() => descifrar(cifrar('secreto', clave), randomBytes(32))).toThrow(ErrorCorreo);
  });
  it('la clave maestra tiene que ser de 32 bytes', () => {
    expect(leerClaveMaestra(clave.toString('base64'))).not.toBeNull();
    expect(leerClaveMaestra(randomBytes(16).toString('base64'))).toBeNull();
    expect(leerClaveMaestra(undefined)).toBeNull();
  });
});

describe('validación de la configuración', () => {
  it('normaliza la URL de la marca y deja pasar una configuración correcta', () => {
    expect(validarCambio(base, false).marca.url).toBe('https://tareas.acme.test');
  });
  it('sin credencial solo vale si hay una guardada', () => {
    expect(() => validarCambio({ ...base, credencial: '' }, false)).toThrow('Falta la clave');
    expect(validarCambio({ ...base, credencial: '' }, true).credencial).toBeNull();
  });
  it('rechaza remitente, respuesta o URL inválidos', () => {
    expect(() => validarCambio({ ...base, remitente: { nombre: 'X', email: 'no-es-email' } }, false)).toThrow('remitente');
    expect(() => validarCambio({ ...base, responderA: 'mal' }, false)).toThrow('respuesta');
    expect(() => validarCambio({ ...base, marca: { ...base.marca, url: 'ftp://x' } }, false)).toThrow('URL');
  });
  it('SMTP exige una URL smtp:// o smtps://', () => {
    expect(() => validarCambio({ ...base, proveedor: 'smtp', credencial: 'https://x' }, false)).toThrow('smtp');
    expect(validarCambio({ ...base, proveedor: 'smtp', credencial: 'smtps://u:clave@smtp.acme.test:465' }, false).proveedor).toBe('smtp');
  });
});

describe('enmascarado', () => {
  it('solo los 4 últimos; en SMTP, de la contraseña', () => {
    expect(enmascarar(finalDeCredencial('brevo', base.credencial!))).toBe('••••ABCD');
    expect(finalDeCredencial('smtp', 'smtps://u:miclave99@smtp.acme.test:465')).toBe('ve99');
    expect(enmascarar(null)).toBeNull();
  });
});

describe('reintentos', () => {
  const t0 = new Date('2026-10-13T10:00:00Z');
  it('esperas crecientes y luego se rinde', () => {
    expect(siguienteIntento(1, t0)!.getTime() - t0.getTime()).toBe(60_000);
    expect(siguienteIntento(2, t0)!.getTime() - t0.getTime()).toBe(5 * 60_000);
    expect(siguienteIntento(MAX_INTENTOS - 1, t0)).not.toBeNull();
    expect(siguienteIntento(MAX_INTENTOS, t0)).toBeNull();
  });
});

describe('plantilla', () => {
  it('escapa lo que viene del usuario', () => {
    const { html, texto } = componer(base.marca, { titulo: '<script>alert(1)</script>', parrafos: ['a & b'], boton: { texto: 'Abrir', url: 'https://x/t/WEB-12' } });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('a &amp; b');
    expect(texto).toContain('Abrir: https://x/t/WEB-12');
  });
});
