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
  // TODO(rework): remove these three escape hatches at the END of Phase 1, once the codebase is
  // lint/type clean and images come from the Supabase Storage CDN (see rework_frontend.md §5.5).
  //  - eslint.ignoreDuringBuilds  → enforce lint on build
  //  - typescript.ignoreBuildErrors → enforce type-checking on build
  //  - images.unoptimized → re-enable next/image optimization + add remotePatterns for Supabase CDN
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
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
