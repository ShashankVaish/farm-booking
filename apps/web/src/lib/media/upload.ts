import { getApiBaseUrl } from '@/lib/config/env';
import { ApiError, NetworkError } from '@/lib/api/errors';
import { memoryTokenStore } from '@/lib/api/token-store';
import type { ApiEnvelope } from '@/lib/api/types';
import type { MediaUploadResult } from '@/lib/media/types';

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function validateListingImage(file: File): string | null {
  if (!ALLOWED.has(file.type)) {
    return 'Use a JPEG, PNG, or WebP image.';
  }
  if (file.size > MAX_BYTES) {
    return 'Each photo must be 8 MB or smaller.';
  }
  return null;
}

export function uploadListingImage(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<MediaUploadResult> {
  const invalid = validateListingImage(file);
  if (invalid) {
    return Promise.reject(new ApiError(400, 'VALIDATION_ERROR', invalid));
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const body = new FormData();
    body.append('file', file);

    xhr.open('POST', `${getApiBaseUrl()}/api/media`);
    xhr.responseType = 'json';

    void Promise.resolve(memoryTokenStore.getAccessToken()).then((token) => {
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.send(body);
    });

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onerror = () => reject(new NetworkError());

    xhr.onload = () => {
      const payload = xhr.response as ApiEnvelope<MediaUploadResult> | null;
      if (xhr.status >= 200 && xhr.status < 300 && payload && 'success' in payload && payload.success) {
        resolve(payload.data);
        return;
      }
      if (payload && 'success' in payload && payload.success === false) {
        reject(new ApiError(xhr.status, payload.error.code, payload.error.message, payload.error.details));
        return;
      }
      reject(new ApiError(xhr.status, 'REQUEST_FAILED', 'The photo could not be uploaded.'));
    };
  });
}
