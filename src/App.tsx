import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { checkVersion } from "@/lib/version-check";
import { initAnalytics } from "@/lib/analytics";
import { Capacitor } from "@capacitor/core";
import { StatusBar } from "@capacitor/status-bar";
import { AuthProvider } from "@/hooks/use-auth";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { CloudAuthProvider } from "@/hooks/use-cloud-auth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import AnalyticsTracker from "@/components/AnalyticsTracker";
import AppLayout from "./components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import Cashier from "./pages/Cashier";
import Products from "./pages/Products";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import SupplierPage from "./pages/Supplier";
import CustomersPage from "./pages/Customers";
import StockInPage from "./pages/StockIn";
import StockOutPage from "./pages/StockOut";
import TransactionHistory from "./pages/TransactionHistory";
import StockReport from "./pages/StockReport";
import UsersPage from "./pages/Users";
import ExpensesPage from "./pages/Expenses";
import ShiftsPage from "./pages/Shifts";
import PaymentMethodsSettings from "./pages/settings/PaymentMethodsSettings";
import ProductCategoriesSettings from "./pages/settings/ProductCategoriesSettings";
import ExpenseCategoriesSettings from "./pages/settings/ExpenseCategoriesSettings";
import UnitsSettings from "./pages/settings/UnitsSettings";
import ThemeSettings from "./pages/settings/ThemeSettings";
import BackupRestoreSettings from "./pages/settings/BackupRestoreSettings";
import CloudBackupSettings from "./pages/settings/CloudBackupSettings";
import CloudAutoBackupSettings from "./pages/settings/CloudAutoBackupSettings";
import CloudBackupsSettings from "./pages/settings/CloudBackupsSettings";
import CloudHistorySettings from "./pages/settings/CloudHistorySettings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

const App = () => {
  useEffect(() => {
    checkVersion();
    initAnalytics();

    if (Capacitor.isNativePlatform()) {
      StatusBar.setOverlaysWebView({ overlay: false }).catch(err => {
        console.warn("Gagal mengatur StatusBar overlay:", err);
      });
      document.documentElement.classList.add('is-native');
    }
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
            <AuthProvider>
             <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
              <CloudAuthProvider>
              <AnalyticsTracker />
              <Routes>
                <Route element={<AppLayout />}>
                  <Route
                    path="/"
                    element={
                      <ErrorBoundary>
                        <Dashboard />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/cashier"
                    element={
                      <ErrorBoundary>
                        <Cashier />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/products"
                    element={
                      <ErrorBoundary>
                        <Products />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/reports"
                    element={
                      <ErrorBoundary>
                        <Reports />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <ErrorBoundary>
                        <Settings />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/supplier"
                    element={
                      <ErrorBoundary>
                        <SupplierPage />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/customers"
                    element={
                      <ErrorBoundary>
                        <CustomersPage />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/stock-in"
                    element={
                      <ErrorBoundary>
                        <StockInPage />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/stock-out"
                    element={
                      <ErrorBoundary>
                        <StockOutPage />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/history"
                    element={
                      <ErrorBoundary>
                        <TransactionHistory />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/stock-report"
                    element={
                      <ErrorBoundary>
                        <StockReport />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/users"
                    element={
                      <ErrorBoundary>
                        <UsersPage />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/expenses"
                    element={
                      <ErrorBoundary>
                        <ExpensesPage />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/shifts"
                    element={
                      <ErrorBoundary>
                        <ShiftsPage />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/settings/payment-methods"
                    element={
                      <ErrorBoundary>
                        <PaymentMethodsSettings />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/settings/product-category"
                    element={
                      <ErrorBoundary>
                        <ProductCategoriesSettings />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/settings/expense-category"
                    element={
                      <ErrorBoundary>
                        <ExpenseCategoriesSettings />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/settings/units"
                    element={
                      <ErrorBoundary>
                        <UnitsSettings />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/settings/theme"
                    element={
                      <ErrorBoundary>
                        <ThemeSettings />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/settings/backup"
                    element={
                      <ErrorBoundary>
                        <BackupRestoreSettings />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/settings/cloud-backup"
                    element={
                      <ErrorBoundary>
                        <CloudBackupSettings />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/settings/cloud-backup/auto"
                    element={
                      <ErrorBoundary>
                        <CloudAutoBackupSettings />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/settings/cloud-backup/backups"
                    element={
                      <ErrorBoundary>
                        <CloudBackupsSettings />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/settings/cloud-backup/history"
                    element={
                      <ErrorBoundary>
                        <CloudHistorySettings />
                      </ErrorBoundary>
                    }
                  />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
              </CloudAuthProvider>
             </GoogleOAuthProvider>
            </AuthProvider>
            </BrowserRouter>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
