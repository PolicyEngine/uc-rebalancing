import "./globals.css";

export const metadata = {
  title: "UC standard allowance uplift | PolicyEngine",
  description:
    "Interactive dashboard validating PolicyEngine UK against the DWP and IFS estimates of the Universal Credit standard allowance uplift.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
