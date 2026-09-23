import "./globals.css";

export const metadata = {
  title: "EKMS triage",
  description:
    "AI-assisted urgency triage and nearest ESIC / ESIS facility routing for call-centre operators.",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "EKMS triage",
    description:
      "AI-assisted urgency triage and nearest ESIC / ESIS facility routing for call-centre operators.",
    type: "website",
  },
};

export const viewport = {
  themeColor: "#1D4ED8",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
