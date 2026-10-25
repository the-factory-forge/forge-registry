import { chromium as playwrightChromium } from "playwright";

// Demo tests operate in the persistent preview; browser navigation stays in the shell.
// Use page.shell explicitly when asserting the outer document or navbar focus.
function showroomPage(page, javaScriptEnabled = true) {
  let embedded = javaScriptEnabled;
  const preview = () => page.frame({ name: "factory-device-preview" }) ?? page.mainFrame();
  const domMethods = new Set([
    "locator",
    "getByRole",
    "getByText",
    "getByLabel",
    "getByPlaceholder",
    "getByAltText",
    "getByTestId",
    "getByTitle",
    "frameLocator",
    "evaluate",
    "evaluateHandle",
    "waitForFunction",
    "waitForSelector",
    "$",
    "$$",
    "$eval",
    "$$eval",
    "click",
    "fill",
    "check",
    "uncheck",
    "selectOption",
    "press",
    "textContent",
    "inputValue",
    "isVisible",
    "isHidden",
  ]);
  return new Proxy(page, {
    get(target, key) {
      if (key === "shell") return target;
      if (key === "goto" || key === "reload") {
        return async (...args) => {
          const response = await target[key](...args);
          // Static fixtures and JavaScript-disabled sessions have no embedded preview.
          embedded =
            javaScriptEnabled && Boolean(await target.locator(".showroom-content").count());
          if (embedded) {
            await target.locator("#factory-device-preview").waitFor();
            await target
              .frameLocator("#factory-device-preview")
              .locator('[data-preview-ready="true"]')
              .waitFor();
          }
          return response;
        };
      }
      if (domMethods.has(key)) {
        return (...args) => {
          const locates = key === "locator" || key.startsWith("getBy") || key === "frameLocator";
          const scope =
            embedded && locates ? target.frameLocator("#factory-device-preview") : preview();
          return scope[key](...args);
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
