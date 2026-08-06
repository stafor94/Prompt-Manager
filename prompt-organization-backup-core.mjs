export const BACKUP_FORMAT = "prompt-manager-backup";
export const BACKUP_SCHEMA_VERSION = 3;
export const MAX_TAGS = 20;
export const TAG_MAX_LENGTH = 30;
export const COLLECTION_MAX_LENGTH = 40;
export const TITLE_MAX_LENGTH = 50;
export const MAX_IMAGES = 5;
export const VALID_LLM_TYPES = new Set(["CHATGPT", "GEMINI", "GROK", "CLAUDE"]);

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

export function normalizeCollection(value) {
  if (typeof value !== "string") return "";
  return [...value.trim()].slice(0, COLLECTION_MAX_LENGTH).join("");
}

export function normalizeTags(values) {
  const source = Array.isArray(values) ? values : [];
  const seen = new Set();
  const result = [];
  for (const value of source) {
    if (typeof value !== "string") continue;
    const normalized = [...value.trim().replace(/^#+/, "")].slice(0, TAG_MAX_LENGTH).join("");
    if (!normalized) continue;
    const key = normalized.toLocaleLowerCase("ko-KR");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= MAX_TAGS) break;
  }
  return result;
}

export function buildPromptDedupKey(prompt) {
  return `${prompt.llmType}\u0000${prompt.title}\u0000${prompt.content}`;
}

export function matchesOrganizationQuery(prompt, query) {
  const needle = String(query ?? "").trim().toLocaleLowerCase("ko-KR");
  if (!needle) return true;
  const haystack = [
    prompt.title,
    prompt.content,
    normalizeCollection(prompt.collection),
    ...normalizeTags(prompt.tags),
  ].join("\n").toLocaleLowerCase("ko-KR");
  return haystack.includes(needle);
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function dosDateTime(timestamp = Date.now()) {
  const date = new Date(timestamp);
  const year = Math.max(1980, date.getFullYear());
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

export function encodeZip(entries, timestamp = Date.now()) {
  if (!Array.isArray(entries) || entries.length === 0) throw new Error("ZIP에 포함할 파일이 없습니다.");
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  const { time, day } = dosDateTime(timestamp);

  for (const entry of entries) {
    if (!entry || typeof entry.name !== "string" || !entry.name || entry.name.includes("..") || entry.name.startsWith("/")) {
      throw new Error("ZIP 파일 경로가 올바르지 않습니다.");
    }
    const name = textEncoder.encode(entry.name.replaceAll("\\", "/"));
    const data = entry.data instanceof Uint8Array ? entry.data : new Uint8Array(entry.data);
    const checksum = crc32(data);

    const localHeader = new Uint8Array(30 + name.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, time, true);
    localView.setUint16(12, day, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, name.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(name, 30);
    localParts.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + name.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, time, true);
    centralView.setUint16(14, day, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, localOffset, true);
    centralHeader.set(name, 46);
    centralParts.push(centralHeader);
    localOffset += localHeader.length + data.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralDirectory.length, true);
  endView.setUint32(16, localOffset, true);
  endView.setUint16(20, 0, true);
  return concatBytes([...localParts, centralDirectory, end]);
}

function findEndOfCentralDirectory(bytes) {
  const minimum = Math.max(0, bytes.length - 65557);
  for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
    if (new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, true) === 0x06054b50) return offset;
  }
  return -1;
}

export function decodeZip(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const endOffset = findEndOfCentralDirectory(bytes);
  if (endOffset < 0) throw new Error("올바른 ZIP 파일이 아닙니다.");
  const endView = new DataView(bytes.buffer, bytes.byteOffset + endOffset, 22);
  const entryCount = endView.getUint16(10, true);
  const centralSize = endView.getUint32(12, true);
  const centralOffset = endView.getUint32(16, true);
  if (centralOffset + centralSize > bytes.length) throw new Error("ZIP 중앙 디렉터리가 손상되었습니다.");

  const files = new Map();
  let offset = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > bytes.length) throw new Error("ZIP 파일 목록이 손상되었습니다.");
    const centralView = new DataView(bytes.buffer, bytes.byteOffset + offset, 46);
    if (centralView.getUint32(0, true) !== 0x02014b50) throw new Error("ZIP 중앙 디렉터리 형식이 올바르지 않습니다.");
    const method = centralView.getUint16(10, true);
    if (method !== 0) throw new Error("지원하지 않는 ZIP 압축 방식입니다.");
    const expectedCrc = centralView.getUint32(16, true);
    const compressedSize = centralView.getUint32(20, true);
    const uncompressedSize = centralView.getUint32(24, true);
    const nameLength = centralView.getUint16(28, true);
    const extraLength = centralView.getUint16(30, true);
    const commentLength = centralView.getUint16(32, true);
    const localHeaderOffset = centralView.getUint32(42, true);
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > bytes.length) throw new Error("ZIP 파일명이 손상되었습니다.");
    const name = textDecoder.decode(bytes.subarray(nameStart, nameEnd));
    if (!name || name.includes("..") || name.startsWith("/") || files.has(name)) throw new Error("ZIP 파일 경로가 올바르지 않습니다.");

    if (localHeaderOffset + 30 > bytes.length) throw new Error("ZIP 로컬 헤더가 손상되었습니다.");
    const localView = new DataView(bytes.buffer, bytes.byteOffset + localHeaderOffset, 30);
    if (localView.getUint32(0, true) !== 0x04034b50) throw new Error("ZIP 로컬 헤더 형식이 올바르지 않습니다.");
    const localNameLength = localView.getUint16(26, true);
    const localExtraLength = localView.getUint16(28, true);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.length || compressedSize !== uncompressedSize) throw new Error("ZIP 파일 데이터가 손상되었습니다.");
    const data = bytes.slice(dataStart, dataEnd);
    if (crc32(data) !== expectedCrc) throw new Error(`${name} 파일의 체크섬이 일치하지 않습니다.`);
    files.set(name, data);
    offset = nameEnd + extraLength + commentLength;
  }
  return files;
}

function base64ToBytes(base64) {
  if (typeof atob === "function") {
    const binary = atob(base64);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }
  return new Uint8Array(Buffer.from(base64, "base64"));
}

function bytesToBase64(bytes) {
  if (typeof btoa === "function") {
    let binary = "";
    const chunk = 0x8000;
    for (let index = 0; index < bytes.length; index += chunk) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
    }
    return btoa(binary);
  }
  return Buffer.from(bytes).toString("base64");
}

function parseDataUrl(dataUrl) {
  if (typeof dataUrl !== "string") throw new Error("이미지 데이터가 없습니다.");
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl);
  if (!match) throw new Error("이미지 데이터 형식이 올바르지 않습니다.");
  return { type: match[1].toLowerCase(), bytes: base64ToBytes(match[2].replaceAll(/\s/g, "")) };
}

function extensionForMime(type) {
  const subtype = type.split("/")[1]?.toLowerCase() ?? "bin";
  const normalized = subtype === "jpeg" ? "jpg" : subtype.replace("svg+xml", "svg").replace(/[^a-z0-9]/g, "");
  return normalized || "bin";
}

function safeSegment(value, fallback) {
  const segment = String(value ?? "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  return segment || fallback;
}

function jsonBytes(value) {
  return textEncoder.encode(JSON.stringify(value, null, 2));
}

function parseJsonBytes(bytes, label) {
  try {
    return JSON.parse(textDecoder.decode(bytes));
  } catch {
    throw new Error(`${label} JSON을 해석할 수 없습니다.`);
  }
}

function validatePromptBase(prompt, index) {
  const fail = (reason) => { throw new Error(`${index + 1}번째 프롬프트: ${reason}`); };
  if (!prompt || typeof prompt !== "object" || Array.isArray(prompt)) fail("객체가 아닙니다.");
  if (!VALID_LLM_TYPES.has(prompt.llmType)) fail("LLM 종류가 올바르지 않습니다.");
  if (typeof prompt.title !== "string" || !prompt.title.trim()) fail("제목이 없습니다.");
  if ([...prompt.title].length > TITLE_MAX_LENGTH) fail(`제목은 ${TITLE_MAX_LENGTH}자까지 허용됩니다.`);
  if (typeof prompt.content !== "string" || !prompt.content.trim()) fail("본문이 없습니다.");
  if (!Number.isFinite(prompt.createdAt) || prompt.createdAt < 0) fail("생성 일시가 올바르지 않습니다.");
  if (!Number.isFinite(prompt.updatedAt) || prompt.updatedAt < 0) fail("수정 일시가 올바르지 않습니다.");
  if (typeof prompt.isFavorite !== "boolean") fail("즐겨찾기 값이 올바르지 않습니다.");
  if (prompt.version !== undefined && (!Number.isInteger(prompt.version) || prompt.version < 1)) fail("버전 값이 올바르지 않습니다.");
  const collection = normalizeCollection(prompt.collection);
  if (typeof prompt.collection === "string" && [...prompt.collection.trim()].length > COLLECTION_MAX_LENGTH) fail(`컬렉션은 ${COLLECTION_MAX_LENGTH}자까지 허용됩니다.`);
  const tags = normalizeTags(prompt.tags);
  if (Array.isArray(prompt.tags) && prompt.tags.length > MAX_TAGS) fail(`태그는 최대 ${MAX_TAGS}개까지 허용됩니다.`);
  return {
    llmType: prompt.llmType,
    title: prompt.title,
    content: prompt.content,
    ...(Number.isInteger(prompt.version) && prompt.version > 0 ? { version: prompt.version } : {}),
    createdAt: prompt.createdAt,
    updatedAt: prompt.updatedAt,
    isFavorite: prompt.isFavorite,
    collection,
    tags,
  };
}

export function createBackupZip(prompts, { appVersion = "0.0.0", exportedAt = Date.now() } = {}) {
  if (!Array.isArray(prompts)) throw new Error("백업할 프롬프트 목록이 올바르지 않습니다.");
  const entries = [];
  const promptRecords = [];
  let imageCount = 0;

  prompts.forEach((source, promptIndex) => {
    const base = validatePromptBase(source, promptIndex);
    const images = Array.isArray(source.images) ? source.images : [];
    if (images.length > MAX_IMAGES) throw new Error(`${promptIndex + 1}번째 프롬프트: 이미지는 최대 ${MAX_IMAGES}장까지 허용됩니다.`);
    const imageRecords = images.map((image, imageIndex) => {
      if (!image || typeof image !== "object") throw new Error(`${promptIndex + 1}번째 프롬프트: 이미지 정보가 올바르지 않습니다.`);
      const parsed = parseDataUrl(image.dataUrl);
      const imageId = safeSegment(image.id, `image-${imageIndex + 1}`);
      const path = `images/prompt-${String(promptIndex + 1).padStart(4, "0")}/${String(imageIndex + 1).padStart(2, "0")}-${imageId}.${extensionForMime(parsed.type)}`;
      entries.push({ name: path, data: parsed.bytes });
      imageCount += 1;
      return {
        id: typeof image.id === "string" && image.id ? image.id : imageId,
        name: typeof image.name === "string" && image.name ? image.name : "첨부 이미지",
        type: parsed.type,
        path,
      };
    });
    promptRecords.push({ ...base, images: imageRecords });
  });

  const promptsBytes = jsonBytes({ prompts: promptRecords });
  entries.unshift({ name: "prompts.json", data: promptsBytes });
  const fileMetadata = entries.map((entry) => ({
    path: entry.name,
    byteLength: entry.data.length,
    crc32: crc32(entry.data).toString(16).padStart(8, "0"),
  }));
  const manifest = {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion,
    exportedAt,
    promptCount: promptRecords.length,
    imageCount,
    files: fileMetadata,
  };
  entries.unshift({ name: "manifest.json", data: jsonBytes(manifest) });
  return encodeZip(entries, exportedAt);
}

export function parseBackupZip(input) {
  const files = decodeZip(input);
  const manifestBytes = files.get("manifest.json");
  const promptsBytes = files.get("prompts.json");
  if (!manifestBytes || !promptsBytes) throw new Error("manifest.json 또는 prompts.json이 없습니다.");
  const manifest = parseJsonBytes(manifestBytes, "manifest.json");
  if (manifest?.format !== BACKUP_FORMAT) throw new Error("Prompt Manager 백업 파일이 아닙니다.");
  if (manifest.schemaVersion !== BACKUP_SCHEMA_VERSION) throw new Error(`지원하지 않는 schemaVersion입니다: ${manifest.schemaVersion}`);
  if (!Array.isArray(manifest.files)) throw new Error("백업 파일 목록이 없습니다.");
  for (const file of manifest.files) {
    if (!file || typeof file.path !== "string" || !Number.isInteger(file.byteLength) || typeof file.crc32 !== "string") {
      throw new Error("백업 파일 목록이 올바르지 않습니다.");
    }
    const bytes = files.get(file.path);
    if (!bytes) throw new Error(`${file.path} 파일이 없습니다.`);
    if (bytes.length !== file.byteLength) throw new Error(`${file.path} 파일 크기가 일치하지 않습니다.`);
    if (crc32(bytes).toString(16).padStart(8, "0") !== file.crc32.toLowerCase()) {
      throw new Error(`${file.path} 파일의 체크섬이 일치하지 않습니다.`);
    }
  }

  const parsed = parseJsonBytes(promptsBytes, "prompts.json");
  if (!Array.isArray(parsed?.prompts)) throw new Error("prompts 배열이 없습니다.");
  const prompts = parsed.prompts.map((prompt, index) => {
    const base = validatePromptBase(prompt, index);
    const imageRecords = prompt.images === undefined ? [] : prompt.images;
    if (!Array.isArray(imageRecords) || imageRecords.length > MAX_IMAGES) {
      throw new Error(`${index + 1}번째 프롬프트: 이미지 목록이 올바르지 않습니다.`);
    }
    const images = imageRecords.map((image, imageIndex) => {
      if (!image || typeof image.path !== "string" || typeof image.type !== "string" || !image.type.startsWith("image/")) {
        throw new Error(`${index + 1}번째 프롬프트: ${imageIndex + 1}번째 이미지 정보가 올바르지 않습니다.`);
      }
      const bytes = files.get(image.path);
      if (!bytes) throw new Error(`${image.path} 이미지 파일이 없습니다.`);
      return {
        id: typeof image.id === "string" && image.id ? image.id : `image-${index + 1}-${imageIndex + 1}`,
        name: typeof image.name === "string" && image.name ? image.name : "첨부 이미지",
        type: image.type,
        dataUrl: `data:${image.type};base64,${bytesToBase64(bytes)}`,
      };
    });
    return { ...base, images };
  });
  if (manifest.promptCount !== prompts.length) throw new Error("매니페스트의 프롬프트 수가 일치하지 않습니다.");
  const imageCount = prompts.reduce((sum, prompt) => sum + prompt.images.length, 0);
  if (manifest.imageCount !== imageCount) throw new Error("매니페스트의 이미지 수가 일치하지 않습니다.");
  return { manifest, prompts };
}

export function parseLegacyJsonBackup(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("백업 파일 형식이 올바르지 않습니다.");
  if (![1, 2].includes(data.schemaVersion)) throw new Error(`지원하지 않는 schemaVersion입니다: ${data.schemaVersion}`);
  if (!Array.isArray(data.prompts)) throw new Error("prompts 배열이 없습니다.");
  return data.prompts.map((prompt, index) => {
    const base = validatePromptBase(prompt, index);
    const imageRecords = prompt.images === undefined ? [] : prompt.images;
    if (!Array.isArray(imageRecords) || imageRecords.length > MAX_IMAGES) {
      throw new Error(`${index + 1}번째 프롬프트: 이미지 목록이 올바르지 않습니다.`);
    }
    const images = imageRecords.map((image, imageIndex) => {
      if (!image || typeof image.dataUrl !== "string" || !image.dataUrl.startsWith("data:image/")) {
        throw new Error(`${index + 1}번째 프롬프트: ${imageIndex + 1}번째 이미지 데이터가 올바르지 않습니다.`);
      }
      parseDataUrl(image.dataUrl);
      return {
        id: typeof image.id === "string" && image.id ? image.id : `image-${index + 1}-${imageIndex + 1}`,
        name: typeof image.name === "string" && image.name ? image.name : "첨부 이미지",
        type: typeof image.type === "string" && image.type.startsWith("image/") ? image.type : "image/*",
        dataUrl: image.dataUrl,
      };
    });
    return { ...base, images };
  });
}
