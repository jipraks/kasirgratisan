import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { StatusBar } from "@capacitor/status-bar";
import { AuthProvider } from "@/hooks/use-auth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";
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
import DebtsPage from "./pages/Debts";
import PaymentMethodsSettings from "./pages/settings/PaymentMethodsSettings";
import ProductCategoriesSettings from "./pages/settings/ProductCategoriesSettings";
import ExpenseCategoriesSettings from "./pages/settings/ExpenseCategoriesSettings";
import UnitsSettings from "./pages/settings/UnitsSettings";
import ThemeSettings from "./pages/settings/ThemeSettings";
import ReceiptSettings from "./pages/settings/ReceiptSettings";
import StockOpname from "./pages/settings/StockOpname";
import BackupRestoreSettings from "./pages/settings/BackupRestoreSettings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      StatusBar.setOverlaysWebView({ overlay: false }).catch(err => {
        console.warn("Gagal mengatur StatusBar overlay:", err);
      });
      document.documentElement.classList.add('is-native');
    }
  }, []);

  return (
    <I18nextProvider i18n={i18n}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AuthProvider>
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
                    path="/debts"
                    element={
                      <ErrorBoundary>
                        <DebtsPage />
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
                    path="/settings/receipt"
                    element={
                      <ErrorBoundary>
                        <ReceiptSettings />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/settings/stock-opname"
                    element={
                      <ErrorBoundary>
                        <StockOpname />
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
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
    </I18nextProvider>
  );
};

export default App;
