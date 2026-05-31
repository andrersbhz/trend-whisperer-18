import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, X, Image as ImageIcon, Crop, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '@/lib/image-utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';

interface ImageUploadProps {
  articleId: string;
  currentImageUrl?: string;
  onUploadSuccess: (url: string) => void;
}

export const ImageUpload = ({ articleId, currentImageUrl, onUploadSuccess }: ImageUploadProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
  
  // Cropping states
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isCropDialogOpen, setIsCropDialogOpen] = useState(false);
  const [aspect, setAspect] = useState<number | undefined>(0.8); // Default to 4:5 for Instagram
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [format, setFormat] = useState<'image/jpeg' | 'image/webp'>('image/webp');
  const [quality, setQuality] = useState(0.85);

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setSelectedImage(reader.result as string);
        setIsCropDialogOpen(true);
      });
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedImage || !croppedAreaPixels) return;

    try {
      setUploading(true);
      setIsCropDialogOpen(false);

      if (!user) {
        toast({
          title: "Erro",
          description: "Você precisa estar logado para fazer upload.",
          variant: "destructive",
        });
        return;
      }

      const croppedImageBlob = await getCroppedImg(
        selectedImage, 
        croppedAreaPixels,
        0,
        { horizontal: false, vertical: false },
        aspect === 0.8 ? 1080 : 1080, // Always use 1080 for high quality
        0.15,
        format,
        quality
      );
      if (!croppedImageBlob) throw new Error("Erro ao processar imagem");

      const fileExt = format === 'image/webp' ? 'webp' : 'jpg';
      const filePath = `${user.id}/${articleId}/${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('article-images')
        .upload(filePath, croppedImageBlob, {
          contentType: format,
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('article-images')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('articles')
        .update({ featured_image_url: publicUrl })
        .eq('id', articleId);

      if (updateError) throw updateError;

      setPreviewUrl(publicUrl);
      onUploadSuccess(publicUrl);

      // Dispara evento para indicar que o upload terminou
      window.dispatchEvent(new CustomEvent('article-image-uploaded', { 
        detail: { articleId, url: publicUrl } 
      }));
      
      // Clear cropping states
      setSelectedImage(null);
      setCroppedAreaPixels(null);

      toast({
        title: "Sucesso",
        description: "Imagem enviada com sucesso!",
      });
    } catch (error: any) {
      toast({
        title: "Erro no upload",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateAI = async () => {
    if (!user || !articleId) return;
    try {
      setUploading(true);
      const { data, error } = await supabase.functions.invoke('regenerate-image', {
        body: { userId: user.id, articleIds: [articleId], force: true },
      });
      
      if (error) throw error;
      
      if (data?.success) {
        const generatedUrl = data.imageUrl;
        
        if (generatedUrl) {
          setPreviewUrl(generatedUrl);
          onUploadSuccess(generatedUrl);
          toast({ title: "Sucesso", description: "Imagem gerada com sucesso!" });

          // Dispara evento para indicar que a geração automática de imagem terminou
          window.dispatchEvent(new CustomEvent('article-image-generated', { 
            detail: { articleId, url: generatedUrl } 
          }));
        } else {
          toast({ 
            title: "Gerando imagem...", 
            description: "Aguarde enquanto criamos sua imagem com IA." 
          });
          
          // Fallback polling se não veio na resposta direta
          setTimeout(async () => {
            const { data: updated } = await supabase
              .from('articles')
              .select('featured_image_url')
              .eq('id', articleId)
              .single();
              
            if (updated?.featured_image_url) {
              setPreviewUrl(updated.featured_image_url);
              onUploadSuccess(updated.featured_image_url);
              toast({ title: "Sucesso", description: "Imagem gerada com sucesso!" });
              
              // Dispara evento para indicar que a geração automática de imagem terminou
              window.dispatchEvent(new CustomEvent('article-image-generated', { 
                detail: { articleId, url: updated.featured_image_url } 
              }));
            }
          }, 8000);
        }
      } else {
        toast({ title: "Erro", description: data?.message || "Não foi possível gerar a imagem.", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Erro na geração", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    try {
      setUploading(true);
      const { error } = await supabase
        .from('articles')
        .update({ featured_image_url: null })
        .eq('id', articleId);

      if (error) throw error;

      setPreviewUrl(null);
      onUploadSuccess('');
      toast({
        title: "Sucesso",
        description: "Imagem removida com sucesso!",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao remover imagem",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative aspect-video w-full max-w-full mx-auto rounded-none border-2 border-dashed border-border overflow-hidden bg-muted/30 flex items-center justify-center">
        {previewUrl ? (
          <>
            <img 
              src={previewUrl} 
              alt="Preview" 
              className="w-full h-full object-contain" 
            />
            <button
              onClick={handleRemoveImage}
              className="absolute top-2 right-2 p-1 bg-background/80 rounded-full hover:bg-background text-destructive transition-colors"
              disabled={uploading}
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <ImageIcon className="h-10 w-10 opacity-20" />
            <p className="text-xs">Nenhuma imagem selecionada</p>
          </div>
        )}
        
        {uploading && (
          <div className="absolute inset-0 bg-background/40 flex items-center justify-center backdrop-blur-sm">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          className="relative overflow-hidden w-full gap-2"
          disabled={uploading}
        >
          <Upload className="h-4 w-4" />
          {previewUrl ? 'Alterar' : 'Upload'}
          <input
            type="file"
            className="absolute inset-0 opacity-0 cursor-pointer"
            accept="image/*"
            onChange={handleFileSelect}
            disabled={uploading}
          />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/10"
          onClick={handleGenerateAI}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Gerar com IA
        </Button>
      </div>
      <div className="flex flex-col gap-2 p-3 bg-muted/20 border border-primary/10 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Configurações de Exportação</span>
          <span className="text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            {format === 'image/webp' ? 'WEBP' : 'JPG'} @ {Math.round(quality * 100)}%
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <span className="text-[10px] text-muted-foreground">Formato</span>
            <div className="flex gap-1">
              <button 
                onClick={() => setFormat('image/webp')}
                className={cn(
                  "flex-1 text-[9px] font-bold py-1 rounded transition-all",
                  format === 'image/webp' ? "bg-primary text-white shadow-sm" : "bg-background text-muted-foreground border border-border hover:border-primary/30"
                )}
              >
                WEBP
              </button>
              <button 
                onClick={() => setFormat('image/jpeg')}
                className={cn(
                  "flex-1 text-[9px] font-bold py-1 rounded transition-all",
                  format === 'image/jpeg' ? "bg-primary text-white shadow-sm" : "bg-background text-muted-foreground border border-border hover:border-primary/30"
                )}
              >
                JPG
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] text-muted-foreground">Qualidade</span>
            <Slider
              value={[quality * 100]}
              min={10}
              max={100}
              step={1}
              onValueChange={(value) => setQuality(value[0] / 100)}
              className="w-full h-4"
            />
          </div>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center italic">
        A IA gerará uma imagem realista (1350x1080) com uma chamada impactante baseada no título.
      </p>


      <Dialog open={isCropDialogOpen} onOpenChange={setIsCropDialogOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden bg-background border-primary/20">
          <DialogHeader className="p-6 pb-0">
            <div className="flex items-center justify-between">
              <DialogTitle>Ajustar Imagem</DialogTitle>
              <div className="flex flex-wrap gap-2 mr-6">
                <Button 
                  variant={aspect === 0.8 ? "default" : "outline"} 
                  size="sm" 
                  onClick={() => setAspect(0.8)}
                  className="h-8 text-xs"
                >
                  1080x1350 (4:5)
                </Button>
                <Button 
                  variant={aspect === 1 ? "default" : "outline"} 
                  size="sm" 
                  onClick={() => setAspect(1)}
                  className="h-8 text-xs"
                >
                  1:1
                </Button>
                <Button 
                  variant={aspect === 16/9 ? "default" : "outline"} 
                  size="sm" 
                  onClick={() => setAspect(16/9)}
                  className="h-8 text-xs"
                >
                  16:9
                </Button>
                <Button 
                  variant={aspect === undefined ? "default" : "outline"} 
                  size="sm" 
                  onClick={() => setAspect(undefined)}
                  className="h-8 text-xs"
                >
                  Livre
                </Button>
              </div>
            </div>
          </DialogHeader>
          
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-3 relative w-full h-[400px] bg-black rounded-md overflow-hidden border border-primary/10">
                {selectedImage && (
                  <Cropper
                    image={selectedImage}
                    crop={crop}
                    zoom={zoom}
                    aspect={aspect}
                    onCropChange={setCrop}
                    onCropComplete={onCropComplete}
                    onZoomChange={setZoom}
                    onMediaLoaded={(mediaSize) => setImageSize(mediaSize)}
                  />
                )}
              </div>
              
              <div className="hidden md:flex flex-col gap-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pré-visualização</h4>
                <div className={cn(
                  "relative border border-primary/20 rounded-md overflow-hidden bg-muted/20 w-full max-w-[150px] mx-auto transition-all",
                  aspect === 0.8 ? "aspect-[4/5]" : aspect === 1 ? "aspect-square" : aspect === 16/9 ? "aspect-video" : "aspect-square"
                )}>
                  {selectedImage && croppedAreaPixels && (
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundImage: `url(${selectedImage})`,
                        backgroundSize: `${(imageSize.width / (croppedAreaPixels.width || 1)) * 100}% ${(imageSize.height / (croppedAreaPixels.height || 1)) * 100}%`,
                        backgroundPosition: `${(croppedAreaPixels.x / (Math.max(1, imageSize.width - croppedAreaPixels.width))) * 100}% ${(croppedAreaPixels.y / (Math.max(1, imageSize.height - croppedAreaPixels.height))) * 100}%`,
                        backgroundRepeat: 'no-repeat',
                      }}
                    />
                  )}
                </div>
                <p className="text-[10px] text-center text-muted-foreground leading-tight">
                  Como a imagem será exibida após o corte.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Zoom</span>
                  <span className="font-medium">{Math.round(zoom * 100)}%</span>
                </div>
                <Slider
                  value={[zoom]}
                  min={1}
                  max={3}
                  step={0.1}
                  onValueChange={(value) => setZoom(value[0])}
                  className="w-full"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Qualidade ({format === 'image/webp' ? 'WebP' : 'JPG'})</span>
                  <span className="font-medium">{Math.round(quality * 100)}%</span>
                </div>
                <Slider
                  value={[quality * 100]}
                  min={10}
                  max={100}
                  step={1}
                  onValueChange={(value) => setQuality(value[0] / 100)}
                  className="w-full"
                />
              </div>
            </div>

            <div className="flex items-center gap-4 border-t border-primary/10 pt-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Formato:</span>
              <div className="flex gap-2">
                <Button 
                  variant={format === 'image/webp' ? "default" : "outline"} 
                  size="sm" 
                  onClick={() => setFormat('image/webp')}
                  className="h-7 text-[10px] px-3"
                >
                  WEBP (Leve)
                </Button>
                <Button 
                  variant={format === 'image/jpeg' ? "default" : "outline"} 
                  size="sm" 
                  onClick={() => setFormat('image/jpeg')}
                  className="h-7 text-[10px] px-3"
                >
                  JPG (Compatível)
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 pt-0 flex gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setIsCropDialogOpen(false);
                setSelectedImage(null);
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleUpload} className="gap-2">
              <Crop className="h-4 w-4" />
              Cortar e Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};