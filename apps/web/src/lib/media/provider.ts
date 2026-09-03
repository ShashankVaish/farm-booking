import type { MediaAsset, MediaProvider, MediaTransform } from '@/lib/media/types';

/**
 * Local/static media for now. Swap this implementation for Cloudinary
 * (or another provider) without changing UI components.
 */
export const localMediaProvider: MediaProvider = {
  resolve(asset: MediaAsset): MediaAsset {
    return asset;
  },
};

let mediaProvider: MediaProvider = localMediaProvider;

export function setMediaProvider(provider: MediaProvider): void {
  mediaProvider = provider;
}

export function resolveMedia(asset: MediaAsset, transform?: MediaTransform): MediaAsset {
  return mediaProvider.resolve(asset, transform);
}
