# Vortex Intelligence 2.0 — auditoria inicial (06/11/2026)

## Escopo e isolamento
Repositório: andrersbhz/trend-whisperer-18
Branch: feature/vortex-intelligence-audit
Nenhuma alteração na main, nenhuma migração ou deploy executado.
Auditoria estática inicial: inventário da árvore (451 arquivos) e leitura seletiva de arquivos críticos. Não é auditoria exaustiva, nem execução de testes.

## Stack observada
Vite, React 18, TypeScript, React Router, TanStack Query, Tailwind/shadcn, Recharts, Supabase JS, Edge Functions Deno, migrações Supabase e Drizzle, Vitest e Playwright.

## Evidências prioritárias
1. CRÍTICO — supabase/functions/fetch-analytics/index.ts: apesar de exigir property ID GA4, constrói dailyViews pseudoaleatórios com Math.sin e produz indicadores simulados. Não apresentar como Analytics real. Substituir por Google Analytics Data API com autenticação real; até lá sinalizar 'não conectado / dados indisponíveis'.
2. ALTO — supabase/functions/fetch-analytics/index.ts: usa service role e userId fornecido pelo corpo sem verificação explícita de identidade/posse antes de consultar user_settings e articles. Exigir JWT e correspondência com auth.uid(), ou padrão requireUserOrService com autorização robusta.
3. ALTO — supabase/functions/generate-analytics-tips/index.ts: aceita analytics/socialMetrics do corpo sem validar identidade, e gera recomendações potencialmente baseadas em dados arbitrários; ler dados confiáveis no servidor, com autenticação e proveniência.
4. ALTO — supabase/functions/google-search-console-auth/index.ts: getSafeReturnUrl aceita qualquer subdomínio lovable.app, mesmo fora da allowlist; restringir origins autorizadas, inclusive dev, com validação exata.
5. MÉDIO — src/components/settings/GoogleAnalyticsSettings.tsx: considera conectado apenas pelo property ID; isso não comprova OAuth nem consulta API. Exibir status verificado.
6. MÉDIO — src/components/settings/JetpackSettings.tsx: persiste 'connected' em localStorage sem validade temporal; validar status no backend.
7. INTEGRAÇÃO EXISTENTE — supabase/functions/fetch-jetpack-stats/index.ts: usa requireUserOrService, lê credenciais WP e consulta endpoints wpcom/v2; testar compatibilidade com o site e granularidade real antes de substituir.
8. MAPA EXISTENTE — src/components/WorldMap.tsx: consulta RPC get_online_locations(p_minutes:10) a cada 20 segundos e escuta realtime online_users; preservar componente e investigar a origem/precisão da presença.
9. SEGURANÇA OPERACIONAL — .env e .env.development constam no versionamento e .gitignore não os exclui explicitamente. Inspecionar somente nomes de variáveis em ambiente seguro; se houver segredos reais, revogar/rotacionar, remover do histórico e proteger. Não publicar valores em relatórios.
10. UI — src/pages/AnalyticsPage.tsx já contém seções de Jetpack, métricas sociais, Analytics e recomendações. Evoluir por componentes isolados, não reconstruir.

## Plano incremental
Fase A: testes de regressão, verificação de autorização, origem de dados, revisão de segredos e contratos.
Fase B: corrigir dados simulados e estados de conexão; manter fallback explícito sem números inventados.
Fase C: conectores GA4, Search Console, AdSense e Jetpack com autorização, cache e logs; validar disponibilidade de escopos.
Fase D: persistência incremental e painéis por idioma/país, distinguindo métricas e fontes.
Fase E: motor de regras, alertas, relatórios e recomendações baseadas em evidência.
Fase F: testes, PR para revisão; não mesclar/deployar automaticamente.

## Critérios de aceite
- Sem regressão no mapa, publicador, artigos, autenticação ou pagamentos.
- Nenhuma métrica simulada rotulada como real.
- Segredos nunca no frontend, logs ou Git.
- Autorização por usuário em todas as Edge Functions.
- Fontes e timestamps explícitos, falhas e dados indisponíveis visíveis.
- Testes npm run build, npm run lint, npm run test e fluxos Playwright em ambiente isolado.
- Alterações exclusivamente na branch até aprovação de PR.

## Próximas verificações
Inspecionar integralmente as demais Edge Functions, políticas RLS e migrações; testar autenticação e callbacks OAuth; validar compatibilidade de endpoints Jetpack; conferir configurações Supabase e CI. Não afirmar que todas as integrações já funcionam.
