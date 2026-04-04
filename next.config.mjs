/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: false,
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  allowedDevOrigins: ["127.0.0.1"],
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "www.sellerstudio.site"
          }
        ],
        destination: "https://sellerstudio.site/:path*",
        permanent: true
      }
    ];
  }
};

export default nextConfig;
