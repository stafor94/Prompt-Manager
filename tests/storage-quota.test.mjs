import test from "node:test";
import assert from "node:assert/strict";
import {
  formatQuotaInSummary,
  formatQuotaMegabytes,
} from "../storage-quota.mjs";

test("1,000MB 미만 할당량은 MB 단위를 유지한다", () => {
  assert.equal(formatQuotaMegabytes(999), "999MB");
  assert.equal(
    formatQuotaInSummary("할당량 약 999MB · 유지 설정 미적용"),
    "할당량 약 999MB · 유지 설정 미적용",
  );
});

test("1,000MB 이상 할당량은 GB 단위로 변환한다", () => {
  assert.equal(formatQuotaMegabytes(1000), "1GB");
  assert.equal(formatQuotaMegabytes(282450), "282.45GB");
  assert.equal(
    formatQuotaInSummary("이 사이트 데이터 약 35.02MB / 할당량 약 282450MB"),
    "이 사이트 데이터 약 35.02MB / 할당량 약 282.45GB",
  );
});

test("천 단위 구분 쉼표가 있는 할당량도 변환한다", () => {
  assert.equal(
    formatQuotaInSummary("할당량 약 282,450MB"),
    "할당량 약 282.45GB",
  );
});
