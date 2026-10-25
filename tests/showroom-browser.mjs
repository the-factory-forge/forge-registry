import { chromium as playwrightChromium } from "playwright";

// Keep the existing page.shell alias while all demos share the main document.
function showroomPage(page, javaScriptEnabled = true) {
  return new Proxy(page, {
    get(target, key) {
      if (key === "shell") return target;
      if (key === "goto" || key === "reload") {
        return async (...args) => {
          const response = await target[key](...args);
          if (javaScriptEnabled && (await target.locator(".showroom-frame").count())) {
            await target.locator('[data-preview-ready="true"]').waitFor();
          }
          return response;
        };
      }
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

function showroomContext(context, javaScriptEnabled) {
  return new Proxy(context, {
    get(target, key) {
      if (key === "newPage")
        return async (...args) => showroomPage(await target.newPage(...args), javaScriptEnabled);
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export const chromium = {
  async launch(options) {
    const browser = await playwrightChromium.launch(options);
    return new Proxy(browser, {
      get(target, key) {
        if (key === "newPage")
          return async (...args) =>
            showroomPage(await target.newPage(...args), args[0]?.javaScriptEnabled !== false);
        if (key === "newContext")
          return async (...args) =>
            showroomContext(await target.newContext(...args), args[0]?.javaScriptEnabled !== false);
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  },
};
