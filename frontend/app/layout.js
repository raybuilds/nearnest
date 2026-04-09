import { Lora, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import DawnLauncher from "@/components/dawn/DawnLauncher";

const displayFont = Lora({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const bodyFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata = {
  title: "NearNest",
  description: "Behavioral student housing governance platform centered on trust, transparency, and visibility.",
};

export default function RootLayout({ children }) {
  const themeScript = `
    (() => {
      try {
        const stored = window.localStorage.getItem("nearnest-theme");
        const system = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
        const theme = stored === "light" || stored === "dark" ? stored : system;
        document.documentElement.dataset.theme = theme;
      } catch {
        document.documentElement.dataset.theme = "dark";
      }
    })();
  `;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      style={{
        "--font-display": displayFont.style.fontFamily,
        "--font-body": bodyFont.style.fontFamily,
      }}
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <div className="app-frame relative min-h-screen pb-24">
          <Navbar />
          <main className="page-shell pt-8 pb-8 sm:pt-10">{children}</main>
          <DawnLauncher />
        </div>
      </body>
    </html>
  );
}
