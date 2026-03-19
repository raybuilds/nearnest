import { Lora, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import DawnChat from "@/components/DawnChat";

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
  description: "Verified student housing with trust, transparency, and Dawn AI",
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
        <div className="app-shell">
          <Navbar />
          <main className="app-main fade-up">{children}</main>
          <DawnChat />
        </div>
      </body>
    </html>
  );
}
