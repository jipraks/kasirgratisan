import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Copy, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional custom fallback. If not provided, the default UI is rendered. */
  fallback?: (args: { error: Error; reset: () => void }) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * React Error Boundary that catches render-time errors and shows a
 * user-friendly fallback UI instead of a blank screen.
 *
 * Note: Error Boundaries do NOT catch errors in:
 *  - event handlers (use try/catch in the handler)
 *  - asynchronous code (handle promise rejections explicitly)
 *  - the boundary itself
 * For those, see the global handlers wired up in `main.tsx`.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log to console so it shows up in remote debugging (chrome://inspect, etc.)
    // and is captured by any future remote logger.
    console.error("[ErrorBoundary] Captured error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  reset = (): void => {
    this.setState({ error: null, errorInfo: null });
  };

  reload = (): void => {
    window.location.reload();
  };

  goHome = (): void => {
    window.location.href = "/";
  };

  copyDetails = async (): Promise<void> => {
    const { error, errorInfo } = this.state;
    if (!error) return;

    const details = [
      `Message: ${error.message}`,
      `Name: ${error.name}`,
      `URL: ${window.location.href}`,
      `User Agent: ${navigator.userAgent}`,
      `Time: ${new Date().toISOString()}`,
      "",
      "Stack:",
      error.stack ?? "(no stack)",
      "",
      "Component Stack:",
      errorInfo?.componentStack ?? "(no component stack)",
    ].join("\n");

    try {
      await navigator.clipboard.writeText(details);
    } catch {
      // Clipboard API may be blocked (insecure context, permissions). Fallback:
      // best-effort prompt so user can copy manually.
      window.prompt("Salin detail error berikut:", details);
    }
  };

  render(): ReactNode {
    const { error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    if (!error) {
      return children;
    }

    if (fallback) {
      return fallback({ error, reset: this.reset });
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-muted px-4 py-8">
        <div className="w-full max-w-lg space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Terjadi kesalahan</AlertTitle>
            <AlertDescription>
              Aplikasi mengalami error yang tidak terduga. Coba muat ulang halaman. Jika masih
              terjadi, salin detail error di bawah dan laporkan ke developer.
            </AlertDescription>
          </Alert>

          <div className="rounded-lg border bg-background p-4">
            <div className="mb-2 text-sm font-medium">Detail error</div>
            <pre className="max-h-48 overflow-auto rounded bg-muted p-3 text-xs leading-relaxed">
              {error.name}: {error.message}
              {error.stack ? `\n\n${error.stack}` : ""}
              {errorInfo?.componentStack ? `\n\nComponent stack:${errorInfo.componentStack}` : ""}
            </pre>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={this.reload} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Muat ulang
            </Button>
            <Button variant="outline" onClick={this.goHome} className="gap-2">
              <Home className="h-4 w-4" />
              Ke beranda
            </Button>
            <Button variant="secondary" onClick={this.copyDetails} className="gap-2">
              <Copy className="h-4 w-4" />
              Salin detail
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
