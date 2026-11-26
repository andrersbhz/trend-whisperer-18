import { isAIImageFormat, type AIImageFormat } from './image-formats.ts';

type ImageResult = { success?: boolean; updated?: number; error?: string; message?: string };
type InvokeImage = (name: string, options: { body: { userId: string; articleIds: string[]; force: boolean; imageFormat: AIImageFormat } }) => Promise<{ data: ImageResult | null; error: { message: string } | null }>;

export async function generateKnowledgeImage(invoke: InvokeImage, userId: string, articleId: string, imageFormat: unknown): Promise<string | null> {
  if (!isAIImageFormat(imageFormat)) throw new Error('Escolha um formato válido antes de gerar a imagem.');
  try {
    const { data, error } = await invoke('regenerate-image', {
      body: { userId, articleIds: [articleId], force: true, imageFormat },
    });
    if (error) return error.message;
    if (!data?.success || !data.updated) return data?.error || data?.message || 'Não foi possível gerar a imagem.';
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Não foi possível gerar a imagem.';
  }
}