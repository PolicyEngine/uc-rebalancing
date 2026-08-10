import { PolicyEngineShell } from "@policyengine/ui-kit/layout";
import "@policyengine/ui-kit/styles.css";

import "./globals.css";

export const metadata = {
  title: "UC rebalancing analysis | PolicyEngine",
  description:
    "Interactive analysis of the Universal Credit rebalancing package on PolicyEngine UK: above-inflation standard allowance uplift and the new-claimant health element change.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <PolicyEngineShell country="uk">{children}</PolicyEngineShell>
      </body>
    </html>
  );
}
