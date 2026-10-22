const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
    proxyClientMaxBodySize: "100mb",
    serverActions: {
      bodySizeLimit: "100mb"
    }
  },
  allowedDevOrigins: [
    "10.239.238.153",
    "192.168.31.131",
    "192.168.31.134",
    "localhost",
    "*.ngrok-free.dev",
    "*.ngrok-free.app",
    "*.ngrok.app",
    "*.ngrok.io"
  ],
  async headers() {
    return [
      {
        source: "/:path*\\.(png|jpg|jpeg|webp|svg|ico|avif|woff2)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable"
          }
        ]
      }
    ];
  }
};

module.exports = nextConfig;
