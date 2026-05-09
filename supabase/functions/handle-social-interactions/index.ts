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
        // 1. Buscar o feed de posts (últimos 5 posts para performance, já que estamos adicionando reações)
        const postsResp = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed?fields=id,message,created_time,permalink_url&limit=5&access_token=${finalToken}`);
        
        if (!postsResp.ok) {
          const errText = await postsResp.text();
          console.error(`[handle-social-interactions] Erro ao buscar feed da página ${pageId}:`, errText);
          continue;
        }

        const posts = await postsResp.json();
        const postsList = posts.data || [];
        console.log(`[handle-social-interactions] Encontrados ${postsList.length} posts no feed da página ${pageId}`);

        for (const post of postsList) {
          // A. BUSCAR COMENTÁRIOS
          const commentsResp = await fetch(`https://graph.facebook.com/v21.0/${post.id}/comments?fields=id,message,from{name,picture},created_time,permalink_url&limit=15&access_token=${finalToken}`);
          
          if (commentsResp.ok) {
            const comments = await commentsResp.json();
            const commentsList = comments.data || [];
            
            for (const comment of commentsList) {
              const { data: existing } = await supabase
                .from("social_interactions")
                .select("id")
                .eq("external_id", comment.id)
                .maybeSingle();

              if (!existing) {
                const { error: insertError } = await supabase.from("social_interactions").insert({
                  user_id: userId,
                  platform: "facebook",
                  external_id: comment.id,
                  page_id: pageId,
                  author_name: comment.from?.name || "Seguidor",
                  author_avatar: comment.from?.picture?.data?.url,
                  content: comment.message,
                  original_link: comment.permalink_url || post.permalink_url,
                  status: "pending",
                  interaction_type: "comment"
                });

                if (!insertError) totalProcessed++;
              }
            }
          }

          // B. BUSCAR REAÇÕES (LIKES)
          const reactionsResp = await fetch(`https://graph.facebook.com/v21.0/${post.id}/reactions?fields=id,name,type,pic_large&limit=10&access_token=${finalToken}`);
          
          if (reactionsResp.ok) {
            const reactions = await reactionsResp.json();
            const reactionsList = reactions.data || [];

            for (const reaction of reactionsList) {
              // ID da reação no Facebook é composto por post_id + user_id
              const reactionId = `${post.id}_${reaction.id}`;
              
              const { data: existing } = await supabase
                .from("social_interactions")
                .select("id")
                .eq("external_id", reactionId)
                .maybeSingle();

              if (!existing) {
                const { error: insertError } = await supabase.from("social_interactions").insert({
                  user_id: userId,
                  platform: "facebook",
                  external_id: reactionId,
                  page_id: pageId,
                  author_name: reaction.name,
                  author_avatar: reaction.pic_large,
                  content: `Reagiu com ${reaction.type} ao seu post`,
                  original_link: post.permalink_url,
                  status: "processed", // Curtidas geralmente não precisam de resposta do robô, mas salvamos para histórico/análise
                  interaction_type: "reaction"
                });

                if (!insertError) totalProcessed++;
              }
            }
          }
        }

        // 2. BUSCAR MENÇÕES À PÁGINA (Tagged posts)
        const taggedResp = await fetch(`https://graph.facebook.com/v21.0/${pageId}/tagged?fields=id,message,from{name,picture},created_time,permalink_url&limit=5&access_token=${finalToken}`);
        
        if (taggedResp.ok) {
          const tagged = await taggedResp.json();
          const taggedList = tagged.data || [];
          
          for (const tag of taggedList) {
            const { data: existing } = await supabase
              .from("social_interactions")
              .select("id")
              .eq("external_id", tag.id)
              .maybeSingle();

            if (!existing) {
              const { error: insertError } = await supabase.from("social_interactions").insert({
                user_id: userId,
                platform: "facebook",
                external_id: tag.id,
                page_id: pageId,
                author_name: tag.from?.name || "Usuário",
                author_avatar: tag.from?.picture?.data?.url,
                content: tag.message || "Mencionou sua página em uma publicação",
                original_link: tag.permalink_url,
                status: "pending",
                interaction_type: "mention"
              });

              if (!insertError) totalProcessed++;
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