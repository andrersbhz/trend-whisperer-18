import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AI_IMAGE_FORMATS, requireImageFormat } from '../../../supabase/functions/_shared/image-formats';
import { generateRouterImage, imagePrompt, type ImageRequest } from '../../../supabase/functions/_shared/ninerouter-images';

const input: ImageRequest = {
  endpoint: 'https://router.example/v1', apiKey: 'test-only', model: 'cf/flux',
  title: 'Notícia brasileira', prompt: 'Fotografia editorial com cores vibrantes',
  format: 'landscape', references: [], knowledgeText: 'Composição de capa com foco no assunto.',
};
beforeEach(() => vi.stubGlobal('AbortSignal', { timeout: () => new AbortController().signal }));
afterEach(() => vi.unstubAllGlobals());
describe('Regras de geração de imagens', () => {
  it('exige escolha explícita antes de gerar', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    expect(() => requireImageFormat(undefined)).toThrow();
    await expect(generateRouterImage({ ...input, format: undefined as unknown as ImageRequest['format'] })).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('oferece dimensões concretas para 1:1, 4:5, 16:9 e 9:16', () => {
    expect(AI_IMAGE_FORMATS.instagram_square).toMatchObject({ width: 1080, height: 1080 });
    expect(AI_IMAGE_FORMATS.instagram_portrait).toMatchObject({ width: 1080, height: 1350 });
    expect(AI_IMAGE_FORMATS.landscape).toMatchObject({ width: 1920, height: 1080 });
    expect(AI_IMAGE_FORMATS.instagram_story).toMatchObject({ width: 1080, height: 1920 });
  });
  it('envia o formato escolhido ao 9Router, sem usar outro serviço', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ url: 'https://router.example/image.png' }] })));
    vi.stubGlobal('fetch', fetch);
    await generateRouterImage(input);
    expect(fetch.mock.calls[0][0]).toBe('https://router.example/v1/images/generations');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ width: 1920, height: 1080, size: '1920x1080' });
  });
  it('mantém o prompt completo e o aprendizado no pedido', () => {
    const fullPrompt = 'Referência obrigatória. '.repeat(150);
    const prompt = imagePrompt({ ...input, prompt: fullPrompt });
    expect(prompt).toContain(fullPrompt);
    expect(prompt).toContain(input.knowledgeText);
    expect(prompt).toContain(input.title);
  });
  it('transmite as imagens de aprendizado e não usa Flux sem referências', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'gc/gemini-image' }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { images: [{ image_url: { url: 'https://router.example/image.png' } }] } }] })));
    vi.stubGlobal('fetch', fetch);
    await generateRouterImage({ ...input, references: ['https://assets.example/reference.png'] });
    const request = JSON.parse(fetch.mock.calls[1][1].body);
    expect(fetch.mock.calls[1][0]).toBe('https://router.example/v1/chat/completions');
    expect(request.model).toBe('gc/gemini-image');
    expect(request.messages[0].content[1]).toEqual({ type: 'image_url', image_url: { url: 'https://assets.example/reference.png' } });
    expect(request.image_config.aspect_ratio).toBe('16:9');
  });
  it('Flux só recebe referências após análise visual real pelo 9Router', async () => {
    const style = 'High contrast editorial composition, clear subject in foreground, vibrant palette and bold type hierarchy. '.repeat(2);
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'gc/gemini-2.5-flash' }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: style } }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ url: 'https://router.example/image.png' }] })));
    vi.stubGlobal('fetch', fetch);
    await generateRouterImage({ ...input, references: ['https://assets.example/reference.png'] });
    const analysis = JSON.parse(fetch.mock.calls[1][1].body);
    expect(analysis.messages[0].content[1].image_url.url).toBe('https://assets.example/reference.png');
    expect(fetch.mock.calls[2][0]).toBe('https://router.example/v1/images/generations');
    expect(JSON.parse(fetch.mock.calls[2][1].body).prompt).toContain(style.trim());
  });
});