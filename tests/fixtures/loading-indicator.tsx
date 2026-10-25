import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";

import {
  LoadingProvider,
  LoadingIndicator,
  useLoadingActivity,
  useLoadingTask,
} from "@/components/loading-indicator";

import "../../src/styles/globals.css";

const requests: { resolve: () => void; reject: () => void }[] = [];
function Source() {
  const track = useLoadingTask();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  useLoadingActivity(loading);
  return (
    <>
      <button onClick={() => setLoading(!loading)}>Toggle loading</button>
      <button
        onClick={() => void track(() => Promise.resolve()).then(() => setResult("Fast success"))}
      >
        Fast refresh
      </button>
      <button
        onClick={() =>
          void track(
            () =>
              new Promise<void>((resolve, reject) =>
                requests.push({ resolve, reject: () => reject(new Error("failure")) }),
              ),
          ).then(
            () => setResult("Success"),
            () => setResult("Failure"),
          )
        }
      >
        Refresh
      </button>
      <output className="sr-only">{result}</output>
    </>
  );
}
function App() {
  const [mounted, setMounted] = useState(true);
  return (
    <LoadingProvider>
      <header className="h-14">Navbar</header>
      <LoadingIndicator label="Chargement…" className="top-14" />
      <main className="flex gap-2">
        <LoadingProvider>{mounted && <Source />}</LoadingProvider>
        <button onClick={() => setMounted(!mounted)}>Toggle source</button>
      </main>
    </LoadingProvider>
  );
}
declare global {
  interface Window {
    loadingRequests: typeof requests;
  }
}
window.loadingRequests = requests;
createRoot(document.getElementById("factory-test-root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
