import React, { useState } from 'react';
import { cn } from '@/lib/utils';

interface NewsImageProps {
  src: string;
  alt: string;
  className?: string;
  aspectRatio?: 'video' | 'square' | 'wide' | 'tall' | 'hero';
}

const NewsImage = ({ src, alt, className, aspectRatio = 'video' }: NewsImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false);

  const ratioClasses = {
    video: 'aspect-video',
    square: 'aspect-square',
    wide: 'aspect-[21/9]',
    tall: 'aspect-[3/4]',
    hero: 'aspect-[16/10]',
  };

  return (
    <div className={cn(
      "relative overflow-hidden bg-muted group",
      ratioClasses[aspectRatio],
      className
    )}>
      {/* Blurred background for "no crop" effect */}
      <div 
        className="absolute inset-0 z-0 scale-110 blur-xl opacity-30 grayscale transition-opacity duration-700"
        style={{ 
          backgroundImage: `url(${src})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      />
      
      {/* Main Image - using object-contain to avoid cropping */}
      <img
        src={src}
        alt={alt}
        onLoad={() => setIsLoaded(true)}
        className={cn(
          "relative z-10 w-full h-full object-contain transition-all duration-700",
          !isLoaded ? "scale-105 blur-sm" : "scale-100 blur-0",
          "group-hover:scale-[1.02]"
        )}
      />
      
      {/* Subtle overlay */}
      <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    </div>
  );
};

export default NewsImage;
