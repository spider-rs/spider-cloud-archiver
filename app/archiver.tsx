"use client";

import { useState, useMemo, lazy, Suspense } from "react";
import SearchBar from "./searchbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";

const MonacoEditor = lazy(() =>
  import("@monaco-editor/react").then((m) => ({ default: m.default }))
);

function getTitle(html: string, url: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.trim() || new URL(url).pathname;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Archiver() {
  const [data, setData] = useState<any[] | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const pages = (data || []).filter((p: any) => p?.url);
  const current = pages[selectedIdx];

  const content = current?.content || "";
  const contentSize = useMemo(
    () => (content ? new Blob([content]).size : 0),
    [content]
  );
  const charCount = content.length;

  const copyContent = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      toast({ title: "Copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const downloadCurrent = () => {
    const slug = current.url.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);
    downloadBlob(content, `${slug}.html`, "text/html");
  };

  const exportAll = () => {
    const ts = new Date().toISOString().slice(0, 10);
    const combined = pages
      .map((p: any) => `<!-- ${p.url} -->\n${p.content || ""}`)
      .join("\n\n");
    downloadBlob(combined, `archive-${ts}.html`, "text/html");
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <SearchBar setDataValues={setData} />
      {pages.length > 0 && current ? (
        <div className="flex flex-1 overflow-hidden">
          {/* Page List Sidebar */}
          <div className="w-64 border-r flex flex-col shrink-0">
            <div className="px-3 py-2 bg-muted/50 border-b text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>
                {pages.length} page{pages.length !== 1 ? "s" : ""} crawled
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[10px]"
                onClick={exportAll}
              >
                Export All
              </Button>
            </div>
            <div className="overflow-auto flex-1">
              {pages.map((p: any, i: number) => {
                const title = getTitle(p.content || "", p.url);
                const size = new Blob([p.content || ""]).size;
                const status = p.status || 200;
                return (
                  <button
                    key={i}
                    className={`w-full text-left px-3 py-2.5 border-b last:border-b-0 hover:bg-muted/30 transition-colors ${
                      selectedIdx === i
                        ? "bg-muted/50 border-l-2 border-l-[#3bde77]"
                        : ""
                    }`}
                    onClick={() => setSelectedIdx(i)}
                  >
                    <p className="text-xs font-medium truncate">{title}</p>
                    <p className="text-[10px] text-muted-foreground truncate font-mono mt-0.5">
                      {p.url}
                    </p>
                    <div className="flex gap-2 mt-1">
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1 py-0"
                      >
                        {formatSize(size)}
                      </Badge>
                      <Badge
                        variant={status >= 400 ? "destructive" : "outline"}
                        className="text-[9px] px-1 py-0"
                      >
                        {status}
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/20">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{formatSize(contentSize)}</span>
                <span>{charCount.toLocaleString()} chars</span>
              </div>
              <div className="flex-1" />
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7"
                onClick={copyContent}
              >
                {copied ? (
                  <>
                    <svg
                      className="w-3 h-3 mr-1 text-green-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Copied
                  </>
                ) : (
                  "Copy"
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7"
                onClick={downloadCurrent}
              >
                Download
              </Button>
            </div>

            {/* Monaco Editor */}
            <div className="flex-1">
              <Suspense
                fallback={
                  <div className="p-4 text-muted-foreground text-sm">
                    Loading editor...
                  </div>
                }
              >
                <MonacoEditor
                  height="100%"
                  language="html"
                  value={content}
                  theme="vs-dark"
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    wordWrap: "on",
                    fontSize: 12,
                  }}
                />
              </Suspense>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center flex-1 text-center space-y-4">
          <svg
            height={64}
            width={64}
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            className="fill-[#3bde77] opacity-30"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M1.5 1.5H7.5V7.5H1.5zM16.5 1.5H22.5V7.5H16.5zM1.5 16.5H7.5V22.5H1.5zM16.5 16.5H22.5V22.5H16.5zM7.5 3H16.5V6H7.5zM3 7.5H6V16.5H3zM7.5 6H8.25L18.75 16.5H16.5V18.75L6 8.25V7.5H7.5z"
            />
          </svg>
          <h2 className="text-xl font-semibold text-muted-foreground">
            Spider Archiver
          </h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Crawl any website and archive the results locally. Browse pages,
            inspect source HTML, copy content, or download individual pages and
            full archives.
          </p>
        </div>
      )}
      <Toaster />
    </div>
  );
}
