export type MediaTransform = {
  width?: number;
  height?: number;
  quality?: number;
};

export type MediaAsset = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
};

export type MediaUploadResult = {
  url: string;
  publicId?: string;
  alt?: string;
};

export interface MediaProvider {
  resolve(asset: MediaAsset, transform?: MediaTransform): MediaAsset;
  upload?(file: File, onProgress?: (percent: number) => void): Promise<MediaUploadResult>;
}
