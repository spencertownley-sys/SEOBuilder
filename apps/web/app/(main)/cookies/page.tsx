import type { Metadata } from "next";
import { LegalPage, List, Placeholder, POLICY_UPDATED, Section, Table } from "@/components/legal";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "Every cookie and browser storage item Mentionful and Better SEO Builder use, and what loads from other companies.",
  alternates: { canonical: "/cookies" },
};

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie policy for Mentionful and Better SEO Builder" updated={POLICY_UPDATED}>
      <p>
        This site only uses the cookies and browser storage it needs to work. It does not use advertising or cross-site tracking cookies, so
        there is nothing to opt in to. This page lists exactly what is stored and what loads from other companies.
      </p>

      <Section title="Cookies">
        <Table
          head={["Name", "Set by", "Purpose", "Type", "How long"]}
          rows={[
            ["sb_session", "Mentionful (mentionful.com)", "Keeps you signed in to your Mentionful account", "Strictly necessary", "30 days"],
            [
              "cf_clearance",
              "Cloudflare (betterseobuilder.com)",
              "Shows Cloudflare's bot protection that your browser passed a security check, so you are not challenged again",
              "Strictly necessary",
              "Up to 1 year",
            ],
          ]}
        />
      </Section>

      <Section title="Browser storage">
        <Table
          head={["Key", "Where", "Purpose", "Type"]}
          rows={[["cookie-consent", "localStorage", "Remembers that you have seen the cookie notice", "Strictly necessary"]]}
        />
      </Section>

      <Section title="Other companies your browser contacts">
        <Table
          head={["Company", "Host", "Why", "When", "What they receive"]}
          rows={[
            [
              "Cloudflare Web Analytics",
              "static.cloudflareinsights.com",
              "Cookieless visit and performance statistics, added automatically by Cloudflare",
              "Every page view on betterseobuilder.com",
              "IP address, page URL, referrer, browser details, page load timings",
            ],
          ]}
        />
      </Section>

      <Section title="Your choices">
        <List
          items={[
            "You can clear or block cookies and site storage in your browser settings. Necessary items are needed for the site to work, so signing in will not work without the session cookie.",
            <>
              You can show the cookie notice again at any time:{" "}
              <button type="button" data-cookie-settings className="font-medium text-accent underline">
                Cookie settings
              </button>
            </>,
          ]}
        />
      </Section>

      <Section title="Contact">
        <p>
          Questions about this page: <Placeholder>contact email, for example support@mentionful.com</Placeholder>.
        </p>
      </Section>
    </LegalPage>
  );
}
