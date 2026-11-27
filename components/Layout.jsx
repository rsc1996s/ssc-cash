import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

export default function Layout({ children }) {
  return (
    <div className="aurora-app min-h-screen overflow-x-hidden bg-paper">
      <div aria-hidden="true" className="aurora-background no-print" />
      <Sidebar />
      <Navbar />
      <main className="relative min-w-0 lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:py-6 lg:pb-10">
          {children}
        </div>
      </main>
    </div>
  );
}
