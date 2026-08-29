import { useAuth } from "../context/AuthContext";
import StaffDashboard from "./StaffDashboard";
import GuestDashboard from "./GuestDashboard";

export default function Home() {
  const { isGuest } = useAuth();
  return isGuest ? <GuestDashboard /> : <StaffDashboard />;
}
