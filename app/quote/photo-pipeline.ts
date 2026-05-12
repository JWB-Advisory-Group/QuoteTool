import type { PhotoAttachment } from "@/lib/types";

export const MAX_RAW_PHOTO_BYTES = 25 * 1024 * 1024;
export const MAX_COMPRESSED_BYTES = 2_400_000;
export const PHOTO_MAX_EDGE = 1600;

export type ClientPhoto = {
  id: string;
  name: string;
  blob: Blob;
  previewUrl: string;
};

export type PhotoReadResult =
  | { kind: "ok"; photo: ClientPhoto }
  | { kind: "error"; name: string; reason: string };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(
        new Error(
          "Unsupported image format (HEIC photos must be exported as JPG first).",
        ),
      );
    image.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not encode photo for upload."));
    reader.readAsDataURL(blob);
  });
}

export async function readPhoto(file: File): Promise<PhotoReadResult> {
  if (!file.type.startsWith("image/")) {
    return {
      kind: "error",
      name: file.name,
      reason: "Not a recognized image format.",
    };
  }
  if (file.size > MAX_RAW_PHOTO_BYTES) {
    return {
      kind: "error",
      name: file.name,
      reason: `Larger than ${Math.round(MAX_RAW_PHOTO_BYTES / 1024 / 1024)} MB — please send a smaller photo.`,
    };
  }

  try {
    if (file.size <= 600_000) {
      const previewUrl = URL.createObjectURL(file);
      return {
        kind: "ok",
        photo: {
          id: crypto.randomUUID(),
          name: file.name,
          blob: file,
          previewUrl,
        },
      };
    }

    const rawObjectUrl = URL.createObjectURL(file);
    let image: HTMLImageElement;
    try {
      image = await loadImage(rawObjectUrl);
    } finally {
      URL.revokeObjectURL(rawObjectUrl);
    }
    const scale = Math.min(
      1,
      PHOTO_MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const targetWidth = Math.round(image.naturalWidth * scale);
    const targetHeight = Math.round(image.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return {
        kind: "error",
        name: file.name,
        reason: "Could not initialize image compression on this device.",
      };
    }
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

    let quality = 0.82;
    let compressed = await canvasToBlob(canvas, quality);
    while (compressed && compressed.size > MAX_COMPRESSED_BYTES && quality > 0.4) {
      quality -= 0.1;
      compressed = await canvasToBlob(canvas, quality);
    }
    if (!compressed || compressed.size > MAX_COMPRESSED_BYTES) {
      return {
        kind: "error",
        name: file.name,
        reason: "Photo is too large even after compression — try a smaller crop.",
      };
    }

    return {
      kind: "ok",
      photo: {
        id: crypto.randomUUID(),
        name: file.name,
        blob: compressed,
        previewUrl: URL.createObjectURL(compressed),
      },
    };
  } catch (error) {
    return {
      kind: "error",
      name: file.name,
      reason: error instanceof Error ? error.message : "Photo could not be processed.",
    };
  }
}

export async function clientPhotosToAttachments(
  photos: ClientPhoto[],
): Promise<PhotoAttachment[]> {
  return Promise.all(
    photos.map(async (photo) => ({
      id: photo.id,
      name: photo.name,
      dataUrl: await blobToDataUrl(photo.blob),
    })),
  );
}
