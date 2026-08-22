import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ThemeProvider } from "../context/ThemeContext";
import { AuthProvider } from "../context/AuthContext";
import { SettingsProvider } from "../context/SettingsContext";
import { AppShell } from "../components/shell";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { routeMeta, getRouteMeta } from "./routes";
import { PagePlaceholder } from "../pages/PagePlaceholder";
import { LoginPage } from "../pages/LoginPage";
import { SettingsPage } from "../pages/SettingsPage";
import { CredentialsPage } from "../pages/CredentialsPage";
import {
  ClientDetailPage,
  ClientFormPage,
  ClientsPage,
} from "../pages/ClientPages";
import {
  ProjectDetailPage,
  ProjectFormPage,
  ProjectsPage,
} from "../pages/ProjectPages";
import {
  AccountDetailPage,
  AccountFormPage,
  AccountsPage,
  IncomeFormPage,
  IncomePage,
  TransferFormPage,
} from "../pages/FinancialPages";
import {
  ExpenseDetailPage,
  ExpenseFormPage,
  ExpensesPage,
  MonthlyTrackingPage,
} from "../pages/ExpensesPages";
function ProtectedPage() {
  const meta = getRouteMeta(useLocation().pathname);
  return (
    <AppShell>
      {meta.path === "/settings" ? (
        <SettingsPage />
      ) : meta.path === "/clients" ? (
        <ClientsPage />
      ) : meta.path === "/projects" ? (
        <ProjectsPage />
      ) : meta.path === "/accounts" ? (
        <AccountsPage />
      ) : meta.path === "/income" ? (
        <IncomePage />
      ) : meta.path === "/expenses" ? (
        <ExpensesPage />
      ) : meta.path === "/credentials" ? (<CredentialsPage />) : meta.path === "/monthly-tracking" ? (
        <MonthlyTrackingPage />
      ) : (
        <PagePlaceholder meta={meta} />
      )}
    </AppShell>
  );
}
const shell = (element) => (
  <ProtectedRoute>
    <AppShell>{element}</AppShell>
  </ProtectedRoute>
);
export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SettingsProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/clients/new" element={shell(<ClientFormPage />)} />
            <Route
              path="/clients/:clientId/edit"
              element={shell(<ClientFormPage />)}
            />
            <Route
              path="/clients/:clientId"
              element={shell(<ClientDetailPage />)}
            />
            <Route path="/projects/new" element={shell(<ProjectFormPage />)} />
            <Route
              path="/projects/:projectId/edit"
              element={shell(<ProjectFormPage />)}
            />
            <Route
              path="/projects/:projectId"
              element={shell(<ProjectDetailPage />)}
            />
            <Route path="/accounts/new" element={shell(<AccountFormPage />)} />
            <Route
              path="/accounts/transfer"
              element={shell(<TransferFormPage />)}
            />
            <Route
              path="/accounts/:accountId/edit"
              element={shell(<AccountFormPage />)}
            />
            <Route
              path="/accounts/:accountId/transfer"
              element={shell(<TransferFormPage />)}
            />
            <Route
              path="/accounts/:accountId"
              element={shell(<AccountDetailPage />)}
            />
            <Route path="/income/new" element={shell(<IncomeFormPage />)} />
            <Route
              path="/income/:incomeId/edit"
              element={shell(<IncomeFormPage />)}
            />
            <Route path="/expenses/new" element={shell(<ExpenseFormPage />)} />
            <Route
              path="/expenses/:expenseId/edit"
              element={shell(<ExpenseFormPage />)}
            />
            <Route
              path="/expenses/:expenseId"
              element={shell(<ExpenseDetailPage />)}
            />
            {routeMeta.map((route) => (
              <Route
                key={route.path}
                path={route.path}
                element={
                  <ProtectedRoute>
                    <ProtectedPage />
                  </ProtectedRoute>
                }
              />
            ))}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </SettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
