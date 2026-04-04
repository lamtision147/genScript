/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: false,
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  allowedDevOrigins: ["127.0.0.1"]
};

export default nextConfig;
