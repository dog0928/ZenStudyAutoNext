(function startAutoNext() {
  "use strict";

  const core = globalThis.ZenStudyAutoNextCore;
  const extensionApi = globalThis.browser || globalThis.chrome;
  const DEFAULT_SETTINGS = {
    enabled: true,
    delayMs: 1200,
    customSelector: ""
  };
  const RETRY_INTERVAL_MS = 500;
  const RETRY_WINDOW_MS = 10000;
  let settings = { ...DEFAULT_SETTINGS };
  let navigationRun = 0;

  if (!core) {
    console.warn("[ZEN Auto Next] コアスクリプトを読み込めませんでした。");
    return;
  }

  function readSettings() {
    if (!extensionApi || !extensionApi.storage || !extensionApi.storage.local) {
      return Promise.resolve({ ...DEFAULT_SETTINGS });
    }

    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve({ ...DEFAULT_SETTINGS, ...(value || {}) });
      };

      try {
        const result = extensionApi.storage.local.get(DEFAULT_SETTINGS, finish);
        if (result && typeof result.then === "function") {
          result.then(finish, () => finish(DEFAULT_SETTINGS));
        }
      } catch (error) {
        finish(DEFAULT_SETTINGS);
      }
    });
  }

  function normalizeSettings(value) {
    const delay = Number(value.delayMs);
    return {
      enabled: value.enabled !== false,
      delayMs: Number.isFinite(delay) ? Math.min(10000, Math.max(0, delay)) : DEFAULT_SETTINGS.delayMs,
      customSelector: typeof value.customSelector === "string" ? value.customSelector.trim() : ""
    };
  }

  function accessibleDocuments() {
    const documents = [document];

    try {
      if (window.top && window.top !== window && window.top.document !== document) {
        documents.push(window.top.document);
      }
    } catch (error) {
      // 別オリジンのフレームにはアクセスしない。
    }

    return documents;
  }

  function findNextControl(video) {
    let best = null;

    for (const documentObject of accessibleDocuments()) {
      const referenceElement = documentObject === video.ownerDocument ? video : null;
      const candidate = settings.customSelector
        ? core.findBestCandidate(documentObject, {
          customSelector: settings.customSelector,
          customOnly: true,
          referenceElement
        })
        : core.findNextPlaylistCandidate(documentObject);

      if (candidate && (!best || candidate.score > best.score)) {
        best = candidate;
      }
    }

    return best;
  }

  function attemptNavigation(runId, video, startedAt) {
    if (runId !== navigationRun || !settings.enabled) {
      return;
    }

    const candidate = findNextControl(video);
    if (candidate) {
      if (candidate.strategy === "playlist") {
        console.info(
          "[ZEN Auto Next] 左の動画一覧から次へ移動します:",
          candidate.currentLabel,
          "→",
          candidate.label
        );
      } else {
        console.info("[ZEN Auto Next] 指定された操作へ移動します:", candidate.label || "(カスタム要素)");
      }
      candidate.element.click();
      return;
    }

    if (Date.now() - startedAt < RETRY_WINDOW_MS) {
      window.setTimeout(() => attemptNavigation(runId, video, startedAt), RETRY_INTERVAL_MS);
    } else {
      console.warn("[ZEN Auto Next] 左の動画一覧で、現在の動画の次にある動画を見つけられませんでした。");
      for (const documentObject of accessibleDocuments()) {
        const diagnosis = core.diagnosePlaylist(documentObject);
        console.warn(
          `[ZEN Auto Next] 診断: 動画行候補=${diagnosis.itemCount}, ` +
          `現在行の最高点=${diagnosis.strongestScore}, 現在位置=${diagnosis.currentIndex}`
        );
        console.table(diagnosis.items);
      }
    }
  }

  async function onMediaEnded(event) {
    const video = event.target;
    if (!(video instanceof HTMLVideoElement)) {
      return;
    }

    settings = normalizeSettings(await readSettings());
    if (!settings.enabled) {
      return;
    }

    const runId = ++navigationRun;
    const startedAt = Date.now();
    window.setTimeout(() => attemptNavigation(runId, video, startedAt), settings.delayMs);
  }

  document.addEventListener("ended", (event) => {
    onMediaEnded(event).catch((error) => {
      console.error("[ZEN Auto Next] 自動遷移でエラーが発生しました。", error);
    });
  }, true);

  if (extensionApi && extensionApi.storage && extensionApi.storage.onChanged) {
    extensionApi.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") {
        return;
      }

      const nextSettings = { ...settings };
      for (const key of Object.keys(DEFAULT_SETTINGS)) {
        if (changes[key]) {
          nextSettings[key] = changes[key].newValue;
        }
      }
      settings = normalizeSettings(nextSettings);
      navigationRun += 1;
    });
  }

  readSettings().then((value) => {
    settings = normalizeSettings(value);
    console.info("[ZEN Auto Next] 読み込み完了");
  });
})();
