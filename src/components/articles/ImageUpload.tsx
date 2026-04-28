import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, X, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

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

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) {
        return;
      }

      if (!user) {
        toast({
          title: "Erro",
          description: "Você precisa estar logado para fazer upload.",
          variant: "destructive",
        });
        return;
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/${articleId}/${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('article-images')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('article-images')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('articles')
        .update({ featured_image_url: publicUrl })
        .eq('id', articleId);

      if (updateError) {
        throw updateError;
      }

      setPreviewUrl(publicUrl);
      onUploadSuccess(publicUrl);
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
      <div className="relative aspect-video w-full rounded-lg border-2 border-dashed border-border overflow-hidden bg-muted/30 flex items-center justify-center">
        {previewUrl ? (
          <>
            <img 
              src={previewUrl} 
              alt="Preview" 
              className="w-full h-full object-cover" 
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

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="relative overflow-hidden w-full gap-2"
          disabled={uploading}
        >
          <Upload className="h-4 w-4" />
          {previewUrl ? 'Alterar Imagem' : 'Fazer Upload'}
          <input
            type="file"
            className="absolute inset-0 opacity-0 cursor-pointer"
            accept="image/*"
            onChange={handleUpload}
            disabled={uploading}
          />
        </Button>
      </div>
    </div>
  );
};
