import { Metadata } from "next";
import type React from "react";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: {
      template: "Community Guidelines",
      default: "Community Guidelines",
    },
    description: "How to be a good citizen of TripOtter, and what happens if you&apos;re not.",
  };
}

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section className="mb-8">
    <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
      {title}
    </h2>
    <div className="text-gray-700 dark:text-gray-300 space-y-2">{children}</div>
  </section>
);

export default function CommunityGuidelinesPage() {
  return (
    <main className="max-w-4xl mx-auto p-6 bg-white dark:bg-gray-950 text-gray-800 dark:text-gray-200">
      <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-gray-100">
        Community Guidelines
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
        Last updated: August 30, 2026
      </p>

      <Section title="Why these exist">
        <p>
          TripOtter works because real travelers share real experiences —
          moments, journals, posts, stories, and the businesses they actually
          visited. These guidelines describe the behavior that keeps that true.
          They sit alongside, not instead of, our{" "}
          <a href="/misc/terms-and-condition" className="text-blue-600 underline dark:text-blue-400">
            Terms and Conditions
          </a>
          , which govern your use of TripOtter as a legal matter. This page is
          about day-to-day conduct: what&apos;s welcome here, what isn&apos;t, and what
          happens when it isn&apos;t.
        </p>
      </Section>

      <Section title="What belongs here">
        <ul className="list-disc list-inside space-y-1">
          <li>Your own travel moments, journals, and posts — real trips, real places.</li>
          <li>Honest reviews of businesses and offerings, based on an actual visit.</li>
          <li>Questions, tips, and companion requests inside tribes and communities.</li>
          <li>Photos and stories you have the right to share.</li>
        </ul>
      </Section>

      <Section title="What doesn&apos;t">
        <ul className="list-disc list-inside space-y-1">
          <li>Harassment, threats, hate speech, or targeted abuse of another person.</li>
          <li>Impersonating another person, business, or TripOtter itself.</li>
          <li>Fake reviews — for a business you haven&apos;t visited, or written in exchange for payment or favors.</li>
          <li>Spam: repeated unsolicited messages, mass-following, or coordinated inauthentic activity.</li>
          <li>Sharing someone else&apos;s exact live location without their consent.</li>
          <li>Content that&apos;s illegal where you or the person you&apos;re targeting lives — this includes exploitation of minors, non-consensual imagery, and content promoting violence.</li>
          <li>Scraping, reverse-engineering, or automating access to other people&apos;s data.</li>
        </ul>
      </Section>

      <Section title="Privacy and location, specifically">
        <p>
          TripOtter has two distinct ways location touches the app, and the
          guideline is different for each. <strong>Radar</strong> shows roughly
          where people are gathered — it deliberately shares a fuzzed area, not
          your exact position, and it&apos;s never acceptable to try to work around
          that fuzzing to pin down someone&apos;s precise location. <strong>Trails</strong>{" "}
          records a precise route only for an activity you chose to record, and
          only you control who that route is visible to. Respect the same
          boundary for other people that the app enforces for you: don&apos;t ask
          someone to disable their privacy settings, and don&apos;t share a screenshot
          of someone else&apos;s precise location without asking first.
        </p>
      </Section>

      <Section title="Reporting and blocking">
        <p>
          Every post, comment, profile, and business listing has a Report
          option. Use it — reports go to real moderators, not a black hole. If
          you&apos;d rather not see someone at all, Block stops them from reaching
          you entirely; Mute quiets a conversation without them knowing. None
          of these require a reason you have to justify to anyone but yourself.
        </p>
      </Section>

      <Section title="What happens when this is violated">
        <ul className="list-disc list-inside space-y-1">
          <li>First violations of lower-severity rules (spam, low-effort content) usually get a content removal and a warning.</li>
          <li>Repeated or more serious violations (harassment, fake reviews, impersonation) can lead to a temporary suspension.</li>
          <li>Severe violations — illegal content, credible threats, targeted harassment campaigns — result in immediate, permanent removal, and where required by law, a report to the relevant authorities.</li>
          <li>Business accounts that manipulate reviews or misrepresent a listing can lose their verification or the listing itself.</li>
        </ul>
        <p>
          Moderation decisions are made by a real team using TripOtter&apos;s admin
          tools, not by an unmonitored automated filter alone.
        </p>
      </Section>

      <Section title="Appeals">
        <p>
          If your content was removed or your account was actioned and you
          think it was a mistake, contact{" "}
          <a href="mailto:support@tripotter.app" className="text-blue-600 underline dark:text-blue-400">
            support@tripotter.app
          </a>{" "}
          with your username and what happened. We review appeals by hand.
        </p>
      </Section>

      <Section title="Questions">
        <p>
          These guidelines will evolve as TripOtter does. If something here is
          unclear, or a situation you&apos;re in isn&apos;t covered, reach out rather than
          guessing — we&apos;d rather answer the question than have you find out the
          hard way.
        </p>
      </Section>
    </main>
  );
}
