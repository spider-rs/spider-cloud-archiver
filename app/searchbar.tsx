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
            <svg height={24} width={24} viewBox="0 0 36 34" xmlns="http://www.w3.org/2000/svg" className="fill-[#3bde77] shrink-0 group-hover:scale-110 transition-transform">
              <title>Spider</title>
              <path fillRule="evenodd" clipRule="evenodd" d="M9.13883 7.06589V0.164429L13.0938 0.164429V6.175L14.5178 7.4346C15.577 6.68656 16.7337 6.27495 17.945 6.27495C19.1731 6.27495 20.3451 6.69807 21.4163 7.46593L22.8757 6.175V0.164429L26.8307 0.164429V7.06589V7.95679L26.1634 8.54706L24.0775 10.3922C24.3436 10.8108 24.5958 11.2563 24.8327 11.7262L26.0467 11.4215L28.6971 8.08749L31.793 10.5487L28.7257 14.407L28.3089 14.9313L27.6592 15.0944L26.2418 15.4502C26.3124 15.7082 26.3793 15.9701 26.4422 16.2355L28.653 16.6566L29.092 16.7402L29.4524 17.0045L35.3849 21.355L33.0461 24.5444L27.474 20.4581L27.0719 20.3816C27.1214 21.0613 27.147 21.7543 27.147 22.4577C27.147 22.5398 27.1466 22.6214 27.1459 22.7024L29.5889 23.7911L30.3219 24.1177L30.62 24.8629L33.6873 32.5312L30.0152 34L27.246 27.0769L26.7298 26.8469C25.5612 32.2432 22.0701 33.8808 17.945 33.8808C13.8382 33.8808 10.3598 32.2577 9.17593 26.9185L8.82034 27.0769L6.05109 34L2.37897 32.5312L5.44629 24.8629L5.74435 24.1177L6.47743 23.7911L8.74487 22.7806C8.74366 22.6739 8.74305 22.5663 8.74305 22.4577C8.74305 21.7616 8.76804 21.0758 8.81654 20.4028L8.52606 20.4581L2.95395 24.5444L0.615112 21.355L6.54761 17.0045L6.908 16.7402L7.34701 16.6566L9.44264 16.2575C9.50917 15.9756 9.5801 15.6978 9.65528 15.4242L8.34123 15.0944L7.69155 14.9313L7.27471 14.407L4.20739 10.5487L7.30328 8.08749L9.95376 11.4215L11.0697 11.7016C11.3115 11.2239 11.5692 10.7716 11.8412 10.3473L9.80612 8.54706L9.13883 7.95679V7.06589Z" />
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
