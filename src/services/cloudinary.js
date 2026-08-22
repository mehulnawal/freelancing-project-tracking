import { MAX_DOCUMENT_ASSETS, validateDocumentFiles } from "../utils/documentLogic";
const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const preset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
const baseFolder = import.meta.env.VITE_CLOUDINARY_BASE_FOLDER || "freelance-management";
export const cloudinaryConfigured = Boolean(cloudName && preset);
export const uploadConfigurationMessage = "Cloudinary upload is not configured. External links remain available.";
export function mapCloudinaryAsset(response) { return { assetId: response.asset_id, publicId: response.public_id, secureUrl: response.secure_url, resourceType: response.resource_type, format: response.format, bytes: response.bytes, width: response.width || null, height: response.height || null, pageCount: response.pages || null, originalFilename: response.original_filename, createdAt: response.created_at, version: response.version, previewUrl: response.thumbnail_url || response.secure_url }; }
export function uploadCloudinaryFile(file, { onProgress, signal } = {}) {
  if (!cloudinaryConfigured) return Promise.reject(new Error(uploadConfigurationMessage));
  return new Promise((resolve, reject) => { const xhr = new XMLHttpRequest(); xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`); xhr.upload.onprogress = (e) => onProgress?.(e.lengthComputable ? Math.round((e.loaded / e.total) * 100) : 0); xhr.onerror = () => reject(new Error("Upload failed.")); xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError")); xhr.onload = () => { try { const body = JSON.parse(xhr.responseText); if (xhr.status >= 200 && xhr.status < 300) resolve(mapCloudinaryAsset(body)); else reject(new Error(body.error?.message || "Upload failed.")); } catch { reject(new Error("Upload returned an invalid response.")); } }; signal?.addEventListener("abort", () => xhr.abort(), { once: true }); const form = new FormData(); form.append("file", file); form.append("upload_preset", preset); form.append("folder", baseFolder); form.append("resource_type", "auto"); xhr.send(form); });
}
export async function uploadCloudinaryFiles(files, options = {}) { const error = validateDocumentFiles(files, { maxCount: MAX_DOCUMENT_ASSETS }); if (error) throw new Error(error); return Promise.allSettled(files.map((file, index) => uploadCloudinaryFile(file, { ...options, onProgress: (progress) => options.onProgress?.(index, progress) }))); }
export const requestFutureSignedDelete = async () => { throw new Error("Cloudinary asset deletion requires a future secure server-side integration."); };
