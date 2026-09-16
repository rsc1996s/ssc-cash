import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-paper">
      <Sidebar />
      <Navbar />
      <main className="lg:pl-64">
        <div className="max-w-5xl mx-auto px-4 py-6 pb-24 lg:pb-10">{children}</div>
      </main>
    </div>
  );
}
