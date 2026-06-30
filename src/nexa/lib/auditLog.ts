import { supabase } from "@/integrations/supabase/client";

export async function logAudit(params: {
  organizationId: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("nexa_audit_logs").insert({
    organization_id: params.organizationId,
    user_id: user.id,
    action: params.action,
    entity_type: params.entityType ?? null,
    entity_id: params.entityId ?? null,
    metadata: params.metadata ?? {},
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
  });
}
