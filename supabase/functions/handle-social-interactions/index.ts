import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId } = await req.json();
    if (!userId) throw new Error("userId is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log(`[handle-social-interactions] Iniciando sincronização para o usuário: ${userId}`);

    // 1. Buscar todas as contas do Facebook conectadas
    const { data: accounts, error: accountsError } = await supabase
      .from("facebook_accounts")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (accountsError) throw accountsError;

    // 2. Fallback para configurações principais se não houver contas específicas
    const { data: settings } = await supabase
      .from("user_settings")
      .select("facebook_page_id, facebook_access_token")
      .eq("user_id", userId)
      .single();

    const allPagesToAnalyze: Array<{ page_id: string; access_token: string; page_name?: string }> = [];

    if (accounts && accounts.length > 0) {
      for (const acc of accounts) {
        allPagesToAnalyze.push({
          page_id: acc.page_id,
          access_token: acc.access_token,
          page_name: acc.page_name
        });
      }
    } else if (settings?.facebook_page_id && settings?.facebook_access_token) {
      allPagesToAnalyze.push({
        page_id: settings.facebook_page_id,
        access_token: settings.facebook_access_token,
        page_name: "Página Principal"
      });
    }

    if (allPagesToAnalyze.length === 0) {
      console.log(`[handle-social-interactions] Nenhuma página conectada encontrada para o usuário ${userId}`);
      return new Response(JSON.stringify({ message: "Nenhuma página conectada encontrada", newInteractions: 0 }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    console.log(`[handle-social-interactions] Analisando ${allPagesToAnalyze.length} páginas para o usuário ${userId}`);

    let totalProcessed = 0;

    // 3. Processar cada página individualmente
    for (const page of allPagesToAnalyze) {
      const { page_id: pageId, access_token: token, page_name: pageName } = page;
      console.log(`[handle-social-interactions] Processando página: ${pageName || pageId} (${pageId})`);

      // Descriptografar token se necessário
      let finalToken = token;
      if (token.startsWith('enc:')) {
        const { data: decryptedToken } = await supabase.rpc("decrypt_credential", { enc_key: "", val: token });
        finalToken = decryptedToken || token;
      }

      try {
        // Buscar o feed de posts (últimos 10 posts para garantir captura de comentários)
        const postsResp = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed?fields=id,message,created_time,permalink_url&limit=10&access_token=${finalToken}`);
        
        if (!postsResp.ok) {
          const errText = await postsResp.text();
          console.error(`[handle-social-interactions] Erro ao buscar feed da página ${pageId}:`, errText);
          continue;
        }

        const posts = await postsResp.json();
        console.log(`[handle-social-interactions] Encontrados ${posts.data?.length || 0} posts no feed da página ${pageId}`);

        for (const post of (posts.data || [])) {
          // Buscar comentários para cada post (aumentado para 20 comentários por post)
          const commentsResp = await fetch(`https://graph.facebook.com/v21.0/${post.id}/comments?fields=id,message,from{name,picture},created_time,permalink_url&limit=20&access_token=${finalToken}`);
          
          if (!commentsResp.ok) {
            const errText = await commentsResp.text();
            console.error(`[handle-social-interactions] Erro ao buscar comentários do post ${post.id}:`, errText);
            continue;
          }

          const comments = await commentsResp.json();
          const commentsList = comments.data || [];
          
          if (commentsList.length > 0) {
            console.log(`[handle-social-interactions] Encontrados ${commentsList.length} comentários no post ${post.id}`);
          }

          for (const comment of commentsList) {
            // Verificar se o comentário já foi processado anteriormente
            const { data: existing } = await supabase
              .from("social_interactions")
              .select("id")
              .eq("external_id", comment.id)
              .maybeSingle();

            if (!existing) {
              // Inserir nova interação social
              const { error: insertError } = await supabase.from("social_interactions").insert({
                user_id: userId,
                platform: "facebook",
                external_id: comment.id,
                page_id: pageId,
                author_name: comment.from?.name || "Seguidor",
                author_avatar: comment.from?.picture?.data?.url,
                content: comment.message,
                original_link: comment.permalink_url || post.permalink_url,
                status: "pending"
              });

              if (insertError) {
                console.error(`[handle-social-interactions] Erro ao inserir comentário ${comment.id}:`, insertError);
              } else {
                totalProcessed++;
              }
            }
          }
        }
      } catch (pageErr) {
        console.error(`[handle-social-interactions] Exceção ao processar página ${pageId}:`, pageErr);
      }
    }

    console.log(`[handle-social-interactions] Sincronização concluída. ${totalProcessed} novas interações salvas.`);

    return new Response(JSON.stringify({ success: true, newInteractions: totalProcessed }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error: any) {
    console.error("[handle-social-interactions] Erro fatal:", error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});