import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPromptDedupKey,
  createBackupZip,
  decodeZip,
  encodeZip,
  matchesOrganizationQuery,
  normalizeCollection,
  normalizeTags,
  parseBackupZip,
  parseLegacyJsonBackup,
} from "../prompt-organization-backup-core.mjs";

const samplePrompt = {
  llmType: "CHATGPT",
  title: "코드 리뷰",
  content: "다음 코드를 검토해줘.",
  version: 2,
  createdAt: 100,
  updatedAt: 200,
  isFavorite: true,
  collection: "개발",
  tags: ["Kotlin", "리뷰"],
  images: [{
    id: "screen-1",
    name: "화면.png",
    type: "image/png",
    dataUrl: "data:image/png;base64,AQIDBA==",
  }],
};

test("컬렉션과 태그를 정규화하고 중복을 제거한다", () => {
  assert.equal(normalizeCollection("  개발 도구  "), "개발 도구");
  assert.deepEqual(normalizeTags([" #Kotlin ", "kotlin", "리뷰", ""]), ["Kotlin", "리뷰"]);
});

test("검색은 제목, 본문, 컬렉션 및 태그를 포함한다", () => {
  assert.equal(matchesOrganizationQuery(samplePrompt, "개발"), true);
  assert.equal(matchesOrganizationQuery(samplePrompt, "kotlin"), true);
  assert.equal(matchesOrganizationQuery(samplePrompt, "없는 값"), false);
});

test("ZIP 저장 방식은 유니코드 파일명과 바이너리를 왕복한다", () => {
  const encoded = encodeZip([
    { name: "manifest.json", data: new TextEncoder().encode("{}") },
    { name: "images/화면.bin", data: new Uint8Array([0, 1, 2, 255]) },
  ], 0);
  const decoded = decodeZip(encoded);
  assert.equal(new TextDecoder().decode(decoded.get("manifest.json")), "{}");
  assert.deepEqual([...decoded.get("images/화면.bin")], [0, 1, 2, 255]);
});

test("ZIP 백업은 이미지 파일을 분리하고 프롬프트를 복원한다", () => {
  const zip = createBackupZip([samplePrompt], { appVersion: "1.1.0", exportedAt: 1234 });
  const files = decodeZip(zip);
  assert.ok(files.has("manifest.json"));
  assert.ok(files.has("prompts.json"));
  assert.ok([...files.keys()].some((name) => name.startsWith("images/")));

  const restored = parseBackupZip(zip);
  assert.equal(restored.manifest.schemaVersion, 3);
  assert.equal(restored.manifest.imageCount, 1);
  assert.deepEqual(restored.prompts[0], samplePrompt);
});

test("손상된 ZIP 데이터는 체크섬 검증에서 거부한다", () => {
  const zip = createBackupZip([samplePrompt]);
  const damaged = zip.slice();
  const files = decodeZip(zip);
  const imageName = [...files.keys()].find((name) => name.startsWith("images/"));
  assert.ok(imageName);
  let offset = 0;
  let dataOffset = -1;
  while (offset + 30 <= damaged.length) {
    const view = new DataView(damaged.buffer, offset, 30);
    if (view.getUint32(0, true) !== 0x04034b50) break;
    const size = view.getUint32(18, true);
    const nameLength = view.getUint16(26, true);
    const extraLength = view.getUint16(28, true);
    const nameStart = offset + 30;
    const name = new TextDecoder().decode(damaged.subarray(nameStart, nameStart + nameLength));
    const entryDataOffset = nameStart + nameLength + extraLength;
    if (name === imageName) {
      dataOffset = entryDataOffset;
      break;
    }
    offset = entryDataOffset + size;
  }
  assert.ok(dataOffset >= 0);
  damaged[dataOffset] ^= 0xff;
  assert.throws(() => parseBackupZip(damaged), /체크섬/);
});

test("기존 JSON 백업도 컬렉션과 태그를 포함해 복원한다", () => {
  const prompts = parseLegacyJsonBackup({ schemaVersion: 2, prompts: [samplePrompt] });
  assert.deepEqual(prompts[0], samplePrompt);
});

test("중복 기준은 LLM, 제목, 본문만 사용한다", () => {
  const first = buildPromptDedupKey(samplePrompt);
  const second = buildPromptDedupKey({ ...samplePrompt, collection: "다른 컬렉션", tags: ["다른 태그"] });
  assert.equal(first, second);
});
