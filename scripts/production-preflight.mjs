import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const fail = (message) => {
  console.error(`\n[PREDEPLOY] ERRO: ${message}`);
  process.exitCode = 1;
};
const ok = (message) => console.log(`[PREDEPLOY] OK: ${message}`);

const requiredFiles = [
  'supabase/config.toml',
  'supabase/migrations/20260818210500_threads_metrics.sql',
  'supabase/functions/_shared/authorize-user.ts',
  'supabase/functions/automation-engine/index.ts',
  'supabase/functions/facebook-oauth-start/index.ts',
  'supabase/functions/facebook-oauth-callback/index.ts',
  'supabase/functions/google-search-console-callback/index.ts',
  'supabase/functions/google-search-console-status/index.ts',
  'supabase/functions/threads-oauth-start/index.ts',
  'supabase/functions/threads-oauth-callback/index.ts',
  'supabase/functions/fetch-threads-metrics/index.ts',
  'supabase/functions/fetch-meta-metrics/index.ts',
  'supabase/functions/publish-social/index.ts',
  'supabase/functions/send-email/index.ts',
  'supabase/functions/handle-social-interactions/index.ts',
  'supabase/functions/handle-instagram-interactions/index.ts',
  'supabase/functions/handle-threads-interactions/index.ts',
  'supabase/functions/process-social-replies/index.ts',
  'supabase/functions/process-human-social-replies/index.ts',
  'supabase/functions/handle-social-growth/index.ts',
  'supabase/functions/create-checkout/index.ts',
  'supabase/functions/create-portal-session/index.ts',
];

for (const file of requiredFiles) {
  if (!existsSync(resolve(root, file))) fail(`arquivo obrigatório ausente: ${file}`);
}
if (!process.exitCode) ok(`${requiredFiles.length} arquivos críticos encontrados`);

const configPath = resolve(root, 'supabase/config.toml');
if (existsSync(configPath)) {
  const config = readFileSync(configPath, 'utf8');
  const expectedProject = 'bvvhgwkjyfnjroudtbav';
  if (!config.includes(`project_id = "${expectedProject}"`)) {
    fail(`supabase/config.toml não aponta para o projeto esperado ${expectedProject}`);
  } else {
    ok(`project_id confirmado: ${expectedProject}`);
  }

  const publicFunctions = [
    'facebook-oauth-callback',
    'threads-oauth-callback',
    'google-search-console-callback',
    'automation-engine',
    'google-search-console-status',
    'send-email',
  ];

  for (const fn of publicFunctions) {
    const escaped = fn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\[functions\\.${escaped}\\]\\s*\\nverify_jwt\\s*=\\s*false`);
    if (!re.test(config)) fail(`${fn} precisa estar explicitamente com verify_jwt = false no config.toml`);
  }
  if (!process.exitCode) ok('callbacks e endpoints públicos têm configuração JWT explícita');
}

const migrationPath = resolve(root, 'supabase/migrations/20260818210500_threads_metrics.sql');
if (existsSync(migrationPath)) {
  const migration = readFileSync(migrationPath, 'utf8');
  if (!migration.includes('add column if not exists last_metrics') || !migration.includes('add column if not exists metrics_updated_at')) {
    fail('migration de métricas Threads não está idempotente como esperado');
  } else {
    ok('migration Threads usa ADD COLUMN IF NOT EXISTS');
  }
}

const criticalFunctionFiles = requiredFiles.filter((file) => file.startsWith('supabase/functions/'));
for (const file of criticalFunctionFiles) {
  const content = readFileSync(resolve(root, file), 'utf8');
  if (/connector-gateway\.lovable\.dev|LOVABLE_API_KEY/.test(content)) {
    fail(`dependência operacional do Lovable encontrada em função crítica: ${file}`);
  }
}
if (!process.exitCode) ok('nenhuma função crítica depende do gateway/créditos do Lovable');

const startThreads = readFileSync(resolve(root, 'supabase/functions/threads-oauth-start/index.ts'), 'utf8');
for (const scope of ['threads_basic', 'threads_content_publish', 'threads_manage_insights']) {
  if (!startThreads.includes(scope)) fail(`escopo Threads obrigatório ausente: ${scope}`);
}
if (!process.exitCode) ok('escopos Threads para perfil, publicação e insights encontrados');

if (process.exitCode) {
  console.error('\n[PREDEPLOY] BLOQUEADO. Corrija os erros antes do deploy.');
  process.exit(process.exitCode);
}

console.log('\n[PREDEPLOY] APROVADO. Estrutura crítica pronta para deploy.');
