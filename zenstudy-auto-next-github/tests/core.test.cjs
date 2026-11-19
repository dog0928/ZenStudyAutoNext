"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../ZenStudy-Auto-Next-extension Extension/Resources/core.js");

function mockElement(options = {}) {
  const attributes = options.attributes || {};
  const element = {
    tagName: options.tagName || "BUTTON",
    textContent: options.textContent || "",
    disabled: Boolean(options.disabled),
    hidden: Boolean(options.hidden),
    className: options.className || "",
    parentElement: options.parentElement || null,
    children: options.children || [],
    matches(selector) {
      return selector === ".custom-next" && options.isCustom;
    },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(attributes, name) ? attributes[name] : null;
    },
    getClientRects() {
      return options.hidden ? [] : [{}];
    },
    getBoundingClientRect() {
      return options.rect || { top: 0, left: 0, width: 10, height: 10 };
    }
  };
  return element;
}

function mockDocument(defaultElements, customElements = [], options = {}) {
  return {
    defaultView: null,
    location: { href: options.url || "https://www.nnn.ed.nico/lesson/current" },
    querySelectorAll(selector) {
      if (selector === ".custom-next") {
        return customElements;
      }
      if (selector === "h1,h2,h3,[role='heading']") {
        return options.headings || [];
      }
      return defaultElements;
    }
  };
}

test("日本語の『次の動画』ボタンを高く評価する", () => {
  const next = mockElement({ textContent: "次の動画へ" });
  assert.ok(core.scoreElement(next) >= core.MINIMUM_SCORE);
});

test("『前へ』ボタンは候補にしない", () => {
  const previous = mockElement({ textContent: "前へ戻る" });
  assert.ok(core.scoreElement(previous) < core.MINIMUM_SCORE);
});

test("無効または非表示のボタンは候補にしない", () => {
  assert.equal(core.scoreElement(mockElement({ textContent: "次へ", disabled: true })), Number.NEGATIVE_INFINITY);
  assert.equal(core.scoreElement(mockElement({ textContent: "次へ", hidden: true })), Number.NEGATIVE_INFINITY);
});

test("rel=next を優先して見つける", () => {
  const ordinary = mockElement({ textContent: "次へ" });
  const relNext = mockElement({
    tagName: "A",
    textContent: "続き",
    attributes: { rel: "next" }
  });
  const result = core.findBestCandidate(mockDocument([ordinary, relNext]));

  assert.equal(result.element, relNext);
});

test("カスタムセレクタは表示文言が不明でも利用できる", () => {
  const custom = mockElement({ textContent: "→", isCustom: true });
  const result = core.findBestCandidate(mockDocument([], [custom]), {
    customSelector: ".custom-next"
  });

  assert.equal(result.element, custom);
});

test("選択中の動画の直後にある動画行を返す", () => {
  const previous = mockElement({
    tagName: "A",
    textContent: "創造(1) 視聴済み 5:26",
    attributes: { href: "/lesson/previous" }
  });
  const current = mockElement({
    tagName: "A",
    textContent: "創造(2) 視聴済み 4:57",
    attributes: { href: "/lesson/current", "aria-current": "page" }
  });
  const next = mockElement({
    tagName: "A",
    textContent: "卓球(1) 視聴済み 2:52",
    attributes: { href: "/lesson/table-tennis-1" }
  });
  const result = core.findNextPlaylistCandidate(mockDocument([previous, current, next]));

  assert.equal(result.element, next);
  assert.equal(result.strategy, "playlist");
});

test("確認テスト行を飛ばして次の動画を選ぶ", () => {
  const current = mockElement({
    tagName: "A",
    textContent: "卓球(2) 3:17",
    attributes: { href: "/lesson/current", "aria-current": "page" }
  });
  const quiz = mockElement({
    tagName: "A",
    textContent: "第4回 確認テスト 2問",
    attributes: { href: "/quiz/4" }
  });
  const next = mockElement({
    tagName: "A",
    textContent: "卓球(3) 3:00",
    attributes: { href: "/lesson/table-tennis-3" }
  });
  const result = core.findNextPlaylistCandidate(mockDocument([current, quiz, next]));

  assert.equal(result.element, next);
});

test("現在行を特定できない場合は誤クリックしない", () => {
  const first = mockElement({ textContent: "動画A 1:00" });
  const second = mockElement({ textContent: "動画B 2:00" });

  assert.equal(core.findNextPlaylistCandidate(mockDocument([first, second])), null);
});

test("リンクでないdiv行も時間表示から検出する", () => {
  const currentRow = mockElement({
    tagName: "DIV",
    textContent: "創造(2) 視聴済み 4:57",
    className: "lesson-item selected"
  });
  const currentDuration = mockElement({
    tagName: "SPAN",
    textContent: "4:57",
    parentElement: currentRow,
    rect: { top: 100, left: 450, width: 35, height: 16 }
  });
  currentRow.children = [currentDuration];

  const nextRow = mockElement({
    tagName: "DIV",
    textContent: "卓球(1) 視聴済み 2:52"
  });
  const nextDuration = mockElement({
    tagName: "SPAN",
    textContent: "2:52",
    parentElement: nextRow,
    rect: { top: 160, left: 450, width: 35, height: 16 }
  });
  nextRow.children = [nextDuration];

  const result = core.findNextPlaylistCandidate(mockDocument([currentDuration, nextDuration]));

  assert.equal(result.element, nextDuration);
  assert.match(result.currentLabel, /創造\(2\)/);
  assert.match(result.label, /卓球\(1\)/);
});
