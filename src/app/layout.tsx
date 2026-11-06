import type { Metadata, Viewport } from "next";
import { Anuphan, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Latin + digits from Plus Jakarta Sans; Thai glyphs fall through to Anuphan (modern loopless Thai). See globals.css --font-sans.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});
const anuphan = Anuphan({
  variable: "--font-anuphan",
  subsets: ["thai", "latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "COM7 Knowledge Hub", template: "%s | COM7 Knowledge Hub" },
  description: "COM7 Employee Knowledge Hub",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b2410",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${jakarta.variable} ${anuphan.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
