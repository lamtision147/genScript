/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: false,
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next"
};

export default nextConfig;
