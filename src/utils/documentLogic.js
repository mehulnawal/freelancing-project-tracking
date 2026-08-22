export const DOCUMENT_SOURCES = ["CloudinaryUpload", "ExternalLink"];
export const MAX_DOCUMENT_ASSETS = 8;
export const MAX_DOCUMENT_FILE_BYTES = 15 * 1024 * 1024;
export const ALLOWED_DOCUMENT_FILES = { "image/jpeg": ["jpg", "jpeg"], "image/png": ["png"], "image/webp": ["webp"], "application/pdf": ["pdf"] };
export function fileExtension(file) { return (file.name || "").split(".").pop().toLowerCase(); }
export function validateDocumentFiles(files, limits = {}) {
  const maxCount = limits.maxCount || MAX_DOCUMENT_ASSETS, maxBytes = limits.maxBytes || MAX_DOCUMENT_FILE_BYTES;
  if (!files.length) return "Choose at least one file.";
  if (files.length > maxCount) return `A document can contain up to ${maxCount} files.`;
  for (const file of files) {
    const extension = fileExtension(file);
    if (!file.size) return `${file.name} is empty or unreadable.`;
    if (file.size > maxBytes) return `${file.name} is larger than the configured file limit.`;
    if (!ALLOWED_DOCUMENT_FILES[file.type]?.includes(extension)) return `${file.name} must be a JPG, PNG, WebP, or PDF.`;
  }
  return "";
}
export function normalizeExternalUrl(value) {
  const raw = value.trim(); if (!raw) throw new Error("A URL is required.");
  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  const url = new URL(withProtocol);
  if (!["https:", "http:"].includes(url.protocol)) throw new Error("Only HTTP and HTTPS links are allowed.");
  return { url: url.toString(), warning: url.protocol === "http:" ? "This link is not encrypted (HTTP)." : "" };
}
export function documentTypeIsFinancial(label = "") { return ["bill", "invoice", "receipt"].includes(label.trim().toLowerCase()); }
export function documentMatchesProject(record, projectId, clientId, expenses, income) {
  if (record.projectId !== projectId || record.clientId !== clientId) throw new Error("Document project and client must match.");
  if (record.expenseId && !expenses.some((item) => item.id === record.expenseId && item.projectId === projectId)) throw new Error("Linked expense must belong to this project.");
  if (record.incomeId && !income.some((item) => item.id === record.incomeId && item.projectId === projectId && item.sourceType === "Project Payment")) throw new Error("Linked payment must belong to this project.");
  return true;
}
export const activeDocuments = (records) => records.filter((item) => !item.isArchived);
