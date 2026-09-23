#!/usr/bin/env node
/**
 * Da de alta (o actualiza) el webhook de Tareas en todos los repos de una cuenta de GitHub, para que los
 * commits y PRs que mencionen una tarea (COOL-32…) se comenten en ella.
 *
 *   GITHUB_TOKEN=… GITHUB_WEBHOOK_SECRET=… node scripts/github-webhooks.mjs [--owner PabloS-coolway] [--solo tareas,automatizaciones] [--seco]
 *
 * - GITHUB_TOKEN: de la cuenta dueña de los repos, con permiso de administrar webhooks (admin:repo_hook).
 *   Con `gh`:  GITHUB_TOKEN=$(gh auth token)  estando logueado como esa cuenta.
 * - GITHUB_WEBHOOK_SECRET: el MISMO que tiene la API en producción.
 * - Idempotente: si el repo ya tiene el webhook (misma URL) sólo le actualiza el secreto y los eventos.
 * - --seco: enseña qué haría sin tocar nada.
 */
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const owner = opt('owner', 'PabloS-coolway');
const solo = opt('solo', '')?.split(',').filter(Boolean);
const seco = args.includes('--seco');
const url = opt('url', 'https://tareas-yorga-ewv2n.ondigitalocean.app/api/integrations/github');
const token = process.env.GITHUB_TOKEN;
const secret = process.env.GITHUB_WEBHOOK_SECRET;
if (!token || !secret) {
  console.error('Faltan GITHUB_TOKEN y/o GITHUB_WEBHOOK_SECRET.');
  process.exit(1);
}

const gh = async (path, init = {}) => {
  const r = await fetch(`https://api.github.com${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(init.headers ?? {}) } });
  if (!r.ok) throw new Error(`${init.method ?? 'GET'} ${path} → ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
};

const repos = [];
for (let page = 1; ; page++) {
  const lote = await gh(`/user/repos?affiliation=owner,organization_member&per_page=100&page=${page}`);
  repos.push(...lote.filter((r) => r.owner.login === owner && !r.archived));
  if (lote.length < 100) break;
}
const elegidos = solo?.length ? repos.filter((r) => solo.includes(r.name)) : repos;
console.log(`${elegidos.length} repos de ${owner}${seco ? ' (en seco)' : ''}`);

const config = { url, content_type: 'json', secret, insecure_ssl: '0' };
for (const r of elegidos) {
  try {
    const hooks = await gh(`/repos/${r.full_name}/hooks`);
    const ya = hooks.find((h) => h.config?.url === url);
    if (seco) {
      console.log(`  ${r.name}: ${ya ? 'actualizaría' : 'crearía'}`);
      continue;
    }
    if (ya) await gh(`/repos/${r.full_name}/hooks/${ya.id}`, { method: 'PATCH', body: JSON.stringify({ config, events: ['push', 'pull_request'], active: true }) });
    else await gh(`/repos/${r.full_name}/hooks`, { method: 'POST', body: JSON.stringify({ name: 'web', config, events: ['push', 'pull_request'], active: true }) });
    console.log(`  ✅ ${r.name}: ${ya ? 'actualizado' : 'creado'}`);
  } catch (e) {
    console.log(`  ❌ ${r.name}: ${e.message.slice(0, 160)}`);
  }
}
