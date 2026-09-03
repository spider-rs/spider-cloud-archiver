"use client";

import React, { Dispatch, SyntheticEvent, useEffect, useRef, useState } from "react";
import { VscLoading, VscSearch, VscSettings } from "react-icons/vsc";
import ms from "ms";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogOverlay,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AuthDropdown, { useAuthMenu } from "./auth";
import AppSwitcher from "./app-switcher";
import { savePages } from "@/lib/storage";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.spider.cloud";

enum StorageKeys {
  Limit = "@app/crawl_limit",
  ReturnFormat = "@app/return_format",
  Request = "@app/request",
  FullResources = "@app/full_resources",
}

const localStorageReady = typeof localStorage !== "undefined";

const loadDefaultCrawlLimit = () => {
  if (!localStorageReady) {
    return 50;
  }
  const climit = localStorage.getItem(StorageKeys.Limit);
  return climit ? parseInt(climit, 10) : 50;
};
const loadDefaultReturnType = () => {
  if (!localStorageReady) {
    return "raw";
  }
  const returnFormat = localStorage.getItem(StorageKeys.ReturnFormat);
  return returnFormat || "raw";
};
const loadDefaultRequest = () => {
  if (!localStorageReady) {
    return "smart";
  }
  const request = localStorage.getItem(StorageKeys.Request);
  return request || "smart";
};
const loadDefaultFullResources = () => {
  if (!localStorageReady) {
    return false;
  }
  return localStorage.getItem(StorageKeys.FullResources) === "true";
};

const SearchBar = ({
  setDataValues,
  onSaveComplete,
}: {
  setDataValues: Dispatch<any>;
  onSaveComplete?: () => void;
}) => {
  const [url, setURl] = useState<string>("");
  const [dataLoading, setDataLoading] = useState<boolean>(false);
  const [configModalOpen, setConfigModalOpen] = useState<boolean>(false);
  const [crawlLimit, setCrawlLimit] = useState<number>(loadDefaultCrawlLimit());
  const [returnFormat, setReturnFormat] = useState<string>(
    loadDefaultReturnType()
  );
  const [apiKey, setAPIKey] = useState<string>("");
  const [request, setRequest] = useState<string>(loadDefaultRequest());
  const [fullResources, setFullResources] = useState<boolean>(loadDefaultFullResources());

  const crawledPagesRef = useRef<any[]>([]);
  const streamBufferRef = useRef<string>("");

  const auth = useAuthMenu();

  const { toast } = useToast();

  useEffect(() => {
    const prefill = new URLSearchParams(window.location.search).get("url");
    if (prefill) setURl(prefill);
  }, []);

  const onInputChangeEvent = (e: SyntheticEvent<HTMLInputElement>) => {
    setAPIKey(e.currentTarget.value);
  };

  const onAPIEvent = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const jwt = auth.$session?.access_token;

    if (!jwt) {
      return toast({
        title: "Authentication Required",
        description:
          "Please login or register with spider.cloud and purchase credits.",
      });
    }

    if (!url) {
      return toast({
        title: "URL Required",
        description: "Please enter a valid website url.",
      });
    }

    const urlList = url
      ?.trim()
      .split(",")
      .map((item) =>
        item.startsWith("http://") || item.startsWith("https://")
          ? item.trim()
          : `https://${item}`
      )
      .filter(Boolean);

    const _url = urlList.join(",");

    const paramValues: Record<string, any> = {
      url: _url,
      limit: crawlLimit,
      return_format: returnFormat,
      request,
    };

    if (fullResources) {
      paramValues.full_resources = true;
    }

    setDataLoading(true);
    crawledPagesRef.current = [];
    streamBufferRef.current = "";

    const current = performance.now();

    let pages = 0;
    let finished = false;

    toast({
      title: "Crawling",
      description: `Crawling ${urlList.length} website${
        urlList.length === 1 ? "" : "s"
      } - ${urlList.join("\n")}.`,
    });

    try {
      const res = await fetch(API_URL + "/crawl", {
        method: "POST",
        body: JSON.stringify(paramValues),
        headers: {
          "content-type": "application/jsonl",
          authorization: apiKey || jwt,
        },
      });

      if (res.ok) {
        finished = true;

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              // Process any remaining buffered data
              if (streamBufferRef.current.trim()) {
                if (processLine(streamBufferRef.current.trim())) {
                  pages += 1;
                }
              }
              streamBufferRef.current = "";
              break;
            }

            const chunk = decoder.decode(value, { stream: true });

            // Append to buffer and split by newlines to handle JSONL
            streamBufferRef.current += chunk;
            const lines = streamBufferRef.current.split("\n");

            // Keep the last (potentially incomplete) line in the buffer
            streamBufferRef.current = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              if (processLine(trimmed)) {
                pages += 1;
              }
            }
          }
        }
      }
    } catch (e) {
      if (e instanceof Error) {
        console.error(e);
      }
    } finally {
      setDataLoading(false);
      streamBufferRef.current = "";
      if (finished) {
        toast({
          title: "Crawl finished",
          description: `The time took was ${ms(performance.now() - current, {
            long: true,
          })} for ${pages} page${pages === 1 ? "" : "s"}.`,
        });

        // Persist crawled pages to IndexedDB
        if (crawledPagesRef.current.length) {
          savePages(crawledPagesRef.current)
            .then(() => onSaveComplete?.())
            .catch(console.error);
        }
      }
      crawledPagesRef.current = [];
    }
  };

  const processLine = (line: string) => {
    try {
      const parsed = JSON.parse(line);

      if (parsed) {
        crawledPagesRef.current.push(parsed);
      }

      requestAnimationFrame(() => {
        setDataValues((prevData: any) => {
          if (prevData && Array.isArray(prevData)) {
            return [...prevData, parsed];
          }
          return [parsed];
        });
      });

      return true;
    } catch (_error) {
      return false;
    }
  };

  const onChangeEvent = (e: SyntheticEvent<HTMLInputElement>) =>
    setURl(e.currentTarget.value);

  const openConfigModal = () => setConfigModalOpen(true);
  const closeConfigModal = () => setConfigModalOpen(false);

  const handleLimitChange = (e: SyntheticEvent<HTMLInputElement>) =>
    setCrawlLimit(Number(e.currentTarget.value));
  const handleFormatChange = (v: string) => setReturnFormat(v);
  const handleReturnChange = (v: string) => setRequest(v);

  const onLogoutEvent = async (e: SyntheticEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    await auth.signOut();
    closeConfigModal();
  };

  const saveConfigEvent = () => {
    localStorage.setItem(StorageKeys.Limit, crawlLimit + "");
    localStorage.setItem(StorageKeys.Request, request + "");
    localStorage.setItem(StorageKeys.ReturnFormat, returnFormat + "");
    localStorage.setItem(StorageKeys.FullResources, fullResources + "");

    closeConfigModal();
  };

  return (
    <>
      <nav className="relative z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3 py-2.5 px-4">
          <a href="https://spider.cloud" target="_blank" rel="noreferrer" className="flex gap-2.5 items-center shrink-0 group">
            <svg height={24} width={24} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="fill-[#3bde77] shrink-0 group-hover:scale-110 transition-transform">
              <title>Spider</title>
              <path fillRule="evenodd" clipRule="evenodd" d="M20.646 5.196A2.25 2.25 0 0 0 17.199 2.304L15.447 4.391A4.5 4.5 0 0 1 8.553 4.391L6.801 2.304A2.25 2.25 0 0 0 3.354 5.196L8.697 11.564A4.5 4.5 0 0 1 9.75 14.457L9.75 20.25A2.25 2.25 0 0 0 14.25 20.25L14.25 14.457A4.5 4.5 0 0 1 15.303 11.564L20.646 5.196Z" />
            </svg>
            <h1 className="text-sm font-semibold truncate hidden sm:block">Spider Archiver</h1>
          </a>
          {auth?.$session ? (
            <form className="flex items-center gap-2 flex-1 min-w-0 justify-end" onSubmit={onAPIEvent} noValidate>
              <div className="relative w-full max-w-xs sm:max-w-sm">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <VscSearch className="w-4 h-4 text-muted-foreground" />
                </div>
                <Label htmlFor="website-form" className="sr-only">Crawl Website</Label>
                <Input
                  type="text"
                  id="website-form"
                  className="pl-9 pr-3 h-9 text-sm w-full rounded-lg border-muted-foreground/25 bg-muted/40 placeholder:text-muted-foreground/50 focus-visible:ring-[#3bde77]/40 focus-visible:border-[#3bde77]/50 transition-colors"
                  placeholder="Enter website URL to crawl..."
                  value={url}
                  onChange={onChangeEvent}
                />
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={dataLoading}
                className="bg-[#3bde77] hover:bg-[#2bc866] text-black font-medium h-9 px-4 rounded-lg shrink-0 disabled:opacity-70"
              >
                {dataLoading ? (
                  <><VscLoading className="motion-safe:animate-spin w-3.5 h-3.5 mr-1.5" />Crawling</>
                ) : (
                  "Crawl"
                )}
              </Button>
            </form>
          ) : <div className="flex-1" />}
          <div className="flex items-center gap-1 shrink-0">
            <AppSwitcher currentUrl={url} />
            {auth?.$session ? (
              <Button type="button" variant="ghost" size="sm" onClick={openConfigModal} className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground">
                <VscSettings className="w-4 h-4" />
              </Button>
            ) : null}
            <AuthDropdown {...auth} />
          </div>
        </div>
      </nav>

      {configModalOpen && (
        <Dialog
          open={configModalOpen}
          onOpenChange={(e: boolean) => setConfigModalOpen(e)}
        >
          <DialogOverlay />
          <DialogContent className="p-4rounded-md shadow-md">
            <DialogHeader>
              <DialogTitle>Configuration</DialogTitle>
              <DialogDescription>
                Set your configuration options for crawling.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="flex items-center">
                <Label htmlFor="crawlLimit" className="flex-1">
                  Crawl Limit:
                </Label>
                <Input
                  type="number"
                  id="crawlLimit"
                  className="p-2 border w-1/2 border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  value={crawlLimit}
                  onChange={handleLimitChange}
                  min="1"
                  max="1000"
                />
              </div>
              <div className="flex items-center">
                <Label htmlFor="returnFormat" className="flex-1">
                  Return Format:
                </Label>

                <Select
                  onValueChange={handleFormatChange}
                  defaultValue={returnFormat}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Raw" id="returnFormat" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="raw">Raw</SelectItem>
                    <SelectItem value="markdown">Markdown</SelectItem>
                    <SelectItem value="text">Text</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center">
                <Label htmlFor="request" className="flex-1">
                  Request:
                </Label>
                <Select
                  onValueChange={handleReturnChange}
                  defaultValue={request}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="HTTP" id="request" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http">HTTP</SelectItem>
                    <SelectItem value="chrome">Chrome</SelectItem>
                    <SelectItem value="smart">Smart Mode</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center">
                <Label htmlFor="fullResources" className="flex-1">
                  Full Resources:
                </Label>
                <Select
                  onValueChange={(v: string) => setFullResources(v === "true")}
                  defaultValue={fullResources ? "true" : "false"}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Off" id="fullResources" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false">Off</SelectItem>
                    <SelectItem value="true">On</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="sk-key">API Key</Label>
                <Input
                  placeholder="sk-somesecret"
                  id="sk-key"
                  onChange={onInputChangeEvent}
                />
                <div className="py-2 text-sm text-muted-foreground">
                  <p>
                    This key does not get stored and is only used in the current
                    session.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                onClick={saveConfigEvent}
                className="px-4 py-2 rounded self-end"
              >
                Save
              </Button>

              <div className="pt-20 pb-2 flex place-content-end border-t">
                <Button onClick={onLogoutEvent} variant={"destructive"}>
                  Logout
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default SearchBar;
