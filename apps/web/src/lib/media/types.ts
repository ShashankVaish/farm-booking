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

export interface MediaProvider {
  resolve(asset: MediaAsset, transform?: MediaTransform): MediaAsset;
}
