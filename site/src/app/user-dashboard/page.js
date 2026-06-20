import UserDashboardMainArea from "@components/user-dashboard/user-dashboard-main-area";
import ProtectedRoute from "@components/auth/protected-route";

export const metadata = {
  title: "User Dashboard - Vendora",
};

export default function UserDashboardPage() {
  return (
    <ProtectedRoute>
      <UserDashboardMainArea/>
    </ProtectedRoute>
  );
}
