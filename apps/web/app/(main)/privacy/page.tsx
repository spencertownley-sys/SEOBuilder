import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, List, Placeholder, POLICY_UPDATED, Section, Table } from "@/components/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What Mentionful and Better SEO Builder collect, why, who receives it and how long it is kept.",
  alternates: { canonical: "/privacy" },
};

const contact = <Placeholder>contact email, for example support@mentionful.com</Placeholder>;

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy for Mentionful and Better SEO Builder" updated={POLICY_UPDATED}>
      <Section title="Who is responsible">
        <p>
          Mentionful (https://mentionful.com) and its landing page Better SEO Builder (https://betterseobuilder.com) are run by{" "}
          <Placeholder>owner legal name</Placeholder>, <Placeholder>city, state, country</Placeholder>. Contact: {contact}.
        </p>
      </Section>

      <Section title="What is collected and why">
        <List
          items={[
            "Your account email address and a hash of your password (never the password itself), to create and secure your account.",
            "Hashed login session tokens, to keep you signed in.",
            "A workspace name built from the part of your email before the @.",
            "A hashed IP address of people who request a free audit, used only for rate limiting.",
            "The website addresses, business name, business type, services, locations, competitors and brand facts that account holders enter, to run audits and AI visibility tracking.",
            "Answers from AI assistants about your business and its competitors, stored per site so you can see changes over time.",
            "Audit reports of the addresses you submit.",
            "Technical data: like every website, the hosting provider receives your IP address and browser details in order to deliver pages and keep the service secure.",
          ]}
        />
        <p>
          Legal bases under EU and UK law: providing the service you asked for (contract), keeping the site secure, preventing abuse and rate
          limiting (legitimate interests), and your consent where this policy says something is optional.
        </p>
      </Section>

      <Section title="Who it is shared with">
        <Table
          head={["Company", "What they do for this site", "Where"]}
          rows={[
            ["Railway", "Hosting of the app and its Postgres database", "United States"],
            ["Cloudflare", "DNS, CDN, bot protection and Web Analytics for betterseobuilder.com", "United States (global network)"],
            ["OpenAI", "Answers tracked prompts (ChatGPT with web search); receives prompts naming the business and its city", "United States"],
            ["Anthropic", "Answers tracked prompts (Claude with web search); receives prompts naming the business and its city", "United States"],
            ["Google", "Gemini answers tracked prompts; PageSpeed Insights receives audited URLs", "United States"],
            ["Perplexity", "Answers tracked prompts; receives prompts naming the business and its city", "United States"],
            [
              <Placeholder key="mail">email provider, for example Resend</Placeholder>,
              "Sends account emails (email confirmation and password reset); receives your email address",
              <Placeholder key="mail-where">email provider location</Placeholder>,
            ],
          ]}
        />
        <p>Your browser also contacts these companies directly when you use the site:</p>
        <Table
          head={["Company", "Why", "When"]}
          rows={[["Cloudflare Web Analytics", "Cookieless visit and performance statistics, added automatically by Cloudflare", "Every page view on betterseobuilder.com"]]}
        />
        <p>Personal information is not sold, and it is not shared for cross-context behavioural advertising.</p>
      </Section>

      <Section title="International transfers">
        <p>
          The companies above are mostly based in the United States. Where data leaves the EU or UK it is covered by the provider&apos;s standard
          contractual clauses or Data Privacy Framework certification.
        </p>
      </Section>

      <Section title="How long it is kept">
        <List
          items={[
            "Login sessions: 30 days, after which they expire and are deleted.",
            "Hashed IP addresses from free audits: 7 days.",
            "Free audit reports: 90 days.",
            "Account data, saved sites, audits and AI answers: until you delete the site or your account.",
            <>
              Hosting and server logs: <Placeholder>log retention period at the hosting provider</Placeholder>.
            </>,
          ]}
        />
      </Section>

      <Section title="Your rights">
        <List
          items={[
            "EU and UK visitors: access, correction, deletion, restriction, objection, portability, withdrawing consent, and the right to complain to your data protection authority.",
            "California and other US state residents: the right to know, delete and correct, and to opt out of sale or sharing. This site does not sell or share personal information, and it honours Global Privacy Control signals.",
            <>
              You can download your data and delete your account yourself on the{" "}
              <Link href="/app/account" className="font-medium text-accent underline">
                Account page
              </Link>{" "}
              once you are signed in.
            </>,
            <>To use any of these rights, email {contact}. You will get an answer within 30 days. You will never be treated differently for using them.</>,
          ]}
        />
      </Section>

      <Section title="Children">
        <p>This site is not directed at children under 13 (under 16 in the EU and UK) and does not knowingly collect their data.</p>
      </Section>

      <Section title="Cookies and storage">
        <p>
          See the{" "}
          <Link href="/cookies" className="font-medium text-accent underline">
            cookie policy
          </Link>{" "}
          for the full list.
        </p>
      </Section>

      <Section title="Changes">
        <p>If this policy changes in a way that matters, the date above changes and a notice is shown on the site.</p>
      </Section>
    </LegalPage>
  );
}
