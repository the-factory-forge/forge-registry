// Framework-agnostic Script shim (inline script injection).
// Each site provides the implementation for its framework:
//   - Next.js  : re-export of `next/script` (supports `strategy` props)
//   - TanStack : renders the script in the route `head` (or plain <script>)
// The registry imports this shim and never imports a framework script API.

export interface ScriptProps extends React.ScriptHTMLAttributes<HTMLScriptElement> {
  id?: string;
  /** Framework hint — Next.js uses strategies; other frameworks ignore it. */
  strategy?: "afterInteractive" | "beforeInteractive" | "lazyOnload";
  /** Inline script source (JS string). */
  code?: string;
  children?: string;
}

/**
 * Minimal inline <script>. Sites that need framework script handling
 * (e.g. Next.js `beforeInteractive`) replace this file with a framework
 * component — the props above keep the component contract stable.
 */
export function Script({ id, strategy, code, children, ...props }: ScriptProps) {
  const source = code ?? children ?? "";
  return (
    <script
      id={id}
      data-strategy={strategy}
      dangerouslySetInnerHTML={{ __html: source }}
      {...props}
    />
  );
}
