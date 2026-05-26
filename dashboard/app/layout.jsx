import "./globals.css";
import PolicyEngineHeader from "../src/components/PolicyEngineHeader";

export const metadata = {
  title: "UC rebalancing analysis | PolicyEngine",
  description:
    "Interactive analysis of the Universal Credit rebalancing package on PolicyEngine UK: above-inflation standard allowance uplift and the new-claimant health element change.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <PolicyEngineHeader />
        {children}
      </body>
    </html>
  );
}
