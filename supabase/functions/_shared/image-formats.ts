export const AI_IMAGE_FORMATS = {
  instagram_square: { width: 1080, height: 1080, label: 'Quadrado · 1:1' },
  instagram_portrait: { width: 1080, height: 1350, label: 'Retrato · 4:5' },
  landscape: { width: 1920, height: 1080, label: 'Paisagem · 16:9' },
  instagram_story: { width: 1080, height: 1920, label: 'Stories · 9:16' },
  facebook_post: { width: 1200, height: 630, label: 'Facebook · 1,91:1' },
  facebook_square: { width: 1200, height: 1200, label: 'Facebook · 1:1' },
  facebook_story: { width: 1080, height: 1920, label: 'Facebook Stories · 9:16' },
  linkedin_post: { width: 1200, height: 627, label: 'LinkedIn · 1,91:1' },
  linkedin_square: { width: 1200, height: 1200, label: 'LinkedIn · 1:1' },
} as const;
export type AIImageFormat = keyof typeof AI_IMAGE_FORMATS;
export function isAIImageFormat(value: unknown): value is AIImageFormat {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(AI_IMAGE_FORMATS, value);
}
export function requireImageFormat(value: unknown) {
  if (!isAIImageFormat(value)) throw new Error('Escolha um formato válido antes de gerar a imagem.');
  return AI_IMAGE_FORMATS[value];
}