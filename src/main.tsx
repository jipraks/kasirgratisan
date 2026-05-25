import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Global handlers for errors that React's ErrorBoundary cannot catch:
//  - unhandled promise rejections (async code)
//  - uncaught runtime errors (event handlers, setTimeout, etc.)
// For now we log to the console; this is also where a remote logger would hook in.
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    console.error("[UnhandledRejection]", event.reason);
  });

  window.addEventListener("error", (event) => {
    console.error("[WindowError]", event.message, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error,
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
