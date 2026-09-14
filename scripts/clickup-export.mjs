#!/usr/bin/env node
/**
 * Exporta TODO el workspace de ClickUp (listas, estados, tareas con subtareas, comentarios y adjuntos)
 * a un JSON que entiende el import de la app (Proyectos → «Importar de ClickUp»).
 *
 *   CLICKUP_TOKEN=pk_xxx node scripts/clickup-export.mjs
 *
 * Variables:
 *   CLICKUP_TOKEN     token personal (ClickUp → Settings → Apps → API Token). Obligatorio.
 *   CLICKUP_TEAM_ID   workspace (por defecto 90121903813, Grupo Yorga).
 *   OUT               fichero de salida (por defecto docs/import/clickup-export.json, gitignored).
 *   LISTS             ids de lista separados por coma para exportar sólo esas.
 *   SKIP_DETAILS      "1" para no pedir el detalle por tarea (sin adjuntos ni descripción completa; mucho más rápido).
 *   THROTTLE_MS       espera entre llamadas (por defecto 650 ms: el plan gratuito permite 100/min).
 *
 * Es incremental: si el fichero de salida ya existe, las listas ya exportadas no se vuelven a pedir.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const TOKEN = process.env.CLICKUP_TOKEN;
const TEAM = process.env.CLICKUP_TEAM_ID ?? '90121903813';
const OUT = process.env.OUT ?? 'docs/import/clickup-export.json';
const LISTS = (process.env.LISTS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const SKIP_DETAILS = process.env.SKIP_DETAILS === '1';
const THROTTLE = Number(process.env.THROTTLE_MS ?? 650);
const API = 'https://api.clickup.com/api/v2';

if (!TOKEN) {
  console.error('Falta CLICKUP_TOKEN (Settings → Apps → API Token en ClickUp).');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let llamadas = 0;

async function get(path, intento = 0) {
  await sleep(THROTTLE);
  llamadas++;
  const res = await fetch(`${API}${path}`, { headers: { Authorization: TOKEN } });
  if (res.status === 429 && intento < 5) {
    const espera = Number(res.headers.get('retry-after') ?? 30) * 1000;
    console.warn(`  · límite de peticiones; espero ${espera / 1000}s`);
    await sleep(espera);
    return get(path, intento + 1);
  }
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

async function cargarPrevio() {
  try {
    return JSON.parse(await readFile(OUT, 'utf8'));
  } catch {
    return null;
  }
}

async function guardar(data) {
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(data, null, 1));
}

async function tareasDeLista(listId) {
  const tareas = [];
  for (let page = 0; ; page++) {
    const r = await get(`/list/${listId}/task?archived=false&include_closed=true&subtasks=true&include_markdown_description=true&page=${page}`);
    tareas.push(...(r.tasks ?? []));
    if (r.last_page || !r.tasks?.length) break;
  }
  return tareas;
}

async function main() {
  const previo = await cargarPrevio();
  const salida = previo ?? { exportedAt: new Date().toISOString(), team: { id: TEAM }, members: [], lists: [] };
  const hechas = new Set(salida.lists.map((l) => l.id));

  // Miembros del workspace
  const teams = await get('/team');
  const team = (teams.teams ?? []).find((t) => String(t.id) === String(TEAM));
  if (!team) throw new Error(`No veo el workspace ${TEAM} con este token. Disponibles: ${(teams.teams ?? []).map((t) => `${t.id} (${t.name})`).join(', ')}`);
  salida.team = { id: String(team.id), name: team.name };
  salida.members = (team.members ?? []).map((m) => ({ id: m.user.id, username: m.user.username, email: m.user.email }));
  console.log(`Workspace ${team.name}: ${salida.members.length} miembros`);

  // Listas: en carpetas y sueltas, de todos los espacios
  const listas = [];
  const spaces = await get(`/team/${TEAM}/space?archived=false`);
  for (const s of spaces.spaces ?? []) {
    const folders = await get(`/space/${s.id}/folder?archived=false`);
    for (const f of folders.folders ?? []) for (const l of f.lists ?? []) listas.push({ id: String(l.id), name: l.name, statuses: l.statuses, folder: f.name, space: s.name });
    const sueltas = await get(`/space/${s.id}/list?archived=false`);
    for (const l of sueltas.lists ?? []) listas.push({ id: String(l.id), name: l.name, statuses: l.statuses, folder: null, space: s.name });
  }
  const objetivo = LISTS.length ? listas.filter((l) => LISTS.includes(l.id)) : listas;
  console.log(`Listas: ${objetivo.map((l) => `${l.name} (${l.id})`).join(' · ')}`);

  for (const l of objetivo) {
    if (hechas.has(l.id)) {
      console.log(`- ${l.name}: ya exportada, se salta (borra ${OUT} para rehacer)`);
      continue;
    }
    console.log(`- ${l.name}: descargando tareas…`);
    const tareas = await tareasDeLista(l.id);
    console.log(`  ${tareas.length} tareas`);
    const completas = [];
    for (const [i, t] of tareas.entries()) {
      let detalle = t;
      let comments = [];
      if (!SKIP_DETAILS) {
        try {
          detalle = await get(`/task/${t.id}?include_markdown_description=true`);
        } catch (e) {
          console.warn(`  · detalle de ${t.id} falló: ${e.message}`);
        }
        try {
          comments = (await get(`/task/${t.id}/comment`)).comments ?? [];
        } catch (e) {
          console.warn(`  · comentarios de ${t.id} fallaron: ${e.message}`);
        }
      }
      completas.push({
        id: t.id,
        name: t.name,
        description: detalle.description ?? t.description ?? null,
        markdown_description: detalle.markdown_description ?? t.markdown_description ?? null,
        status: t.status,
        orderindex: t.orderindex,
        date_created: t.date_created,
        date_updated: t.date_updated,
        date_closed: t.date_closed,
        due_date: t.due_date,
        start_date: t.start_date,
        creator: t.creator,
        assignees: t.assignees,
        tags: t.tags,
        parent: t.parent,
        priority: t.priority,
        url: t.url,
        attachments: (detalle.attachments ?? []).map((a) => ({ id: a.id, title: a.title, url: a.url, mimetype: a.mimetype, size: a.size, date: a.date })),
        comments: comments.map((c) => ({ id: c.id, comment_text: c.comment_text, user: c.user, date: c.date })),
        list: { id: l.id, name: l.name },
      });
      if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${tareas.length}`);
    }
    salida.lists.push({ id: l.id, name: l.name, folder: l.folder, space: l.space, statuses: l.statuses ?? [], tasks: completas });
    await guardar(salida); // incremental: si algo falla, lo hecho queda guardado
  }
  salida.exportedAt = new Date().toISOString();
  await guardar(salida);
  const total = salida.lists.reduce((n, l) => n + l.tasks.length, 0);
  console.log(`\nListo: ${salida.lists.length} listas, ${total} tareas → ${OUT} (${llamadas} llamadas a la API)`);
}

main().catch((e) => {
  console.error(`\n✖ ${e.message}`);
  process.exit(1);
});
