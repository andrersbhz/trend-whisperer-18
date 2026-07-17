
# Plano: SaaS completo com pagamento híbrido, licença e notificações

## Decisões travadas (já respondidas)
- **Provedor**: Stripe (cartão internacional) + Mercado Pago (Pix BR)
- **Modelo**: Assinatura mensal → chave ativa enquanto pago; cancelou/falhou → chave revogada no fim do período
- **Trial**: nenhum — cobrar já no checkout
- **Notificações**: E-mail (admin + cliente com a chave) + in-app realtime + WhatsApp (Twilio) para admin

---

## Fase 1 — Backend de produtos e assinatura Stripe

1. **Criar 2 produtos no Stripe** via `batch_create_product`:
   - `starter_monthly` — R$ 197/mês
   - `pro_monthly` — R$ 497/mês
   - (Enterprise fica como "Falar com vendas" — abre WhatsApp/email)

2. **Shared utility** `supabase/functions/_shared/stripe.ts` com `createStripeClient` + `verifyWebhook` (padrão Lovable).

3. **Edge function `create-checkout`** (Stripe Embedded) — recebe `priceId`, cria Customer com `metadata.userId`, retorna `clientSecret`. `verify_jwt=false`.

4. **Edge function `payments-webhook`** — escuta `customer.subscription.created/updated/deleted` + `checkout.session.completed`; grava em `subscriptions` e **gera license_key automaticamente** na criação; revoga (`status='expired'`) no `deleted`.

5. **Edge function `create-portal-session`** — abre Stripe Billing Portal para o cliente cancelar/trocar cartão.

## Fase 2 — Backend Pix via Mercado Pago

1. **Conectar Mercado Pago** — pedir `MP_ACCESS_TOKEN` (secret).
2. **Edge function `mp-create-pix`** — cria cobrança Pix (QR + copia-e-cola), retorna dados pro frontend renderizar.
3. **Edge function `mp-webhook`** — recebe notificação MP, valida via API, gera license_key + assinatura mensal manual (renovação Pix precisa ação do cliente todo mês → salva `next_charge_at`).
4. **Cron mensal** — 3 dias antes do vencimento manda email lembrando de renovar via novo Pix.

## Fase 3 — Geração de licença + notificações

1. **Função DB `create_license_after_payment(email, plan, amount, method, external_id)`** — gera chave via `generate_license_key`, insere em `license_keys` com `expires_at=now()+30d`, insere em `sale_notifications`, retorna a chave.
2. **Edge function `send-sale-notifications`** — dispara em paralelo:
   - E-mail admin (via Lovable Emails — precisa domínio configurado depois)
   - E-mail cliente com a chave + link `/ativar`
   - WhatsApp admin via Twilio (se conectado)
3. **Realtime in-app** — `AdminSalesPage` já lê `sale_notifications`; adiciono subscription realtime + toast + som.

## Fase 4 — Frontend

1. **`SalesPage`**: botões dos planos abrem modal `<CheckoutModal>` com abas **Cartão (Stripe)** | **Pix (MP)**. Enterprise = mailto/WhatsApp.
2. **`CheckoutModal`**: form email/nome/telefone → chama edge function conforme aba → mostra `EmbeddedCheckout` ou QR Pix + status polling.
3. **`CheckoutReturn`** (`/checkout/return`): confirma pagamento, mostra a chave gerada + botão "Ativar agora".
4. **`AdminSalesPage`**: realtime subscription + badge não-lidas + botão "Reenviar chave" + filtro por status.
5. **`PaymentMethodsPage`**: adicionar campos MP access token + status Twilio + toggles de canais de notificação.

## Fase 5 — Correções de segurança

1. **Criptografar** `payment_methods_config.mercadopago_access_token` e `pagarme_api_key` com o mesmo padrão pgcrypto de `user_settings`.
2. **RLS**: garantir que só super_admin lê `payment_methods_config` e `sale_notifications`.
3. **Rate-limit** simples nas edge functions públicas (`create-checkout`, `mp-create-pix`) — 5 req/min por IP em memória.

## Fase 6 — Como testar no preview

**Cartão Stripe (sandbox):**
- Sucesso: `4242 4242 4242 4242`, validade `12/34`, CVC `123`
- Recusa: `4000 0000 0000 0002`
- 3DS: `4000 0025 0000 3155`

**Pix MP (sandbox):**
- Access token de sandbox (Painel MP → Credenciais de teste)
- QR gerado é fake; simula aprovação via botão "Simular pagamento" no painel MP sandbox

**Fluxo completo:**
1. Acesse `/vendas` → clique **Assinar Pro** → aba **Cartão** → cartão de teste → aprovado → recebe chave na tela + email
2. Copie a chave → `/ativar` → cola → entra no `/admin`
3. Abra outra aba anônima → `/ativar` mesma chave → primeira sessão é deslogada
4. `/admin/vendas` → veja a venda em tempo real com toast
5. `/admin/pagamentos` → Stripe Portal → cancelar → após período, chave vira `expired` (webhook)

---

## Detalhes técnicos

- **Tabelas novas**: nenhuma — reuso `subscriptions`, `license_keys`, `sale_notifications`, `payment_methods_config` já existentes.
- **Ajustes de schema**: adicionar `payment_methods_config.mp_webhook_secret`, `sale_notifications.stripe_session_id`, `license_keys.stripe_subscription_id` (nullable) para ligar renovação → revogação.
- **Novas secrets**: `MP_ACCESS_TOKEN` (Mercado Pago), `TWILIO_API_KEY` (já suportado via connector), `PAYMENTS_SANDBOX_WEBHOOK_SECRET` (já existe).
- **Enterprise**: não entra no Stripe; botão abre `mailto:` com template pré-preenchido.
- **Renovação Pix**: MP não faz débito recorrente automático em Pix — modelo será "assinatura mensal com novo Pix a cada ciclo" (email de lembrete + botão renovar).

---

## Ordem de execução
1. Migração de schema (fase 5.1 + ajustes fase 1) — 1 migration
2. Backend Stripe (fase 1) — shared/checkout/webhook/portal
3. Backend MP (fase 2) — create-pix + webhook
4. Notificações (fase 3)
5. Frontend (fase 4)
6. Instruções de teste

Ao aprovar, começo pela **fase 1** e vou pedindo secrets/conectores conforme necessário (MP token e Twilio no meio do caminho).
