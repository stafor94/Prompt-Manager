import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile(new URL("../tag-ui-fixes.css", import.meta.url), "utf8");

test("상세 태그는 날짜와 본문 사이의 독립된 그리드 행을 사용한다", () => {
  assert.match(css, /grid-template-rows:\s*auto auto minmax\(0, 1fr\) auto/);
  assert.match(css, /#detailDialog #detailOrganization\s*\{[^}]*grid-row:\s*2/s);
  assert.match(css, /#detailDialog #detailContent\s*\{[^}]*grid-row:\s*3/s);
});

test("편집기 태그 삭제 버튼은 전역 48px 최소 높이를 재정의한다", () => {
  assert.match(css, /#editorDialog \.editable-tag-chip button\s*\{[^}]*min-height:\s*24px/s);
  assert.match(css, /#editorDialog \.editable-tag-chip\s*\{[^}]*gap:\s*2px/s);
  assert.match(css, /#editorDialog \.editable-tag-chip\s*\{[^}]*min-height:\s*30px/s);
});
