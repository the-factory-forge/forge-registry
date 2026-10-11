import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";

import { transformWithOxc } from "vite";

const template = new URL(
  "../registry/components/plugins/mailing/transactional-email.tsx",
  import.meta.url,
);
const { code } = await transformWithOxc(await readFile(template, "utf8"), template.pathname, {
  jsx: { runtime: "automatic" },
});
const resolved = code.replace(/"(react|react-email|react\/jsx-runtime)"/g, (_, name) =>
  JSON.stringify(import.meta.resolve(name)),
);
const compiled = `data:text/javascript;base64,${Buffer.from(resolved).toString("base64")}`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      specifier === "./transactional-email" &&
      context.parentURL?.endsWith("/plugins/mailing/index.ts")
    )
      return { url: compiled, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
