export const CUSTOM_LLM_NAME_MAX_LENGTH = 10;
export const BUILTIN_LLMS = Object.freeze([
  Object.freeze({ type: "CHATGPT", label: "ChatGPT", custom: false }),
  Object.freeze({ type: "GEMINI", label: "Gemini", custom: false }),
  Object.freeze({ type: "GROK", label: "Grok", custom: false }),
  Object.freeze({ type: "CLAUDE", label: "Claude", custom: false }),
]);

function characterLength(value) {
  return [...String(value ?? "")].length;
}

function normalizedLabelKey(value) {
  return String(value ?? "").trim().toLocaleLowerCase("ko-KR");
}

export function createCustomLlmType(name) {
  const normalized = String(name ?? "").trim();
  try {
    return `CUSTOM:${encodeURIComponent(normalized)}`;
  } catch {
    throw new Error("LLM 이름에 사용할 수 없는 문자가 포함되어 있습니다.");
  }
}

function validateNameShape(value) {
  if (typeof value !== "string") throw new Error("LLM 이름이 올바르지 않습니다.");
  const name = value.trim();
  if (!name) throw new Error("LLM 이름을 입력하세요.");
  if (characterLength(name) > CUSTOM_LLM_NAME_MAX_LENGTH) {
    throw new Error(`LLM 이름은 ${CUSTOM_LLM_NAME_MAX_LENGTH}자까지 입력할 수 있습니다.`);
  }
  if (/[\u0000-\u001f\u007f]/u.test(name)) throw new Error("LLM 이름에 제어 문자를 사용할 수 없습니다.");
  createCustomLlmType(name);
  return name;
}

export function normalizeCustomLlms(values, { strict = false } = {}) {
  if (!Array.isArray(values)) {
    if (strict) throw new Error("사용자 정의 LLM 목록이 올바르지 않습니다.");
    return [];
  }

  const result = [];
  const ids = new Set();
  const labels = new Set(BUILTIN_LLMS.map(({ label }) => normalizedLabelKey(label)));

  for (const value of values) {
    try {
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("사용자 정의 LLM 항목이 올바르지 않습니다.");
      const name = validateNameShape(value.name);
      const id = createCustomLlmType(name);
      if (value.id !== id) throw new Error(`사용자 정의 LLM ID가 이름과 일치하지 않습니다: ${name}`);
      const labelKey = normalizedLabelKey(name);
      if (ids.has(id) || labels.has(labelKey)) throw new Error(`중복된 LLM 이름입니다: ${name}`);
      ids.add(id);
      labels.add(labelKey);
      result.push({ id, name });
    } catch (error) {
      if (strict) throw error;
    }
  }
  return result;
}

export function createCustomLlmRecord(value, existingCustomLlms = []) {
  const name = validateNameShape(value);
  const labelKey = normalizedLabelKey(name);
  const definitions = getLlmDefinitions(existingCustomLlms);
  if (definitions.some(({ label }) => normalizedLabelKey(label) === labelKey)) {
    throw new Error("이미 등록된 LLM 이름입니다.");
  }
  return { id: createCustomLlmType(name), name };
}

export function getLlmDefinitions(customLlms = []) {
  return [
    ...BUILTIN_LLMS.map((item) => ({ ...item })),
    ...normalizeCustomLlms(customLlms).map(({ id, name }) => ({ type: id, label: name, custom: true })),
  ];
}

export function isKnownLlmType(type, customLlms = []) {
  return getLlmDefinitions(customLlms).some((item) => item.type === type);
}

export function getLlmLabel(type, customLlms = []) {
  return getLlmDefinitions(customLlms).find((item) => item.type === type)?.label ?? String(type ?? "");
}

export function mergeCustomLlms(current, incoming) {
  const merged = normalizeCustomLlms(current, { strict: true });
  const seenIds = new Set(merged.map(({ id }) => id));
  const seenLabels = new Set(merged.map(({ name }) => normalizedLabelKey(name)));
  for (const item of normalizeCustomLlms(incoming, { strict: true })) {
    if (seenIds.has(item.id)) continue;
    const labelKey = normalizedLabelKey(item.name);
    if (seenLabels.has(labelKey)) throw new Error(`중복된 LLM 이름입니다: ${item.name}`);
    seenIds.add(item.id);
    seenLabels.add(labelKey);
    merged.push(item);
  }
  return merged;
}
