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

    console.log(`[handle-social-growth] Iniciando ciclo de crescimento para usuário: ${userId}`);

    // 1. Buscar configurações do usuário
    const { data: settings, error: settingsError } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (settingsError || !settings) throw new Error("Settings not found");
    if (!settings.follower_growth_mode) {
      return new Response(JSON.stringify({ message: "Modo crescimento desativado" }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const {
      instagram_follows_per_day_min: minFollows = 2,
      instagram_follows_per_day_max: maxFollows = 8,
      instagram_follow_duration_min: minDays = 6,
      instagram_follow_duration_max: maxDays = 10,
      instagram_automation_human_like: humanLike = true
    } = settings;

    // 2. Lógica de UNFOLLOW (Deixar de seguir)
    // Buscar pessoas que seguimos há mais de X dias
    const { data: toUnfollow, error: unfollowError } = await supabase
      .from("social_follows")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "following");

    if (unfollowError) console.error("Erro ao buscar unfollows:", unfollowError);

    let unfollowedCount = 0;
    const now = new Date();

    if (toUnfollow && toUnfollow.length > 0) {
      for (const follow of toUnfollow) {
        const followedDate = new Date(follow.followed_at);
        // Calculamos um tempo aleatório entre minDays e maxDays para cada pessoa
        // Para simplificar, usamos uma semente baseada no ID para ser consistente ou apenas o minDays
        const daysDiff = Math.floor((now.getTime() - followedDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Decidimos aleatoriamente se deixamos de seguir hoje se estiver no range, 
        // ou obrigatoriamente se passar do maxDays
        const targetDays = humanLike ? (Math.floor(Math.random() * (maxDays - minDays + 1)) + minDays) : minDays;

        // Proteção: nunca deixar de seguir contas que já são conexões há mais de 6 meses (180 dias)
        const LOYAL_THRESHOLD_DAYS = 180;
        if (daysDiff >= LOYAL_THRESHOLD_DAYS) {
          console.log(`[handle-social-growth] Mantendo ${follow.target_username} (conexão leal: ${daysDiff} dias)`);
          continue;
        }

        if (daysDiff >= targetDays) {
          console.log(`[handle-social-growth] Deixando de seguir: ${follow.target_username} (${daysDiff} dias)`);
          
          // Simulação de unfollow (Já que a API oficial não permite, registramos a intenção/ação simulada)
          await supabase.from("social_follows").update({
            status: 'unfollowed',
            unfollowed_at: now.toISOString()
          }).eq("id", follow.id);

          await supabase.from("automation_logs").insert({
            user_id: userId,
            level: 'info',
            module: 'growth',
            message: `Robô deixou de seguir ${follow.target_username || follow.target_external_id} após ${daysDiff} dias.`,
            details: { action: 'unfollow', target: follow.target_username, duration: daysDiff }
          });
          unfollowedCount++;
        }
      }
    }

    // 3. Lógica de FOLLOW (Seguir novas pessoas)
    // Verificar quantos seguimos hoje
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { count: followedToday } = await supabase
      .from("social_follows")
      .select("*", { count: 'exact', head: true })
      .eq("user_id", userId)
      .gte("followed_at", startOfDay.toISOString());

    const targetFollows = Math.floor(Math.random() * (maxFollows - minFollows + 1)) + minFollows;
    const remainingToFollow = targetFollows - (followedToday || 0);

    let followedCount = 0;
    if (remainingToFollow > 0) {
      console.log(`[handle-social-growth] Meta hoje: ${targetFollows}. Já seguiu: ${followedToday}. Restante: ${remainingToFollow}`);
      
      // Buscar potenciais alvos (Pessoas que interagiram com a gente mas ainda não seguimos)
      const { data: interactions } = await supabase
        .from("social_interactions")
        .select("author_name, author_avatar, external_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);

      const potentialTargets = interactions || [];
      
      // Filtrar quem já seguimos
      const { data: alreadyFollowed } = await supabase
        .from("social_follows")
        .select("target_external_id")
        .eq("user_id", userId);
      
      const followedSet = new Set((alreadyFollowed || []).map(f => f.target_external_id));
      const targets = potentialTargets.filter(t => !followedSet.has(t.external_id)).slice(0, remainingToFollow);

      for (const target of targets) {
        // Simulação de Follow
        await supabase.from("social_follows").insert({
          user_id: userId,
          platform: 'instagram',
          target_external_id: target.external_id,
          target_username: target.author_name,
          target_avatar: target.author_avatar,
          status: 'following',
          followed_at: now.toISOString()
        });

        await supabase.from("automation_logs").insert({
          user_id: userId,
          level: 'info',
          module: 'growth',
          message: `Robô começou a seguir ${target.author_name} (Forma humana ativada 👤)`,
          details: { action: 'follow', target: target.author_name }
        });
        followedCount++;
        
        // Se humanLike, adicionamos um delay pequeno entre as ações (apenas log/simulação aqui)
        if (humanLike) {
           console.log(`[handle-social-growth] Delay humano entre follows...`);
           // Em uma função edge, não queremos dar sleep longo, mas podemos processar sequencialmente
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      followed: followedCount, 
      unfollowed: unfollowedCount,
      targetToday: targetFollows
    }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error: any) {
    console.error("[handle-social-growth] Erro:", error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});