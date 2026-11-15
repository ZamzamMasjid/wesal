import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "وصال | Wesal",
};

// Placeholder root layout. Locale routing, fonts and design tokens are added
// by later project-setup items; Arabic/RTL is the default (see CLAUDE.md).
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
