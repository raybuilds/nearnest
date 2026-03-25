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
  return (
    <html
      lang="en"
      style={{
        "--font-display": displayFont.style.fontFamily,
        "--font-body": bodyFont.style.fontFamily,
      }}
    >
      <body>
        <div className="relative min-h-screen pb-20">
          <Navbar />
          <main className="page-shell pt-8 pb-8 sm:pt-10">{children}</main>
          <DawnLauncher />
        </div>
      </body>
    </html>
  );
}
