const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

function sanitizeFileName(fileName) {
  return String(fileName || "file")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");
}

function normalizeStorageKey(storageKey) {
  const normalized = path.posix.normalize(String(storageKey || "")).replace(/^(\.\.(\/|\\|$))+/, "");
  if (!normalized || normalized.startsWith("..")) {
    throw new Error("Invalid storage key");
  }
  return normalized;
}

function resolveStoragePath(storageKey) {
  const normalized = normalizeStorageKey(storageKey);
  const fullPath = path.join(UPLOAD_ROOT, normalized);
  if (!fullPath.startsWith(UPLOAD_ROOT)) {
    throw new Error("Invalid storage path");
  }
  return fullPath;
}

async function uploadFile(file, folder) {
  if (!file || !file.buffer || !file.originalname) {
    throw new Error("Invalid upload payload");
  }

  const safeFolder = normalizeStorageKey(folder);
  const safeName = sanitizeFileName(file.originalname);
  const uniqueName = `${Date.now()}-${safeName}`;
  const storageKey = path.posix.join(safeFolder, uniqueName);
  const destinationPath = resolveStoragePath(storageKey);

  await fsp.mkdir(path.dirname(destinationPath), { recursive: true });
  await fsp.writeFile(destinationPath, file.buffer);

  return {
    storageKey,
    publicUrl: null,
    fileName: safeName,
    mimeType: file.mimetype || "application/octet-stream",
    sizeInBytes: Number(file.size || Buffer.byteLength(file.buffer)),
  };
}

async function deleteFile(storageKey) {
  const fullPath = resolveStoragePath(storageKey);
  if (!fs.existsSync(fullPath)) {
    return;
  }
  await fsp.unlink(fullPath);
}

module.exports = {
  UPLOAD_ROOT,
  uploadFile,
  deleteFile,
  resolveStoragePath,
};
