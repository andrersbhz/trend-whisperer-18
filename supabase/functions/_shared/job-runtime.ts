import { AsyncLocalStorage } from 'node:async_hooks';

export class JobStopped extends Error {
  constructor(message: string, public unknownOutcome = false, public rateLimited = false) { super(message); }
}
type Scope = { deadline: number; stopped?: JobStopped };
const scopes = new AsyncLocalStorage<Scope>();
export function isJobExecution() { return Boolean(scopes.getStore()); }
export function throwIfJobStopped() {
  const scope = scopes.getStore();
  if (!scope) return;
  if (scope.stopped) throw scope.stopped;
  if (Date.now() >= scope.deadline) {
    scope.stopped = new JobStopped('Prazo da etapa atingido; o progresso anterior foi preservado.');
    throw scope.stopped;
  }
}
export async function runJobStep<T>(work: () => Promise<T>, durationMs = 100_000): Promise<T> {
  return scopes.run({ deadline: Date.now() + durationMs }, async () => {
    const result = await work();
    throwIfJobStopped();
    return result;
  });
}
export const jobFetch: typeof fetch = async (input, init) => {
  const nativeFetch = globalThis.fetch.bind(globalThis);
  const scope = scopes.getStore();
  if (!scope) return nativeFetch(input, init);
  throwIfJobStopped();
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const inference = /chat\/completions|generateContent|images\/(generations|edits)/i.test(url);
  const timeout = AbortSignal.timeout(Math.max(1, Math.min(inference ? 65_000 : 15_000, scope.deadline - Date.now())));
  const original = init?.signal || (input instanceof Request ? input.signal : undefined);
  const signal = original ? AbortSignal.any([original, timeout]) : timeout;
  try {
    const response = await nativeFetch(input, { ...init, signal });
    if (inference && [402, 403, 429].includes(response.status)) {
      scope.stopped = new JobStopped(`Provedor bloqueou a etapa (HTTP ${response.status}). ${response.status === 429 ? 'Aguardar o próximo ciclo.' : 'Restaure o acesso ou saldo antes de retomar.'}`, false, response.status === 429);
      await response.body?.cancel();
      throw scope.stopped;
    }
    if (inference && response.status >= 500) {
      scope.stopped = new JobStopped(`Provedor retornou HTTP ${response.status}; o resultado pode ter sido iniciado. Confira antes de repetir.`, true);
      await response.body?.cancel();
      throw scope.stopped;
    }
    if (inference && response.ok) {
      const text = await response.text();
      if (/"refusal"\s*:\s*"[^"\s]|"finish_reason"\s*:\s*"content_filter"|"blockReason"\s*:\s*"[^"\s]/i.test(text)) {
        scope.stopped = new JobStopped('O provedor recusou o conteúdo; a tarefa foi encerrada sem trocar de modelo.');
        throw scope.stopped;
      }
      return new Response(text, { status: response.status, statusText: response.statusText, headers: response.headers });
    }
    return response;
  } catch (error) {
    if (error instanceof JobStopped) throw error;
    if (inference) {
      scope.stopped = new JobStopped('A confirmação do provedor foi perdida; não haverá nova tentativa automática.', true);
      throw scope.stopped;
    }
    throw error;
  }
};