export const AUTOMATION_STAGES = ['publish', 'trends', 'research', 'text', 'save', 'image', 'done'] as const;
export type AutomationStage = typeof AUTOMATION_STAGES[number];
export function nextValidationStage(stage: AutomationStage): AutomationStage {
  const index = AUTOMATION_STAGES.indexOf(stage);
  return AUTOMATION_STAGES[Math.min(index + 1, AUTOMATION_STAGES.length - 1)];
}
export const AUTOMATION_BATCH_USERS = 100;
export const AUTOMATION_STEP_MS = 100_000;
export const AUTOMATION_PUBLISH_LIMIT = 1;
export function prioritizeAutomationUsers<T extends { user_id: string }>(users: T[], history: { user_id: string; updated_at: string }[]) {
  const latest = new Map<string, string>();
  for (const row of history) {
    if (!latest.has(row.user_id) || (latest.get(row.user_id) || '') < row.updated_at) latest.set(row.user_id, row.updated_at);
  }
  return [...users].sort((a, b) => (latest.get(a.user_id) || '').localeCompare(latest.get(b.user_id) || ''));
}