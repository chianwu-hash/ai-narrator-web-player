import assert from "node:assert/strict";
import test from "node:test";
import { validateContentComment } from "../src/lib/comment-model.ts";

test("validates a book comment", () => {
  const result = validateContentComment({
    targetType: "book",
    bookId: "book-1",
    bookTitle: "Example Book",
    commentType: "reflection",
    body: "  很有感的一段導讀。  ",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.body, "很有感的一段導讀。");
    assert.equal(result.value.episodeId, undefined);
  }
});

test("requires episode fields for episode comments", () => {
  const result = validateContentComment({
    targetType: "episode",
    bookId: "book-1",
    bookTitle: "Example Book",
    commentType: "error_report",
    body: "人物關係說錯了。",
  });
  assert.equal(result.ok, false);
});

test("rejects short or unknown comment values", () => {
  assert.equal(validateContentComment({ targetType: "book", bookId: "b", bookTitle: "t", commentType: "bad", body: "hello" }).ok, false);
  assert.equal(validateContentComment({ targetType: "book", bookId: "b", bookTitle: "t", commentType: "other", body: "短" }).ok, false);
});
