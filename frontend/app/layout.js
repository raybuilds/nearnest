import "./globals.css";
import Navbar from "@/components/Navbar";
import DawnChat from "@/components/DawnChat";

export const metadata = {
  title: "NearNest",
  description: "Corridor-based student housing accountability frontend",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto min-h-screen max-w-6xl p-4 md:p-6">
          <header className="glass sticky top-4 z-10 mb-6 rounded-2xl border border-slate-200 px-4 py-3 shadow-sm">
            <Navbar />
          </header>
          <main>{children}</main>
          <DawnChat />
        </div>
      </body>
    </html>
  );
}
