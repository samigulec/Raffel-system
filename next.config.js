/** @type {import('next').NextConfig} */
const isStatic = process.env.STATIC_EXPORT === "1";

const allowedOrigin = process.env.CORS_ORIGIN || "*";

const nextConfig = {
  reactStrictMode: true,
  ...(isStatic
    ? {
        output: "export",
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {
        async headers() {
          return [
            {
              source: "/api/:path*",
              headers: [
                { key: "Access-Control-Allow-Origin", value: allowedOrigin },
                { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
                { key: "Access-Control-Allow-Headers", value: "Content-Type" },
                { key: "Access-Control-Max-Age", value: "86400" },
              ],
            },
          ];
        },
      }),
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

module.exports = nextConfig;
