#!/usr/bin/env node
/** Comprueba las dependencias de SISTEMA (las que `npm install` NO trae). */
import { execFileSync } from 'node:child_process';

const REQUISITOS = [
  { bin: 'docker', args: ['--version'], para: 'levantar la Postgres local', instalar: 'https://docs.docker.com/engine/install/' },
];

const falta = (r) => {
  try {
    execFileSync(r.bin, r.args, { stdio: 'ignore' });
    return false;
  } catch (err) {
    return err.code === 'ENOENT';
  }
};

const ausentes = REQUISITOS.filter(falta);
if (ausentes.length === 0) {
  console.log(`✓ Dependencias de sistema OK (${REQUISITOS.map((r) => r.bin).join(', ')})`);
  process.exit(0);
}
console.error('\n✖ Faltan dependencias de sistema:\n');
for (const r of ausentes) console.error(`  · ${r.bin} — para ${r.para}\n    instalar: ${r.instalar}\n`);
process.exit(1);
