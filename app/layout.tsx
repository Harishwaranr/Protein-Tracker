import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "PROTRACK — Gym Nutrition",
  description: "Track your nutrition, protein and hydration goals."
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}