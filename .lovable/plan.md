O sistema atualmente está conectado ao Google Analytics para métricas, mas ainda não possui a integração com a **Google Indexing API** para solicitar a indexação imediata de novos posts.

Vou implementar essa funcionalidade para que, assim que um artigo for publicado no WordPress, o sistema envie automaticamente uma solicitação de indexação ao Google.

### Alterações Propostas

#### 1. Banco de Dados (Migração)
*   Adicionar coluna `google_indexing_key` na tabela `user_settings` para armazenar a chave JSON da conta de serviço do Google.
*   Garantir que este campo seja protegido (revogar acesso direto via SELECT e usar criptografia como os outros campos sensíveis).

#### 2. Interface (Frontend)
*   Criar o componente `GoogleIndexingSettings.tsx` para permitir que o usuário cole a chave JSON da conta de serviço do Google.
*   Adicionar este componente na página de Configurações, logo abaixo de Google Analytics.

#### 3. Backend (Edge Function)
*   Modificar a função `publish-article` para:
    *   Verificar se a `google_indexing_key` está configurada.
    *   Se estiver, após a publicação bem-sucedida no WordPress, realizar a chamada para a Google Indexing API (`https://indexing.googleapis.com/v1/urlNotifications:publish`).
    *   Registrar o resultado (sucesso ou erro) nos logs de automação.

### Requisitos para o Usuário
Para que funcione, o usuário precisará:
1.  Criar uma conta de serviço no Google Cloud.
2.  Baixar a chave JSON.
3.  Adicionar o e-mail da conta de serviço como "Proprietário" no Google Search Console do site.
4.  Ativar a "Indexing API" no console do Google Cloud.

Deseja que eu prossiga com essa implementação?
