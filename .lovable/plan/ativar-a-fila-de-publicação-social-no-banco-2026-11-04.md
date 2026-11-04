# Ativar a fila de publicação social no banco

## Problema confirmado
A rotina que publica as postagens agendadas nas redes sociais falha a cada 15 minutos. O motivo é maior que o relatado: no banco ao vivo não existe nenhuma parte da fila social. Faltam as tabelas de fila, modelos, planejador e campanhas, e falta também a função que pega o próximo item da fila. Três atualizações do banco que estão no projeto nunca foram aplicadas.

## O que será feito
1. Aplicar, nesta ordem, as três atualizações que faltam:
   - fila, modelos e planejador (14/08)
   - central de distribuição e campanhas (14/08)
   - reforço de confiabilidade, com a nova função da fila (20/09)
2. Ajustar só o necessário para que funcionem no banco atual: permissões de acesso em cada tabela nova e vínculo de usuário sem ligação direta à tabela interna de contas.
3. Conferir que a função existe no formato que o código usa e chamar a rotina uma vez para ver se ela responde sem erro.

## Detalhes técnicos
- Migrations: `20260814133000_social_publisher_planner_queue.sql`, `20260814150000_autopostwp_v1_5_distribution_hub.sql`, `20260920204658_harden_social_distribution.sql`.
- Todas usam `if not exists` / `create or replace`, então são aditivas. A de 20/09 cria `claim_next_social_job(p_user_id uuid default null)`, que é o formato chamado em `process-social-queue/index.ts:38`.
- Adicionar `GRANT ... TO service_role` nas tabelas novas e remover as FKs `references auth.users`, mantendo `user_id uuid not null`.
- Nenhuma alteração no código das funções.
