import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/components/"))
      return {
        url: pathToFileURL(
          resolve(specifier.replace("@/components/", "registry/components/") + ".ts"),
        ).href,
        shortCircuit: true,
      };
    return nextResolve(specifier, context);
  },
});
