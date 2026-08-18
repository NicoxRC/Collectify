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
 *
 * Phase 21 widens this to also accept PDFs (client ID documents / the
 * consent evidence document may be uploaded as a single combined PDF
 * instead of two photos — see docs/phases/PHASE_21_CLIENT_PROFILE.md
 * "Uploads"). Cloudinary's `/image/upload` endpoint only accepts raster
 * images; PDFs need `resource_type: 'auto'` against the generic `/auto/
 * upload` endpoint instead, which detects image vs. raw automatically. The
 * payment-receipt path is image-only and unchanged in behavior — it's kept
 * on the narrower `/image/upload` endpoint rather than switched to `auto`,
 * so a non-image file picked by mistake still fails fast instead of
 * silently uploading as a raw resource.
 */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export class ImageUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageUploadError';
  }
}

// Shared by both upload paths below — resolves the Cloudinary endpoint,
// posts the file, and unwraps secure_url, with identical error handling.
// `resourceType` picks the Cloudinary endpoint (`image` vs `auto`); the
// error messages stay generic ("la foto"/"el archivo") via the caller's
// own wording, not duplicated here.
async function uploadToCloudinary(
  file: File,
  resourceType: 'image' | 'auto',
  configErrorMessage: string,
  uploadErrorMessage: string,
): Promise<string> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    // Mirrors the "fail gracefully, don't crash" convention
    // ENVIRONMENT_VARIABLES.md documents for the pending Meta WhatsApp
    // credentials — except here there's no server-side fallback to log
    // and skip, so the caller must surface this as a blocking upload
    // error rather than silently submitting without the file.
    throw new ImageUploadError(configErrorMessage);
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
    { method: 'POST', body: formData },
  );

  if (!response.ok) {
    throw new ImageUploadError(uploadErrorMessage);
  }

  const result = (await response.json()) as { secure_url?: string };
  if (!result.secure_url) {
    throw new ImageUploadError(
      'La subida del archivo no devolvió una URL válida.',
    );
  }

  return result.secure_url;
}

// Registering a payment must still work without a photo (both this phase's
// api and client docs are explicit about that), so this is only called
// when the collector actually picked a file — never a required step.
export async function uploadPaymentReceipt(file: File): Promise<string> {
  return uploadToCloudinary(
    file,
    'image',
    'La subida de imágenes no está configurada (faltan las variables VITE_CLOUDINARY_CLOUD_NAME / VITE_CLOUDINARY_UPLOAD_PRESET).',
    'No se pudo subir la foto del comprobante. Intenta de nuevo.',
  );
}

// Phase 21 — the client ID document (front/back, or a single combined
// PDF), the co-debtor's ID document, and the data-processing consent
// evidence document all reuse this one function: same
// upload-before-submit pattern as uploadPaymentReceipt above, just
// widened to accept image/* or application/pdf (enforced by the caller's
// <input accept="image/*,application/pdf">, not re-checked here — the
// `auto` resource type accepts either regardless). Every field this backs
// is optional on the api side except the consent evidence document, which
// is optional too — see docs/phases/PHASE_21_CLIENT_PROFILE.md decision 3.
export async function uploadDocument(file: File): Promise<string> {
  return uploadToCloudinary(
    file,
    'auto',
    'La subida de archivos no está configurada (faltan las variables VITE_CLOUDINARY_CLOUD_NAME / VITE_CLOUDINARY_UPLOAD_PRESET).',
    'No se pudo subir el archivo. Intenta de nuevo.',
  );
}
