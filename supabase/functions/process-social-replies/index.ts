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

    // 1. Get pending interactions
    const { data: interactions } = await supabase
      .from("social_interactions")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "pending")
      .limit(10);

    if (!interactions || interactions.length === 0) {
      return new Response(JSON.stringify({ message: "No pending interactions", replied: 0 }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // 2. Get AI Settings
    const { data: settings } = await supabase.from("user_settings").select("*").eq("user_id", userId).single();
    
    const apiKey = settings?.openai_api_key || settings?.gemini_api_key;
    const provider = settings?.openai_api_key ? "openai" : "gemini";

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "No AI API key found in settings" }), { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    let totalReplied = 0;

    for (const item of interactions) {
      const prompt = `Você é um gestor de redes sociais humano e empático. 
      Comentário de ${item.author_name}: "${item.content}"
      Responda de forma curta, natural, empática e amigável. Use um tom humano, não pareça um robô. Responda em Português do Brasil.`;

      let aiResponse = "";

      if (provider === "openai") {
        const resp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 150,
          }),
        });
        const data = await resp.json();
        aiResponse = data.choices?.[0]?.message?.content || "";
      } else {
        // Gemini
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        });
        const data = await resp.json();
        aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      }

      if (aiResponse) {
        // Post back to Meta API if page_id and external_id are present
        // This would require a valid access token for the page
        // For now, we update the DB as "replied" to show in UI
        await supabase.from("social_interactions").update({
          ai_response: aiResponse.trim(),
          status: "replied",
          processed_at: new Date().toISOString()
        }).eq("id", item.id);
        
        totalReplied++;
      }
    }

    return new Response(JSON.stringify({ success: true, replied: totalReplied }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error) {
    console.error("Error processing replies:", error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});