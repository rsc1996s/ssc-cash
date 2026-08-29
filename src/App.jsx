import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import PendingApproval from "./pages/PendingApproval";
import Home from "./pages/Home";
import NewTransaction from "./pages/NewTransaction";
import TransactionDetail from "./pages/TransactionDetail";
import OwnerDashboard from "./pages/OwnerDashboard";
import AdminUsers from "./pages/AdminUsers";
import AdminFunds from "./pages/AdminFunds";
import Reports from "./pages/Reports";
import PrintVoucher from "./pages/PrintVoucher";
import TransfersHub from "./pages/TransfersHub";
import BankAccounts from "./pages/BankAccounts";
import WithdrawalRequestForm from "./pages/WithdrawalRequestForm";
import WithdrawalRequestPrint from "./pages/WithdrawalRequestPrint";
import TransferPaymentForm from "./pages/TransferPaymentForm";
import TransferPaymentPrint from "./pages/TransferPaymentPrint";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/pending" element={<PendingApproval />} />
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
            path="/admin/users"
            element={
              <ProtectedRoute requireRole="owner">
                <AdminUsers />
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
              <ProtectedRoute requireRole="owner">
                <TransfersHub />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transfers/accounts"
            element={
              <ProtectedRoute requireRole="owner">
                <BankAccounts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transfers/withdrawals/new"
            element={
              <ProtectedRoute requireRole="owner">
                <WithdrawalRequestForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transfers/withdrawals/:id"
            element={
              <ProtectedRoute requireRole="owner">
                <WithdrawalRequestForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transfers/withdrawals/:id/print"
            element={
              <ProtectedRoute requireRole="owner">
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
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
