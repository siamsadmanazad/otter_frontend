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

// Derive the Supabase Storage host from the configured project URL so image
// optimization keeps working on any environment without editing this file.
const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : null;
  } catch {
    return null;
  }
})();

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
      ...(supabaseHost && supabaseHost !== "oveptqgoyhpgvbdfqenf.supabase.co"
        ? [{ protocol: "https", hostname: supabaseHost }]
        : []),
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "i.pravatar.cc" },
      { protocol: "https", hostname: "loremflickr.com" },
    ],
  },
  // Domain move: tripotter.net now points at THIS project (the app), not at
  // otter_landing. Two things have to keep resolving after the swap:
  //   1. The "Missing Otti" campaign, whose QR codes and /r/<code> referral
  //      links are already printed and shared -- forwarded to the subdomain
  //      the landing project now serves.
  //   2. The legal pages, which were at /privacy and /terms on the landing
  //      site and may already be filed in the Play Console listing.
  // Both are 307/308-safe: nothing here is a permanent redirect except the
  // legal pages, whose new home is settled.
  async redirects() {
    const campaign = "https://findotti.tripotter.net";
    return [
      { source: "/findotti", destination: `${campaign}/findotti`, permanent: false },
      { source: "/findotti/:path*", destination: `${campaign}/findotti/:path*`, permanent: false },
      { source: "/founders", destination: `${campaign}/founders`, permanent: false },
      { source: "/leaderboard", destination: `${campaign}/leaderboard`, permanent: false },
      { source: "/welcome", destination: `${campaign}/welcome`, permanent: false },
      { source: "/r/:code", destination: `${campaign}/r/:code`, permanent: false },
      { source: "/privacy", destination: "/misc/privacy-policy", permanent: true },
      { source: "/terms", destination: "/misc/terms-and-condition", permanent: true },
    ];
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
