import { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: {
      template: "Terms and Conditions",
      default: "Terms and Conditions",
    },
    description: "Tripotter terms and conditions",
  };
}
import type React from "react";

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

export default function TermsPage() {
  return (
    <main className="max-w-4xl mx-auto p-6 bg-white dark:bg-gray-950 text-gray-800 dark:text-gray-200">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100">
        Terms and Conditions
      </h1>

      <Section title="1. Introduction">
        <p>
          Welcome to Tripotter, a social media-driven travel network that
          connects adventurers worldwide to plan, share, and explore
          unforgettable travel experiences. These Terms and Conditions ("Terms")
          govern your use of the Tripotter platform, including our website,
          mobile application, and related services (collectively, the
          "Service"). By accessing or using the Service, you agree to these
          Terms, forming a legally binding agreement between you ("User" or
          "you") and Tripotter ("we," "us," or "our"). If you do not agree, you
          must not use the Service.
        </p>
      </Section>

      <Section title="1.1 Scope of Services">
        <p>
          Tripotter is a social media platform for travel, offering features
          such as travel planning, community-driven insights, business listings,
          user and third-party reviews, interactive maps, advanced analytics,
          content review tools, and e-commerce. Future features may include
          itinerary planning, group travel coordination, virtual tours, and
          AI-driven personalization.
        </p>
      </Section>

      <Section title="2. User Eligibility and Accounts">
        <p>
          To use the Service, you must be at least 18 years old or the legal age
          of majority in your jurisdiction. Creating an account is required for
          features like posting content, reviewing businesses, or making
          bookings. You are responsible for maintaining the confidentiality of
          your account credentials and all activities under your account.
        </p>
      </Section>

      <Section title="2.1 Account Responsibilities">
        <ul className="list-disc list-inside">
          <li>
            Provide accurate and complete information during registration.
          </li>
          <li>
            Notify us immediately of unauthorized account use at
            tmuhebbullah@gmail.com.
          </li>
          <li>Do not share your account credentials with others.</li>
        </ul>
      </Section>

      <Section title="3. User Conduct and Community Standards">
        <p>
          You agree to use the Service responsibly, respecting other users and
          complying with applicable laws.
        </p>
      </Section>

      <Section title="3.1 Prohibited Activities">
        <ul className="list-disc list-inside">
          <li>
            Post or share unlawful, defamatory, harassing, or infringing
            content.
          </li>
          <li>Scrape data using bots or external tools.</li>
          <li>Spam, troll, or disrupt the platform.</li>
          <li>Misrepresent identity or impersonate others.</li>
        </ul>
      </Section>

      <Section title="3.2 User-Generated Content">
        <p>
          By posting content, you grant Tripotter a non-exclusive, worldwide,
          royalty-free license to use, reproduce, and modify your content.
          Content must comply with our standards and not infringe on third-party
          rights.
        </p>
      </Section>

      <Section title="4. Business Listings and Reviews">
        <p>
          Businesses can create listings and users can post reviews. Listings
          must be accurate and verified. Reviews must be truthful and follow
          community standards.
        </p>
      </Section>

      <Section title="4.1 Business Responsibilities">
        <ul className="list-disc list-inside">
          <li>Ensure listing accuracy.</li>
          <li>Do not manipulate or incentivize reviews.</li>
          <li>Tripotter may remove violating listings or reviews.</li>
        </ul>
      </Section>

      <Section title="4.2 Review Guidelines">
        <ul className="list-disc list-inside">
          <li>Reviews must be honest and not defamatory.</li>
          <li>Third-party reviews must follow the same standards.</li>
          <li>Tripotter isn’t liable for user or third-party reviews.</li>
        </ul>
      </Section>

      <Section title="5. Intellectual Property">
        <p>
          All content (e.g., logos, software, maps) belongs to Tripotter or its
          licensors. Do not reproduce, modify, or distribute without permission.
        </p>
      </Section>

      <Section title="6. E-commerce and Transactions">
        <p>
          Tripotter may allow purchases and bookings. All transactions are
          governed by our policies and third-party providers.
        </p>
      </Section>

      <Section title="6.1 Payment Terms">
        <ul className="list-disc list-inside">
          <li>Payments are processed via PayPal, Stripe, etc.</li>
          <li>You authorize charges and agree to provide accurate details.</li>
          <li>Prices are in USD unless noted, with applicable taxes.</li>
        </ul>
      </Section>

      <Section title="6.2 Returns and Refunds">
        <p>
          Refunds follow our Refund Policy. Bookings are subject to the
          provider’s terms.
        </p>
      </Section>

      <Section title="7. Privacy and Data Usage">
        <p>
          We collect and use data under our Privacy Policy, including
          geolocation and analytics, in line with GDPR, CCPA, and PDPA.
        </p>
      </Section>

      <Section title="7.1 Advanced Analytics">
        <p>
          We use analytics for personalized insights. You can opt out via
          settings.
        </p>
      </Section>

      <Section title="7.2 Geolocation and Interactive Maps">
        <p>
          Map features use real-time geolocation. By using them, you agree to
          data collection. Third-party map tools may apply.
        </p>
      </Section>

      <Section title="8. AI Integration and Content Review">
        <p>
          We use AI for personalization, moderation, and content editing.
          Content is reviewed for compliance.
        </p>
      </Section>

      <Section title="8.1 AI Usage">
        <ul className="list-disc list-inside">
          <li>AI outputs are “as is” and may not be fully accurate.</li>
          <li>Do not use platform data to train external AIs.</li>
        </ul>
      </Section>

      <Section title="8.2 Content Review">
        <ul className="list-disc list-inside">
          <li>AI or human moderators may review your content.</li>
          <li>We may edit or remove content that violates our standards.</li>
        </ul>
      </Section>

      <Section title="9. Limitation of Liability">
        <p>
          Tripotter is not liable for indirect damages or inaccuracies. The
          Service is provided “as is.”
        </p>
      </Section>

      <Section title="10. Termination">
        <p>
          We may terminate access for violations. You can terminate your account
          by emailing
          <br />
          <a
            href="mailto:shadmanislam27@gmail.com"
            className="text-blue-600 underline dark:text-blue-400"
          >
            shadmanislam27@gmail.com
          </a>
        </p>
      </Section>

      <Section title="11. Dispute Resolution and Governing Law">
        <p>
          These Terms are governed by the laws of Bangladesh. Disputes will be
          resolved via arbitration in Dhaka.
        </p>
      </Section>

      <Section title="12. Changes to These Terms">
        <p>
          We may update these Terms. Changes will be shared via email or
          notifications. Continued use constitutes acceptance.
        </p>
      </Section>

      <Section title="13. Contact Us">
        <p>
          For questions, contact us at:
          <br />
          <strong>Email:</strong> tmuhebbullah@gmail.com /
          shadmanislam27@gmail.com
          <br />
          <strong>Phone:</strong> +8801722152666 / +8801627439774
        </p>
      </Section>

      <footer className="text-xs text-gray-500 dark:text-gray-400 mt-8">
        Legal Note: This Privacy Policy complies with GDPR (EU), CCPA
        (California), PDPA (Bangladesh), global privacy frameworks, and industry
        standards used by major social and travel platforms.
      </footer>
    </main>
  );
}
