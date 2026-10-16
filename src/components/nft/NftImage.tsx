import type { Image } from '@/api/contracts'
import { nftSrcSet } from '@/lib/images'
import { cn } from '@/lib/utils'

export function NftImage({
  image,
  sizes,
  priority = false,
  className,
  alt,
}: {
  image: Image
  sizes: string
  priority?: boolean
  className?: string
  alt?: string
}) {
  return (
    <img
      src={image.src}
      srcSet={nftSrcSet(image.src)}
      sizes={sizes}
      alt={alt ?? image.alt}
      width={800}
      height={800}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      className={cn('aspect-square h-auto w-full object-cover', className)}
    />
  )
}
