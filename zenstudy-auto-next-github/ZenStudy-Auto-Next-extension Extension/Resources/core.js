(function initializeCore(root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.ZenStudyAutoNextCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCore() {
  "use strict";

  const MINIMUM_SCORE = 80;
  const EXACT_NEXT_LABELS = new Set([
    "次へ",
    "次の動画",
    "次の動画へ",
    "次の授業",
    "次の授業へ",
    "次の教材",
    "次の教材へ",
    "次の講義",
    "次の講義へ",
    "次のチャプター",
    "次のレッスン",
    "next",
    "next video",
    "continue"
  ]);

  function normalizeLabel(value) {
    return String(value || "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function readAttribute(element, name) {
    if (!element || typeof element.getAttribute !== "function") {
      return "";
    }

    return element.getAttribute(name) || "";
  }

  function elementLabel(element) {
    return normalizeLabel([
      element && element.textContent,
      readAttribute(element, "aria-label"),
      readAttribute(element, "title"),
      readAttribute(element, "data-testid"),
      readAttribute(element, "data-e2e"),
      readAttribute(element, "data-cy")
    ].filter(Boolean).join(" "));
  }

  function isDisabledElement(element) {
    return Boolean(
      !element ||
      element.disabled ||
      normalizeLabel(readAttribute(element, "aria-disabled")) === "true"
    );
  }

  function isVisibleElement(element) {
    if (!element) {
      return false;
    }

    if (element.hidden) {
      return false;
    }

    const ownerWindow = element.ownerDocument && element.ownerDocument.defaultView;
    if (ownerWindow && typeof ownerWindow.getComputedStyle === "function") {
      const style = ownerWindow.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
        return false;
      }
    }

    if (typeof element.getClientRects === "function") {
      return element.getClientRects().length > 0;
    }

    return true;
  }

  function scoreElement(element) {
    if (isDisabledElement(element) || !isVisibleElement(element)) {
      return Number.NEGATIVE_INFINITY;
    }

    const label = elementLabel(element);
    const rel = normalizeLabel(readAttribute(element, "rel"));
    const testId = normalizeLabel([
      readAttribute(element, "data-testid"),
      readAttribute(element, "data-e2e"),
      readAttribute(element, "data-cy")
    ].join(" "));
    const tagName = normalizeLabel(element.tagName);
    const role = normalizeLabel(readAttribute(element, "role"));
    let score = 0;

    if (/(^|\s)next($|\s)/.test(rel)) {
      score += 160;
    }

    if (EXACT_NEXT_LABELS.has(label)) {
      score += 130;
    } else if (/次の(動画|授業|教材|講義|チャプター|レッスン|コンテンツ)/.test(label)) {
      score += 110;
    } else if (label.includes("次へ")) {
      score += 95;
    } else if (/(^|\s)next($|\s)/.test(label)) {
      score += 85;
    }

    if (testId.includes("next")) {
      score += 100;
    }

    if (["a", "button"].includes(tagName) || role === "button") {
      score += 10;
    }

    if (/(前へ|前の|戻る|一覧|previous|back)/.test(label)) {
      score -= 240;
    }

    return score;
  }

  function distanceBonus(element, referenceElement) {
    if (
      !referenceElement ||
      typeof element.getBoundingClientRect !== "function" ||
      typeof referenceElement.getBoundingClientRect !== "function"
    ) {
      return 0;
    }

    const targetRect = element.getBoundingClientRect();
    const referenceRect = referenceElement.getBoundingClientRect();
    const targetX = targetRect.left + targetRect.width / 2;
    const targetY = targetRect.top + targetRect.height / 2;
    const referenceX = referenceRect.left + referenceRect.width / 2;
    const referenceY = referenceRect.top + referenceRect.height / 2;
    const distance = Math.hypot(targetX - referenceX, targetY - referenceY);

    return Math.max(0, 30 - distance / 100);
  }

  function queryCandidates(documentObject, customSelector) {
    const candidates = new Map();
    const defaultSelector = [
      "a[rel~='next']",
      "button",
      "a[href]",
      "[role='button']",
      "[data-testid]",
      "[data-e2e]",
      "[data-cy]"
    ].join(",");

    if (customSelector) {
      try {
        for (const element of documentObject.querySelectorAll(customSelector)) {
          candidates.set(element, 300);
        }
      } catch (error) {
        // 設定ミスで既定の探索まで止めない。
      }
    }

    for (const element of documentObject.querySelectorAll(defaultSelector)) {
      if (!candidates.has(element)) {
        candidates.set(element, 0);
      }
    }

    return candidates;
  }

  function findBestCandidate(documentObject, options) {
    if (!documentObject || typeof documentObject.querySelectorAll !== "function") {
      return null;
    }

    const settings = options || {};
    let best = null;

    const candidates = queryCandidates(documentObject, settings.customSelector);
    if (settings.customOnly) {
      for (const element of Array.from(candidates.keys())) {
        if (!settings.customSelector) {
          candidates.delete(element);
          continue;
        }

        try {
          if (typeof element.matches === "function" && !element.matches(settings.customSelector)) {
            candidates.delete(element);
          }
        } catch (error) {
          candidates.clear();
          break;
        }
      }
    }

    for (const [element, customBonus] of candidates) {
      const baseScore = scoreElement(element);
      if (!Number.isFinite(baseScore)) {
        continue;
      }

      const score = baseScore + customBonus + distanceBonus(element, settings.referenceElement);
      if (!best || score > best.score) {
        best = { element, score, label: elementLabel(element) };
      }
    }

    return best && best.score >= MINIMUM_SCORE ? best : null;
  }

  function hasVideoDuration(element) {
    return /(^|\s)\d{1,2}:\d{2}(?=\s|$)/.test(normalizeLabel(element && element.textContent));
  }

  function durationCount(element) {
    return (normalizeLabel(element && element.textContent).match(/(^|\s)\d{1,2}:\d{2}(?=\s|$)/g) || []).length;
  }

  function classValue(element) {
    if (!element) {
      return "";
    }

    if (typeof element.className === "string") {
      return element.className;
    }

    return readAttribute(element, "class");
  }

  function ancestorChain(element, maximumDepth) {
    const ancestors = [];
    let current = element;

    while (current && ancestors.length < maximumDepth) {
      ancestors.push(current);
      current = current.parentElement;
    }

    return ancestors;
  }

  function resolvedHref(element, documentObject) {
    let href = "";
    for (const ancestor of ancestorChain(element, 10)) {
      href = readAttribute(ancestor, "href");
      if (href) {
        break;
      }
    }
    const baseUrl = documentObject && documentObject.location && documentObject.location.href;
    if (!href || !baseUrl) {
      return "";
    }

    try {
      return new URL(href, baseUrl).href;
    } catch (error) {
      return "";
    }
  }

  function withoutHash(url) {
    return String(url || "").replace(/#.*$/, "");
  }

  function activeVisualScore(element) {
    const ownerWindow = element.ownerDocument && element.ownerDocument.defaultView;
    if (!ownerWindow || typeof ownerWindow.getComputedStyle !== "function") {
      return 0;
    }

    let score = 0;
    for (const ancestor of ancestorChain(element, 10)) {
      const style = ownerWindow.getComputedStyle(ancestor);
      const rightWidth = Number.parseFloat(style.borderRightWidth) || 0;
      const leftWidth = Number.parseFloat(style.borderLeftWidth) || 0;
      const borderColor = `${style.borderRightColor} ${style.borderLeftColor}`;
      if (Math.max(rightWidth, leftWidth) >= 2 && !/transparent|rgba\([^)]*,\s*0\)/.test(borderColor)) {
        score = Math.max(score, 125);
      }
    }

    return score;
  }

  function currentItemScore(element, documentObject, headingLabels, itemLabel) {
    let score = 0;
    const currentUrl = withoutHash(documentObject && documentObject.location && documentObject.location.href);
    const candidateUrl = withoutHash(resolvedHref(element, documentObject));
    const label = itemLabel || elementLabel(element);

    if (currentUrl && candidateUrl && currentUrl === candidateUrl) {
      score += 300;
    }

    for (const ancestor of ancestorChain(element, 10)) {
      const ariaCurrent = normalizeLabel(readAttribute(ancestor, "aria-current"));
      const state = normalizeLabel([
        classValue(ancestor),
        readAttribute(ancestor, "data-state"),
        readAttribute(ancestor, "data-selected")
      ].join(" "));

      if (ariaCurrent && ariaCurrent !== "false") {
        score += 260;
      }
      if (/(^|[-_\s])(active|current|selected)([-_\s]|$)/.test(state)) {
        score += 180;
      }
    }

    if (headingLabels.some((heading) => heading.length >= 4 && label.includes(heading))) {
      score += 170;
    }

    score += activeVisualScore(element);
    return score;
  }

  function headingLabels(documentObject) {
    const labels = [];
    for (const element of documentObject.querySelectorAll("h1,h2,h3,[role='heading']")) {
      const label = normalizeLabel(element.textContent);
      if (label.length >= 4 && label.length <= 120) {
        labels.push(label);
      }
    }
    return labels;
  }

  function isClickableElement(element) {
    const tagName = normalizeLabel(element && element.tagName);
    const role = normalizeLabel(readAttribute(element, "role"));
    const tabIndex = readAttribute(element, "tabindex");
    if (["a", "button"].includes(tagName) || ["button", "link", "menuitem"].includes(role)) {
      return true;
    }
    if (readAttribute(element, "href") || (tabIndex !== "" && Number(tabIndex) >= 0)) {
      return true;
    }

    const ownerWindow = element && element.ownerDocument && element.ownerDocument.defaultView;
    if (ownerWindow && typeof ownerWindow.getComputedStyle === "function") {
      return ownerWindow.getComputedStyle(element).cursor === "pointer";
    }

    return false;
  }

  function nearestClickTarget(durationElement) {
    for (const ancestor of ancestorChain(durationElement, 10)) {
      if (isClickableElement(ancestor)) {
        return ancestor;
      }
    }

    // React 等の委譲イベントは子要素から発火しても親のクリック処理へ伝播する。
    return durationElement;
  }

  function playlistItemLabel(durationElement) {
    let best = elementLabel(durationElement);

    for (const ancestor of ancestorChain(durationElement, 10)) {
      const label = elementLabel(ancestor);
      if (durationCount(ancestor) !== 1 || label.length > 240) {
        continue;
      }
      if (label.length >= best.length) {
        best = label;
      }
    }

    return best;
  }

  function elementRect(element) {
    if (!element || typeof element.getBoundingClientRect !== "function") {
      return null;
    }

    const rect = element.getBoundingClientRect();
    if (!rect || !Number.isFinite(rect.top) || !Number.isFinite(rect.left)) {
      return null;
    }

    return {
      top: rect.top,
      left: rect.left,
      width: rect.width || 0,
      height: rect.height || 0
    };
  }

  function durationLeaves(documentObject) {
    const result = [];
    const allElements = documentObject.querySelectorAll("body *");

    for (const element of allElements) {
      if (!hasVideoDuration(element) || !isVisibleElement(element)) {
        continue;
      }

      const children = Array.from(element.children || []);
      if (children.some((child) => hasVideoDuration(child))) {
        continue;
      }

      result.push(element);
      if (result.length >= 200) {
        break;
      }
    }

    return result;
  }

  function playlistItems(documentObject) {
    const items = [];
    const seenTargets = new Set();

    for (const durationElement of durationLeaves(documentObject)) {
      const element = nearestClickTarget(durationElement);
      if (seenTargets.has(element) || isDisabledElement(element)) {
        continue;
      }

      seenTargets.add(element);
      items.push({
        element,
        signalElement: durationElement,
        label: playlistItemLabel(durationElement),
        rect: elementRect(durationElement)
      });
    }

    return items;
  }

  function nextVisualItem(items, currentIndex) {
    const current = items[currentIndex];
    if (!current || !current.rect) {
      return items[currentIndex + 1] || null;
    }

    const candidates = items.filter((item, index) => {
      if (index === currentIndex || !item.rect) {
        return false;
      }

      const isBelow = item.rect.top > current.rect.top + 2;
      const sameColumn = Math.abs(item.rect.left - current.rect.left) <= 140;
      return isBelow && sameColumn;
    });

    candidates.sort((left, right) => left.rect.top - right.rect.top);
    return candidates[0] || items[currentIndex + 1] || null;
  }

  function analyzePlaylist(documentObject) {
    const items = playlistItems(documentObject);
    const headings = headingLabels(documentObject);
    let currentIndex = -1;
    let strongestScore = 0;

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const score = currentItemScore(item.signalElement, documentObject, headings, item.label);
      item.currentScore = score;
      if (score > strongestScore) {
        strongestScore = score;
        currentIndex = index;
      }
    }

    return { items, currentIndex, strongestScore };
  }

  function findNextPlaylistCandidate(documentObject) {
    if (!documentObject || typeof documentObject.querySelectorAll !== "function") {
      return null;
    }

    const analysis = analyzePlaylist(documentObject);
    const { items, currentIndex, strongestScore } = analysis;

    if (items.length < 2) {
      return null;
    }

    if (currentIndex < 0 || strongestScore < 120) {
      return null;
    }

    const current = items[currentIndex];
    const next = nextVisualItem(items, currentIndex);
    if (!next) {
      return null;
    }

    return {
      element: next.element,
      score: strongestScore,
      label: next.label,
      currentLabel: current.label,
      strategy: "playlist"
    };
  }

  function diagnosePlaylist(documentObject) {
    if (!documentObject || typeof documentObject.querySelectorAll !== "function") {
      return { itemCount: 0, strongestScore: 0, items: [] };
    }

    const analysis = analyzePlaylist(documentObject);
    return {
      itemCount: analysis.items.length,
      strongestScore: analysis.strongestScore,
      currentIndex: analysis.currentIndex,
      items: analysis.items.slice(0, 30).map((item) => ({
        label: item.label,
        score: item.currentScore,
        tag: normalizeLabel(item.element && item.element.tagName),
        href: resolvedHref(item.signalElement, documentObject),
        top: item.rect && Math.round(item.rect.top),
        left: item.rect && Math.round(item.rect.left)
      }))
    };
  }

  return {
    MINIMUM_SCORE,
    normalizeLabel,
    elementLabel,
    isDisabledElement,
    isVisibleElement,
    scoreElement,
    findBestCandidate,
    hasVideoDuration,
    findNextPlaylistCandidate,
    diagnosePlaylist
  };
});
