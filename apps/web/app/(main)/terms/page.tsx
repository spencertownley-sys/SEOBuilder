import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, List, Placeholder, POLICY_UPDATED, Section } from "@/components/legal";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms for using Mentionful and Better SEO Builder.",
  alternates: { canonical: "/terms" },
};

const contact = <Placeholder>contact email, for example support@mentionful.com</Placeholder>;

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service for Mentionful and Better SEO Builder" updated={POLICY_UPDATED}>
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Draft for the owner to review. This text is not legal advice.
      </p>

      <Section title="1. Who provides the service">
        <p>
          Mentionful (https://mentionful.com) and its landing page Better SEO Builder (https://betterseobuilder.com) are provided by{" "}
          <Placeholder>owner legal name</Placeholder>. Contact: {contact}.
        </p>
      </Section>

      <Section title="2. What the service is">
        <p>
          Mentionful audits websites for search engines and AI assistants, turns what it finds into a list of suggested fixes, and can track how
          AI assistants such as ChatGPT, Claude, Gemini and Perplexity mention a business. Scores and impact are estimates, not guarantees of
          rankings or AI citations. The service is provided as is and as available, without warranties of any kind, to the extent the law
          allows.
        </p>
      </Section>

      <Section title="3. Accounts">
        <List
          items={[
            "One person per account. Use an email address you control and keep it accurate.",
            "Keep your password safe. You are responsible for what happens under your account.",
            "You must be at least 13 years old (16 in the EU and UK) to create an account.",
          ]}
        />
      </Section>

      <Section title="4. Acceptable use">
        <List
          items={[
            "Only add sites you own or are authorised to audit and track. Weekly tracking needs verified ownership.",
            "No automated or bulk signups, and no attempts to get around the limits below.",
            "No attempts to overload, scrape, reverse engineer or break the crawler, the AI features or the site.",
            "Nothing unlawful, abusive or infringing.",
          ]}
        />
        <p>
          Fair-use limits apply so the service stays available to everyone. Today they are: free audits are rate limited per visitor, each
          workspace can track up to 3 sites, and AI tracking runs at most once a day per site and 3 times a day per workspace. Limits can change.
        </p>
      </Section>

      <Section title="5. Your content">
        <p>
          You keep ownership of everything you enter, such as site details, business profiles, competitors and tracked questions. You give the
          operator only the licence needed to run the service for you, which includes sending tracked questions to the AI providers listed in
          the{" "}
          <Link href="/privacy" className="font-medium text-accent underline">
            privacy policy
          </Link>
          . You confirm you have the right to submit it.
        </p>
      </Section>

      <Section title="6. Price">
        <p>
          The free audit and a Mentionful account are free today. There are no paid plans and no card is taken. If paid plans are introduced
          they will be announced in advance, and nothing will be charged without your clear agreement.
        </p>
      </Section>

      <Section title="7. Ending your account">
        <p>
          You can stop using the service at any time and delete your account yourself on the Account page, or by emailing {contact}. The operator may suspend or
          close an account that breaks these terms or puts the service or other people at risk, and will say why where it is safe to do so.
        </p>
      </Section>

      <Section title="8. Liability and governing law">
        <p>
          To the extent the law allows, the operator is not liable for indirect or consequential losses, lost profits or lost rankings, and total
          liability is limited to the amount you paid for the service in the 12 months before the claim (currently nothing). Nothing in these
          terms limits rights you have under consumer law that cannot be limited. These terms are governed by the laws of{" "}
          <Placeholder>governing law: state and country</Placeholder>.
        </p>
      </Section>

      <Section title="9. Changes to these terms">
        <p>
          If these terms change in a way that matters, the date above changes and a notice is shown on the site before the change takes effect.
          Continuing to use the service after that means you accept the new terms.
        </p>
      </Section>
    </LegalPage>
  );
}
