import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, Copy, Home, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import i18n from "@/i18n";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (args: { error: Error; reset: () => void }) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
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
      window.prompt(i18n.t('common:error.copyPrompt'), details);
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
            <AlertTitle>{i18n.t('common:error.title')}</AlertTitle>
            <AlertDescription>
              {i18n.t('common:error.description')}
            </AlertDescription>
          </Alert>

          <div className="rounded-lg border bg-background p-4">
            <div className="mb-2 text-sm font-medium">{i18n.t('common:error.details')}</div>
            <pre className="max-h-48 overflow-auto rounded bg-muted p-3 text-xs leading-relaxed">
              {error.name}: {error.message}
              {error.stack ? `\n\n${error.stack}` : ""}
              {errorInfo?.componentStack ? `\n\nComponent stack:${errorInfo.componentStack}` : ""}
            </pre>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" onClick={this.copyDetails} className="h-11 gap-1.5 text-xs">
              <Copy className="h-4 w-4" />
              {i18n.t("common:error.copyDetails")}
            </Button>
            <Button variant="outline" onClick={this.goHome} className="h-11 gap-1.5 text-xs">
              <Home className="h-4 w-4" />
              {i18n.t("common:error.goHome")}
            </Button>
            <Button onClick={this.reload} className="h-11 gap-1.5 text-xs">
              <RotateCw className="h-4 w-4" />
              {i18n.t("common:error.reload")}
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
