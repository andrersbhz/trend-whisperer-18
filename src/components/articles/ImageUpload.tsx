import { useState, useCallback } from 'react';
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
  const [aspect, setAspect] = useState<number | undefined>(undefined);

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

      const croppedImageBlob = await getCroppedImg(selectedImage, croppedAreaPixels);
      if (!croppedImageBlob) throw new Error("Erro ao processar imagem");

      const fileExt = 'jpg';
      const filePath = `${user.id}/${articleId}/${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('article-images')
        .upload(filePath, croppedImageBlob, {
          contentType: 'image/jpeg',
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
      <p className="text-[10px] text-muted-foreground text-center italic">
        A imagem será baseada obrigatoriamente no seu "Prompt de Imagem IA" e nos detalhes da história.
      </p>

      <Dialog open={isCropDialogOpen} onOpenChange={setIsCropDialogOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden bg-background border-primary/20">
          <DialogHeader className="p-6 pb-0">
            <div className="flex items-center justify-between">
              <DialogTitle>Ajustar Imagem</DialogTitle>
              <div className="flex gap-2 mr-6">
                <Button 
                  variant={aspect === undefined ? "default" : "outline"} 
                  size="sm" 
                  onClick={() => setAspect(undefined)}
                  className="h-8 text-xs"
                >
                  Livre
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
                  variant={aspect === 4/3 ? "default" : "outline"} 
                  size="sm" 
                  onClick={() => setAspect(4/3)}
                  className="h-8 text-xs"
                >
                  4:3
                </Button>
                <Button 
                  variant={aspect === 16/9 ? "default" : "outline"} 
                  size="sm" 
                  onClick={() => setAspect(16/9)}
                  className="h-8 text-xs"
                >
                  16:9
                </Button>
              </div>
            </div>
          </DialogHeader>
          
          <div className="p-6 space-y-6">
            <div className="relative w-full h-[400px] bg-black rounded-md overflow-hidden">
              {selectedImage && (
                <Cropper
                  image={selectedImage}
                  crop={crop}
                  zoom={zoom}
                  aspect={aspect}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                />
              )}
            </div>

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