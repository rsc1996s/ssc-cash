import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import FeedbackProvider from "./components/ui/FeedbackProvider";
import Loading from "./components/ui/Loading";
import PageTransition from "./components/PageTransition";

const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const PendingApproval = lazy(() => import("./pages/PendingApproval"));
const Home = lazy(() => import("./pages/Home"));
const NewTransaction = lazy(() => import("./pages/NewTransaction"));
const TransactionDetail = lazy(() => import("./pages/TransactionDetail"));
const OwnerDashboard = lazy(() => import("./pages/OwnerDashboard"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminFunds = lazy(() => import("./pages/AdminFunds"));
const Reports = lazy(() => import("./pages/Reports"));
const PrintVoucher = lazy(() => import("./pages/PrintVoucher"));
const TransfersHub = lazy(() => import("./pages/TransfersHub"));
const BankAccounts = lazy(() => import("./pages/BankAccounts"));
const WithdrawalRequestForm = lazy(() => import("./pages/WithdrawalRequestForm"));
const WithdrawalRequestPrint = lazy(() => import("./pages/WithdrawalRequestPrint"));
const TransferPaymentForm = lazy(() => import("./pages/TransferPaymentForm"));
const TransferPaymentPrint = lazy(() => import("./pages/TransferPaymentPrint"));
const ChangePin = lazy(() => import("./pages/ChangePin"));
const DailyClosings = lazy(() => import("./pages/DailyClosings"));
const ActivityHistory = lazy(() => import("./pages/ActivityHistory"));
const Settings = lazy(() => import("./pages/Settings"));
const SettingsCategories = lazy(() => import("./pages/SettingsCategories"));

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <FeedbackProvider>
          <PageTransition>
          <Suspense fallback={<div className="mx-auto max-w-6xl px-4"><Loading /></div>}>
          <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/pending" element={<PendingApproval />} />
          <Route
            path="/admin/users"
            element={<Navigate to="/settings/users" replace state={{ pageHeaderFallback: "/settings" }} />}
          />
          <Route
            path="/transfers/accounts"
            element={<Navigate to="/settings/bank-accounts" replace state={{ pageHeaderFallback: "/settings" }} />}
          />
          <Route
            path="/activity"
            element={<Navigate to="/settings/activity" replace state={{ pageHeaderFallback: "/settings" }} />}
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute requireRole="owner">
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/users"
            element={
              <ProtectedRoute requireRole="owner">
                <AdminUsers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/categories"
            element={
              <ProtectedRoute requireRole="owner">
                <SettingsCategories />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/bank-accounts"
            element={
              <ProtectedRoute requireRole="owner">
                <BankAccounts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/activity"
            element={
              <ProtectedRoute requireRole="owner">
                <ActivityHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/new"
            element={
              <ProtectedRoute requireRole={["owner", "staff"]}>
                <NewTransaction />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transaction/:id"
            element={
              <ProtectedRoute>
                <TransactionDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner"
            element={
              <ProtectedRoute requireRole="owner">
                <OwnerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/funds"
            element={
              <ProtectedRoute requireRole="owner">
                <AdminFunds />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute requireRole={["owner", "guest"]}>
                <Reports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/daily-closings"
            element={
              <ProtectedRoute requireRole={["owner", "staff"]}>
                <DailyClosings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transaction/:id/print"
            element={
              <ProtectedRoute>
                <PrintVoucher />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transfers"
            element={
              <ProtectedRoute requireRole={["owner", "staff"]}>
                <TransfersHub />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transfers/withdrawals/new"
            element={
              <ProtectedRoute requireRole={["owner", "staff"]}>
                <WithdrawalRequestForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transfers/withdrawals/:id"
            element={
              <ProtectedRoute requireRole={["owner", "staff"]}>
                <WithdrawalRequestForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transfers/withdrawals/:id/print"
            element={
              <ProtectedRoute requireRole={["owner", "staff"]}>
                <WithdrawalRequestPrint />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transfers/payments/new"
            element={
              <ProtectedRoute requireRole="owner">
                <TransferPaymentForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transfers/payments/:id"
            element={
              <ProtectedRoute requireRole="owner">
                <TransferPaymentForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transfers/payments/:id/print"
            element={
              <ProtectedRoute requireRole="owner">
                <TransferPaymentPrint />
              </ProtectedRoute>
            }
          />
          <Route
            path="/change-pin"
            element={
              <ProtectedRoute>
                <ChangePin />
              </ProtectedRoute>
            }
          />
          </Routes>
          </Suspense>
          </PageTransition>
        </FeedbackProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
