/**
 * Claves de tarea mencionadas en un texto de git (mensaje de commit, título o cuerpo de una PR):
 * «Arregla la guía (COOL-32)», «TAREAS-6: seguidores»… Sólo las de proyectos que existen, sin repetir,
 * en el orden en que aparecen. Mayúsculas, como se escriben las claves.
 */
export function clavesEnTexto(texto: string, proyectos: string[]): string[] {
  const validos = new Set(proyectos);
  const out: string[] = [];
  for (const m of texto.matchAll(/(?<![A-Za-z0-9-])([A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*)-(\d+)(?![A-Za-z0-9])/g)) {
    const clave = `${m[1]}-${Number(m[2])}`;
    if (validos.has(m[1]) && !out.includes(clave)) out.push(clave);
  }
  return out;
}

/** Primera línea del mensaje, recortada (lo que se enseña en el comentario). */
export function primeraLinea(mensaje: string, max = 140): string {
  const l = (mensaje ?? '').split('\n')[0].trim();
  return l.length > max ? `${l.slice(0, max - 1)}…` : l;
}

export interface RefGit {
  kind: string;
  ref: string;
  url: string;
  title: string;
  repo: string;
  branch: string | null;
  author: string | null;
  number: number | null;
  at: Date | null;
  createdAt: Date;
}

/**
 * Panel «Desarrollo» a partir de lo guardado: ramas, commits (lo más reciente primero) y PRs (una por número,
 * «mergeada» si llegó el merge). Las ramas incluyen las de los commits y PRs aunque no se guardaran aparte.
 */
export function resumenDesarrollo(refs: RefGit[]) {
  const cuando = (r: RefGit) => (r.at ?? r.createdAt).getTime();
  const ordenadas = [...refs].sort((a, b) => cuando(b) - cuando(a));

  const ramas = new Map<string, { repo: string; name: string; url: string }>();
  const ponerRama = (repo: string, name: string | null) => {
    if (!name || !repo) return;
    const k = `${repo}:${name}`;
    if (!ramas.has(k)) ramas.set(k, { repo, name, url: `https://github.com/${repo}/tree/${name}` });
  };

  const commits = ordenadas
    .filter((r) => r.kind === 'commit')
    .map((r) => ({ repo: r.repo, sha: r.ref.split('@')[1] ?? '', message: r.title, url: r.url, author: r.author, branch: r.branch, at: (r.at ?? r.createdAt).toISOString() }));

  const prs = new Map<string, { repo: string; number: number; title: string; url: string; state: 'open' | 'merged'; branch: string | null; author: string | null; at: string | null }>();
  for (const r of ordenadas.filter((x) => x.kind === 'pr-opened' || x.kind === 'pr-merged')) {
    const previa = prs.get(r.ref);
    const merged = r.kind === 'pr-merged' || previa?.state === 'merged';
    prs.set(r.ref, {
      repo: r.repo,
      number: r.number ?? Number(r.ref.split('#')[1]),
      title: r.title,
      url: r.url,
      state: merged ? 'merged' : 'open',
      branch: previa?.branch ?? r.branch,
      author: previa?.author ?? r.author,
      at: previa?.at ?? (r.at ?? r.createdAt).toISOString(),
    });
  }

  for (const r of ordenadas) {
    if (r.kind === 'branch') ponerRama(r.repo, r.branch ?? r.ref.split(':').slice(1).join(':'));
    else ponerRama(r.repo, r.branch);
  }
  return { branches: [...ramas.values()], commits, pullRequests: [...prs.values()] };
}

/** Nombre de rama sugerido: «feat/COOL-32-guia-de-tallas» (sin acentos, corto). */
export function nombreDeRama(clave: string, titulo: string, tipo: 'feat' | 'fix' = 'feat'): string {
  const slug = titulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .split('-')
    .slice(0, 6)
    .join('-');
  return `${tipo}/${clave}${slug ? `-${slug}` : ''}`;
}
