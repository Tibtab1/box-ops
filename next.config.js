/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [],
  },
  // Give API routes enough body budget for base64 photos (client compresses
  // them below 3 MB, but the encoded payload inflates slightly).
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  // Emit standalone output — Vercel detects this and serves it directly.
  // Optional but recommended for faster cold starts.
  output: "standalone",
};

module.exports = nextConfig;
