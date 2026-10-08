export default function Loading() {
  return (
    <div className="space-y-3 py-16 text-center">
      <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-accent" />
      <p className="text-lg font-medium">Crawling your site…</p>
      <p className="text-sm text-slate-500">Checking pages, robots.txt, AI crawler access, structured data and speed. This takes a minute or two.</p>
    </div>
  );
}
