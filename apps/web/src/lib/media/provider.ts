import { getApiBaseUrl } from '@/lib/config/env';
import type { MediaAsset, MediaProvider, MediaTransform, MediaUploadResult } from '@/lib/media/types';
import { uploadListingImage } from '@/lib/media/upload';

function absoluteSrc(src: string): string {
  if (
    src.startsWith('http://') ||
    src.startsWith('https://') ||
    src.startsWith('blob:') ||
    src.startsWith('data:')
  ) {
    return src;
  }
  if (src.startsWith('/uploads/')) {
    try {
      return `${getApiBaseUrl()}${src}`;
    } catch {
      return src;
    }
  }
  return src;
}

/**
 * Local/static media for now. Swap this implementation for Cloudinary
 * (or another provider) without changing UI components.
 */
export const localMediaProvider: MediaProvider = {
  resolve(asset: MediaAsset): MediaAsset {
    return { ...asset, src: absoluteSrc(asset.src) };
  },
  upload(file, onProgress) {
    return uploadListingImage(file, onProgress);
  },
};

let mediaProvider: MediaProvider = localMediaProvider;

export function setMediaProvider(provider: MediaProvider): void {
  mediaProvider = provider;
}

export function resolveMedia(asset: MediaAsset, transform?: MediaTransform): MediaAsset {
  return mediaProvider.resolve(asset, transform);
}

export function uploadMedia(file: File, onProgress?: (percent: number) => void): Promise<MediaUploadResult> {
  if (!mediaProvider.upload) {
    throw new Error('Media uploads are not configured.');
  }
  return mediaProvider.upload(file, onProgress);
}
