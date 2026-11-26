import { describe, expect, it, vi } from 'vitest';
import { generateKnowledgeImage } from '../../../supabase/functions/_shared/knowledge-image';

describe('Imagens da base de conhecimento', () => {
  it('encaminha o formato escolhido ao serviço de imagem', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { success: true, updated: 1 }, error: null });
    expect(await generateKnowledgeImage(invoke, 'user', 'article', 'instagram_square')).toBeNull();
    expect(invoke).toHaveBeenCalledWith('regenerate-image', { body: {
      userId: 'user', articleIds: ['article'], force: true, imageFormat: 'instagram_square',
    } });
  });
  it('não inicia geração sem formato explícito', async () => {
    const invoke = vi.fn();
    await expect(generateKnowledgeImage(invoke, 'user', 'article', undefined)).rejects.toThrow('formato');
    expect(invoke).not.toHaveBeenCalled();
  });
  it('expõe a falha retornada em HTTP 200 como aviso', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { success: false, updated: 0, message: '9Router indisponível' }, error: null });
    expect(await generateKnowledgeImage(invoke, 'user', 'article', 'landscape')).toBe('9Router indisponível');
  });
  it('expõe rejeições do serviço sem repetir a geração', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: null, error: { message: 'Formato rejeitado' } });
    expect(await generateKnowledgeImage(invoke, 'user', 'article', 'landscape')).toBe('Formato rejeitado');
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});