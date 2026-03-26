import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/freelancer',
        destination: '/my',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
