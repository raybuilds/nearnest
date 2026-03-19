import { DM_Sans, Playfair_Display } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import DawnChat from "@/components/DawnChat";

const bodyFont = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
});

const headingFont = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-heading",
});

export const metadata = {
  title: "Dawn Property OS",
  description: "Intelligent property management, powered by Dawn AI",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${headingFont.variable}`}>
        <div className="siteShell">
          <Navbar />
          <main className="siteMain">{children}</main>
          <DawnChat />
        </div>
      </body>
    </html>
  );
}
