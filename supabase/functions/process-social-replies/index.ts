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
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1. Get pending interactions
    const { data: interactions } = await supabase
      .from("social_interactions")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "pending")
      .limit(5);

    if (!interactions || interactions.length === 0) {
      return new Response(JSON.stringify({ message: "No pending interactions" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Get AI Settings
    const { data: settings } = await supabase.from("user_settings").select("*").eq("user_id", userId).single();
    
    let totalReplied = 0;

    for (const item of interactions) {
      // 3. Generate response using AI (Simplified, calling another function or logic)
      const prompt = `Você é um gestor de redes sociais humano e empático. 
      Comentário de ${item.author_name}: "${item.content}"
      Responda de forma curta, natural e amigável. Não use hashtags e não pareça um robô.`;

      // Simulating AI call here for brevity, in practice use existing AI provider logic
      const aiResponse = "Obrigado pelo seu comentário! Ficamos felizes com sua interação."; // Placeholder

      // 4. Post back to Meta API
      // fetch(`https://graph.facebook.com/v21.0/${item.external_id}/comments?message=${encodeURIComponent(aiResponse)}&access_token=...`)

      await supabase.from("social_interactions").update({
        ai_response: aiResponse,
        status: "replied"
      }).eq("id", item.id);
      
      totalReplied++;
    }

    return new Response(JSON.stringify({ success: true, replied: totalReplied }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
