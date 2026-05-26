/** @type {import('next').NextConfig} */
const BASE_PATH = "/uk/uc-rebalancing";

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@policyengine/ui-kit"],
  basePath: BASE_PATH,
  assetPrefix: BASE_PATH,
  env: {
    NEXT_PUBLIC_BASE_PATH: BASE_PATH,
  },
};

module.exports = nextConfig;
