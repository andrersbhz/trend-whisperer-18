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
      {/* Main Image */}
      <img
        src={src}
        alt={alt}
        onLoad={() => setIsLoaded(true)}
        className={cn(
          "w-full h-full object-cover transition-all duration-700",
          !isLoaded ? "scale-105 blur-sm" : "scale-100 blur-0"
        )}
      />
      
      {/* Subtle overlay */}
      <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    </div>
  );
};

export default NewsImage;
