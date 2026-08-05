/**
 * Thin wrapper around Cloudinary's unsigned upload endpoint, per
 * docs/phases/PHASE_12_PAYMENT_ATTACHMENTS.md's provider recommendation.
 * The api never touches image bytes (see CreatePaymentDto.imageUrl) — the
 * client uploads directly to Cloudinary from the browser and only sends
 * the resulting URL to our own api. This keeps apps/api free of
 * file-handling code and storage costs, per that doc's explicit scope
 * decision.
 *
 * Uses an unsigned upload preset (configured in the Cloudinary dashboard,
 * not a server secret) rather than a signed upload — a signed upload would
 * require an api key/secret pair that can't safely live in client-side
 * code. See docs/ENVIRONMENT_VARIABLES.md for the two public env vars this
 * needs.
 */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export class ImageUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageUploadError';
  }
}

// Registering a payment must still work without a photo (both this phase's
// api and client docs are explicit about that), so this is only called
// when the collector actually picked a file — never a required step.
export async function uploadPaymentReceipt(file: File): Promise<string> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    // Mirrors the "fail gracefully, don't crash" convention
    // ENVIRONMENT_VARIABLES.md documents for the pending Meta WhatsApp
    // credentials — except here there's no server-side fallback to log
    // and skip, so the caller (RegisterPaymentDialog) must surface this as
    // a blocking upload error rather than silently submitting without the
    // photo.
    throw new ImageUploadError(
      'La subida de imágenes no está configurada (faltan las variables VITE_CLOUDINARY_CLOUD_NAME / VITE_CLOUDINARY_UPLOAD_PRESET).',
    );
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData },
  );

  if (!response.ok) {
    throw new ImageUploadError(
      'No se pudo subir la foto del comprobante. Intenta de nuevo.',
    );
  }

  const result = (await response.json()) as { secure_url?: string };
  if (!result.secure_url) {
    throw new ImageUploadError(
      'La subida de la imagen no devolvió una URL válida.',
    );
  }

  return result.secure_url;
}
