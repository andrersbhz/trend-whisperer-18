// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jobFetch, runJobStep, JobStopped } from '../../../supabase/functions/_shared/job-runtime';
import { AUTOMATION_BATCH_USERS, AUTOMATION_PUBLISH_LIMIT, AUTOMATION_STEP_MS, nextValidationStage, prioritizeAutomationUsers } from '../../../supabase/functions/_shared/automation-policy';
afterEach(() => vi.unstubAllGlobals());
describe('Automação limitada e sem repetição', () => {
  it('prioriza usuários não atendidos antes dos atendidos mais recentemente', () => {
    const users = [{ user_id: 'recent' }, { user_id: 'old' }, { user_id: 'never' }];
    const ordered = prioritizeAutomationUsers(users, [{ user_id: 'recent', updated_at: '2026-11-26T04:00:00Z' }, { user_id: 'old', updated_at: '2026-11-25T04:00:00Z' }]);
    expect(ordered.map(user => user.user_id)).toEqual(['never', 'old', 'recent']);
    expect(users[0].user_id).toBe('recent');
  });
  it('limita a publicação a um artigo e cada etapa a 100 segundos', () => {
    expect(AUTOMATION_PUBLISH_LIMIT).toBe(1);
    expect(AUTOMATION_STEP_MS).toBe(100000);
    expect(AUTOMATION_BATCH_USERS).toBe(100);
  });
  it('separa texto, salvamento e imagem em etapas retomáveis', () => {
    expect(nextValidationStage('research')).toBe('text');
    expect(nextValidationStage('text')).toBe('save');
    expect(nextValidationStage('save')).toBe('image');
    expect(nextValidationStage('image')).toBe('done');
  });
  it.each([402,403])('interrompe todas as chamadas após bloqueio HTTP %s', async status => {
    const mock = vi.fn().mockResolvedValue(new Response('{}', { status }));
    vi.stubGlobal('fetch', mock);
    await expect(runJobStep(async () => {
      try { await jobFetch('https://provider.example/chat/completions'); } catch {}
      await jobFetch('https://another.example/chat/completions');
    })).rejects.toBeInstanceOf(JobStopped);
    expect(mock).toHaveBeenCalledTimes(1);
  });
  it('não repete resultado desconhecido', async () => {
    const mock = vi.fn().mockRejectedValue(new TypeError('network lost'));
    vi.stubGlobal('fetch', mock);
    await expect(runJobStep(async () => {
      try { await jobFetch('https://provider.example/chat/completions'); } catch {}
      await jobFetch('https://provider.example/chat/completions');
    })).rejects.toMatchObject({ unknownOutcome: true });
    expect(mock).toHaveBeenCalledTimes(1);
  });
  it('adia limite de taxa até o próximo ciclo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 429 })));
    await expect(runJobStep(() => jobFetch('https://provider.example/chat/completions'))).rejects.toMatchObject({ rateLimited: true, unknownOutcome: false });
  });
  it('encerra a tarefa se o provedor recusa conteúdo num HTTP 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"choices":[{"message":{"refusal":"Cannot comply"}}]}')));
    await expect(runJobStep(() => jobFetch('https://provider.example/chat/completions'))).rejects.toMatchObject({ unknownOutcome: false });
  });
  it('não altera chamadas fora da automação', async () => {
    const mock = vi.fn().mockResolvedValue(new Response('{}', { status: 403 }));
    vi.stubGlobal('fetch', mock);
    expect((await jobFetch('https://provider.example/images/generations')).status).toBe(403);
  });
  it('não inicia chamadas quando o prazo já acabou', async () => {
    const mock = vi.fn(); vi.stubGlobal('fetch', mock);
    await expect(runJobStep(() => jobFetch('https://provider.example/chat/completions'), 0)).rejects.toBeInstanceOf(JobStopped);
    expect(mock).not.toHaveBeenCalled();
  });
});