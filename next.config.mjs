/** @type {import('next').NextConfig} */

const securityHeaders = [
  // {
  //   key: "Content-Security-Policy",
  //   value: `
  //     default-src 'self';
  //     script-src 'self' https://apis.google.com;
  //     style-src 'self' 'unsafe-inline';
  //     img-src * blob: data:;
  //     connect-src *;
  //     font-src 'self';
  //     object-src 'none';
  //     frame-ancestors 'none';
  //   `.replace(/\n/g, ""),
  // },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig = {
  devIndicators: false,
  // TypeScript errors now BLOCK the build (tsc --noEmit is clean as of W0).
  // ESLint is still not enforced on build (legacy style/lint debt; tracked separately).
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "oveptqgoyhpgvbdfqenf.supabase.co" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "i.pravatar.cc" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig
