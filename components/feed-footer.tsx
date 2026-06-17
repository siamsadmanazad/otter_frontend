import Link from "next/link";

export function FeedFooter() {
  return (
    <div className="text-xs text-gray-400 space-y-1 dark:text-gray-500">
      <div className="flex gap-2">
        <Link href="/misc/about">About •</Link>
        <Link href="/misc/faq">Help •</Link>
        <Link href="/misc/press">Press •</Link>
        <Link href="/misc/api">API •</Link>
        <Link href="/misc/jobs">Jobs •</Link>
        <Link href="/misc/privacy-policy">Privacy •</Link>
        <Link href="/misc/terms-and-condition">Terms</Link>
      </div>
      <div>Locations • Language </div>
      <div className="mt-4">© 2025 Tripotter</div>
    </div>
  );
}
