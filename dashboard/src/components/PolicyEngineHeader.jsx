"use client";

import { Header } from "@policyengine/ui-kit/layout";

const NAV_ITEMS = [
  { label: "Research", href: "https://policyengine.org/uk/research" },
  { label: "Model", href: "https://policyengine.org/uk/model" },
  { label: "API", href: "https://policyengine.org/uk/api" },
  { label: "Python", href: "https://policyengine.org/uk/python" },
  { label: "Donate", href: "https://policyengine.org/uk/donate" },
];

const COUNTRIES = [
  { id: "uk", label: "United Kingdom", flagEmoji: "🇬🇧" },
  { id: "us", label: "United States", flagEmoji: "🇺🇸" },
];

export default function PolicyEngineHeader() {
  return (
    <Header
      navItems={NAV_ITEMS}
      countries={COUNTRIES}
      currentCountry="uk"
      onCountryChange={(id) => {
        window.location.href = `https://policyengine.org/${id}`;
      }}
      logoSrc="https://policyengine.org/assets/logos/policyengine/white.svg"
      logoHref="https://policyengine.org/uk"
    />
  );
}
