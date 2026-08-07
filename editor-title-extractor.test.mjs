import test from "node:test";
import assert from "node:assert/strict";
import { extractTitleFromPromptText } from "./editor-title-extractor.mjs";

test("[제목] 다음 줄을 제목으로 추출한다", () => {
  const text = `[제목]\n버스정류장·여성 2명·블라우스&플리츠룩\n\n[실행 지시]\n내용`;
  assert.equal(extractTitleFromPromptText(text), "버스정류장·여성 2명·블라우스&플리츠룩");
});

test("제목: 같은 줄 값을 추출한다", () => {
  assert.equal(extractTitleFromPromptText("제목: 버스정류장 룩"), "버스정류장 룩");
});

test("타이틀 라벨과 앞뒤 특수문자를 허용한다", () => {
  assert.equal(extractTitleFromPromptText("*** 【타이틀】 ::: 버스정류장 룩"), "버스정류장 룩");
  assert.equal(extractTitleFromPromptText("## 타이틀 ##\n후면 전신 구도"), "후면 전신 구도");
});

test("제목/타이틀이 다른 단어의 일부이면 인식하지 않는다", () => {
  assert.equal(extractTitleFromPromptText("부제목: 잘못된 값"), "");
  assert.equal(extractTitleFromPromptText("제목없음\n잘못된 값"), "");
  assert.equal(extractTitleFromPromptText("타이틀곡: 잘못된 값"), "");
});

test("제목 라벨 다음 유효 줄이 섹션 헤더면 제목으로 사용하지 않는다", () => {
  assert.equal(extractTitleFromPromptText("[제목]\n\n[실행 지시]\n내용"), "");
});

test("제목 라벨 다음의 순수 기호 줄은 건너뛴다", () => {
  assert.equal(extractTitleFromPromptText("[타이틀]\n---\n버스정류장 룩"), "버스정류장 룩");
});

test("CRLF와 maxlength를 처리한다", () => {
  assert.equal(extractTitleFromPromptText("【제목】\r\n가나다라마바사", { maxLength: 4 }), "가나다라");
});
