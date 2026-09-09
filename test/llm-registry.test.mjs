import test from "node:test";
import assert from "node:assert/strict";
import {
  createCustomLlmRecord,
  createCustomLlmType,
  getLlmLabel,
  isKnownLlmType,
  mergeCustomLlms,
  normalizeCustomLlms,
} from "../llm-registry.mjs";

test("사용자 정의 LLM 이름은 10자까지 허용하고 안정적인 ID를 만든다", () => {
  const record = createCustomLlmRecord("Perplexity");
  assert.deepEqual(record, { id: createCustomLlmType("Perplexity"), name: "Perplexity" });
  assert.throws(() => createCustomLlmRecord("12345678901"), /10자/);
});

test("기본 LLM 또는 기존 사용자 정의 LLM과 같은 이름은 거부한다", () => {
  assert.throws(() => createCustomLlmRecord("chatgpt"), /이미 등록/);
  const first = createCustomLlmRecord("Llama");
  assert.throws(() => createCustomLlmRecord("llama", [first]), /이미 등록/);
});

test("사용자 정의 LLM은 라벨 조회와 유효성 검사에서 기본 LLM과 동일하게 취급한다", () => {
  const record = createCustomLlmRecord("Llama");
  assert.equal(isKnownLlmType(record.id, [record]), true);
  assert.equal(getLlmLabel(record.id, [record]), "Llama");
});

test("복원용 목록은 무결성을 검증하고 기존 목록과 병합한다", () => {
  const llama = createCustomLlmRecord("Llama");
  const mistral = createCustomLlmRecord("Mistral");
  assert.deepEqual(mergeCustomLlms([llama], [llama, mistral]), [llama, mistral]);
  assert.throws(() => normalizeCustomLlms([{ id: "CUSTOM:bad", name: "Llama" }], { strict: true }), /ID/);
});
