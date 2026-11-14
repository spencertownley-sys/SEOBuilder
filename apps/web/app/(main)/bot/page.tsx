import type { Metadata } from "next";
import { LEGACY_BOT_TOKEN, USER_AGENT } from "@seobuilder/core";
import { PUBLIC_PAGE_LIMIT, SITE_PAGE_LIMIT } from "@seobuilder/platform";
import { LegalPage, List, Placeholder, POLICY_UPDATED, Section } from "@/components/legal";

export const metadata: Metadata = {
  title: "MentionfulBot, our crawler",
  description: "What MentionfulBot (formerly SEOBuilderBot) is, what it fetches, how often, and how to block it.",
  alternates: { canonical: "/bot" },
};

const code = "rounded bg-slate-100 px-1.5 py-0.5 font-mono text-sm text-ink";

export default function BotPage() {
  return (
    <LegalPage title="MentionfulBot, the Mentionful crawler" updated={POLICY_UPDATED}>
      <p>
        If you found <code className={code}>MentionfulBot</code> or <code className={code}>{LEGACY_BOT_TOKEN}</code> in your server logs, this
        page explains what it is. Its full user agent is <code className={code}>{USER_AGENT}</code>. It was called {LEGACY_BOT_TOKEN} before
        the product was renamed to Mentionful.
      </p>

      <Section title="What it is">
        <p>
          MentionfulBot is the crawler behind Mentionful, a website audit for search engines and AI assistants. It runs when someone requests a
          free audit of a site, and every week for sites that an account holder tracks and has proved they own.
        </p>
      </Section>

      <Section title="What it fetches">
        <List
          items={[
            <>
              <code className={code}>/robots.txt</code> first, then <code className={code}>/sitemap.xml</code> (or the sitemaps robots.txt
              lists) and <code className={code}>/llms.txt</code>.
            </>,
            `The homepage and same-site HTML pages linked from it or listed in the sitemap: up to ${PUBLIC_PAGE_LIMIT} pages for a free audit and up to ${SITE_PAGE_LIMIT} for a verified tracked site.`,
            "A light status check (HEAD, or a small GET when HEAD is refused) of a limited number of links, to find broken ones.",
            "It never submits forms, logs in, or runs JavaScript.",
          ]}
        />
      </Section>

      <Section title="How often">
        <p>
          Only when someone asks for an audit of your site, and once a week for sites whose owner tracks them in Mentionful. It fetches a few
          pages at a time with a pause between requests.
        </p>
      </Section>

      <Section title="It follows robots.txt">
        <List
          items={[
            "It obeys Allow and Disallow rules for MentionfulBot, for SEOBuilderBot, and for User-agent: *, using the most specific group.",
            "It honours Crawl-delay up to 10 seconds, fetching one page at a time when one is set.",
            "If robots.txt answers with a server error or cannot be reached, it treats the whole site as disallowed and stops.",
          ]}
        />
      </Section>

      <Section title="How to block it">
        <p>Add this to your robots.txt:</p>
        <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-4 font-mono text-sm text-ink">
          {`User-agent: MentionfulBot\nDisallow: /\n\nUser-agent: ${LEGACY_BOT_TOKEN}\nDisallow: /`}
        </pre>
        <p>It does not crawl from fixed IP addresses, so please block it by user agent in robots.txt rather than by IP.</p>
      </Section>

      <Section title="Contact">
        <p>
          Problems with the crawler, or a request to stop it: <Placeholder>contact email, for example support@mentionful.com</Placeholder>. Every
          message gets a reply.
        </p>
      </Section>
    </LegalPage>
  );
}
