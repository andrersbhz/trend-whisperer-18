import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AI_IMAGE_FORMATS, requireImageFormat } from '../../../supabase/functions/_shared/image-formats';
import { generateRouterImage, imagePrompt, type ImageRequest } from '../../../supabase/functions/_shared/ninerouter-images';
import { photoFromPage, publicPhotoUrl } from '../../../supabase/functions/_shared/news-photo';

const input: ImageRequest = {
  endpoint: 'https://router.example/v1', apiKey: 'test-only', model: 'cf/flux',
  title: 'Notícia brasileira', prompt: 'Fotografia editorial com cores vibrantes',
  format: 'landscape', references: [], realPeople: [], knowledgeText: 'Composição de capa com foco no assunto.',
};
function routerFetch(mock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('fetch', (url: string, options: unknown) => url.includes('bing.com/')
    ? Promise.resolve(new Response('<rss></rss>')) : mock(url, options));
}
beforeEach(() => vi.stubGlobal('AbortSignal', { timeout: () => new AbortController().signal }));
afterEach(() => vi.unstubAllGlobals());
describe('Regras de geração de imagens', () => {
  it('exige escolha explícita antes de gerar', async () => {
    const fetch = vi.fn(); routerFetch(fetch);
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
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] })))
      .mockResolvedValue(new Response(JSON.stringify({ data: [{ url: 'https://router.example/image.png' }] })));
    routerFetch(fetch);
    await generateRouterImage(input);
    expect(fetch.mock.calls[1][0]).toBe('https://router.example/v1/images/generations');
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({ width: 1920, height: 1080, size: '1920x1080' });
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
    routerFetch(fetch);
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
    routerFetch(fetch);
    await generateRouterImage({ ...input, references: ['https://assets.example/reference.png'] });
    const analysis = JSON.parse(fetch.mock.calls[1][1].body);
    expect(analysis.messages[0].content[1].image_url.url).toBe('https://assets.example/reference.png');
    expect(fetch.mock.calls[2][0]).toBe('https://router.example/v1/images/generations');
    expect(JSON.parse(fetch.mock.calls[2][1].body).prompt).toContain(style.trim());
  });
  it('não inventa pessoas quando não há foto recente autorizada', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] })));
    routerFetch(fetch);
    await expect(generateRouterImage({ ...input, realPeople: ['Mariana Rios'] })).rejects.toThrow('nenhuma pessoa será inventada');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('usa a própria fotografia recente com legenda e crédito sem gerar outro rosto', async () => {
    const source = 'https://news.example/mariana';
    const url = 'https://images.example/mariana.png';
    const html = `<meta property="og:image" content="${url}"><meta property="og:image:alt" content="Mariana Rios em entrevista"><meta property="article:published_time" content="${new Date().toISOString()}"><meta property="image:license" content="https://creativecommons.org/licenses/by/4.0/">`;
    const fetch = vi.fn().mockImplementation((url: string) => Promise.resolve(url === source
      ? new Response(html, { headers: { 'Content-Type': 'text/html' } })
      : new Response(JSON.stringify({ data: [] }))));
    routerFetch(fetch);
    const onPhoto = vi.fn();
    expect(await generateRouterImage({ ...input, realPeople: ['Mariana Rios'], sourceUrls: [source], onPhoto })).toBe(url);
    expect(onPhoto).toHaveBeenCalledWith(expect.objectContaining({ source, caption: 'Mariana Rios em entrevista', license: 'https://creativecommons.org/licenses/by/4.0/' }));
    expect(fetch.mock.calls.some(([url]) => url.includes('/images/'))).toBe(false);
  });
  it('interrompe a geração quando nenhuma IA consegue ler o aprendizado', async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response('{}', { status: 503 })));
    routerFetch(fetch);
    await expect(generateRouterImage({ ...input, references: ['https://assets.example/style.png'] })).rejects.toThrow('não ignorá-las');
    expect(fetch.mock.calls.some(([url]) => url.endsWith('/images/generations'))).toBe(false);
  });
  it('não reutiliza imagem com data antiga ou sem licença específica', () => {
    const meta = `<meta property="og:image" content="https://images.example/person.png"><meta property="og:image:alt" content="Mariana Rios"><meta property="article:published_time" content="${new Date().toISOString()}">`;
    expect(photoFromPage(meta, 'https://news.example/story')).toBeNull();
    const licensed = meta + '<meta property="image:license" content="https://creativecommons.org/licenses/by/4.0/">';
    expect(photoFromPage(licensed, 'https://news.example/story')?.caption).toBe('Mariana Rios');
    expect(photoFromPage(licensed.replace(new Date().toISOString().slice(0, 10), '2020-01-01'), 'https://news.example/story')).toBeNull();
  });
  it('bloqueia endereços locais para pesquisa de fotos', () => {
    expect(publicPhotoUrl('https://127.0.0.1/photo')).toBe(false);
    expect(publicPhotoUrl('https://metadata.internal/photo')).toBe(false);
    expect(publicPhotoUrl('https://news.example/photo')).toBe(true);
  });
});