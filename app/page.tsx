import Archiver from "./archiver";

export default function Home() {
  return (
    <>
      <Archiver />
      <section className="border-t px-6 py-8 max-w-2xl mx-auto text-center text-sm text-muted-foreground">
        <h2 className="text-base font-medium text-foreground mb-3">
          Website Archiver
        </h2>
        <p className="mb-3">
          Crawl and archive the full HTML source of any website.
        </p>
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
          <li>Monaco code viewer</li>
          <li>Export all pages</li>
          <li>Real-time streaming</li>
        </ul>
      </section>
    </>
  );
}
