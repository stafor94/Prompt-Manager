import test from "node:test";
import assert from "node:assert/strict";
import { parseReleaseNotes } from "../release-notes-core.mjs";

test("버전, 날짜, 구분 및 항목을 릴리즈 노트로 파싱한다", () => {
  const notes = parseReleaseNotes(`
# 변경 이력

## [1.2.0] - 2026-08-06

### 추가

- 새 기능을 추가했습니다.

### 수정

- 표시 오류를 수정했습니다.

## [1.1.0] - 2026-08-05

### 변경

- 기존 동작을 변경했습니다.
`);

  assert.deepEqual(notes, [
    {
      version: "1.2.0",
      date: "2026-08-06",
      groups: [
        { title: "추가", items: ["새 기능을 추가했습니다."] },
        { title: "수정", items: ["표시 오류를 수정했습니다."] },
      ],
    },
    {
      version: "1.1.0",
      date: "2026-08-05",
      groups: [
        { title: "변경", items: ["기존 동작을 변경했습니다."] },
      ],
    },
  ]);
});

test("항목이 없는 미출시 섹션은 표시 대상에서 제외한다", () => {
  const notes = parseReleaseNotes(`
## [미출시]

현재 예정된 변경 사항이 없습니다.

## [1.0.0] - 2026-08-06

### 추가

- 최초 릴리즈입니다.
`);

  assert.equal(notes.length, 1);
  assert.equal(notes[0].version, "1.0.0");
});
