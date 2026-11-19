(function initializePopup() {
  "use strict";

  const extensionApi = globalThis.browser || globalThis.chrome;
  const defaults = {
    enabled: true,
    delayMs: 1200,
    customSelector: ""
  };
  const form = document.querySelector("#settings-form");
  const enabledInput = document.querySelector("#enabled");
  const delayInput = document.querySelector("#delay-seconds");
  const selectorInput = document.querySelector("#custom-selector");
  const status = document.querySelector("#status");

  function callStorage(method, value) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (result) => {
        if (!settled) {
          settled = true;
          resolve(result);
        }
      };

      try {
        const result = extensionApi.storage.local[method](value, finish);
        if (result && typeof result.then === "function") {
          result.then(finish, reject);
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  async function load() {
    const saved = await callStorage("get", defaults);
    const savedDelay = Number(saved.delayMs);
    enabledInput.checked = saved.enabled !== false;
    delayInput.value = String((Number.isFinite(savedDelay) ? savedDelay : defaults.delayMs) / 1000);
    selectorInput.value = saved.customSelector || "";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const delaySeconds = Number(delayInput.value);
    const value = {
      enabled: enabledInput.checked,
      delayMs: Math.round(Math.min(10, Math.max(0, delaySeconds || 0)) * 1000),
      customSelector: selectorInput.value.trim()
    };

    try {
      await callStorage("set", value);
      status.textContent = "保存しました";
    } catch (error) {
      status.textContent = "保存できませんでした";
    }
  });

  load().catch(() => {
    status.textContent = "設定を読み込めませんでした";
  });
})();
