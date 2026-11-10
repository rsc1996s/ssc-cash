import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

export default function Layout({ children }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-paper">
      <Sidebar />
      <Navbar />
      <main className="min-w-0 lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:py-6 lg:pb-10">
          {children}
        </div>
      </main>
    </div>
  );
}
