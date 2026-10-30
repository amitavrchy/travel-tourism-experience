"use client";
import { useMutation } from "@tanstack/react-query";
import type { Itinerary, PlannerInput } from "@/lib/types";

type GenerateArgs = { input: PlannerInput; signal: AbortSignal; onProgress: (message: string) => void; onDay: (day: Itinerary["days"][number]) => void };
async function generate({ input, signal, onProgress, onDay }: GenerateArgs): Promise<Itinerary> {
  const response = await fetch("/api/planner/stream", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal });
  if (!response.ok) { const error = await response.json(); throw new Error(error.message || "We couldn’t compose your itinerary."); }
  if (!response.body) throw new Error("Streaming isn’t available. Please try again.");
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; let result: Itinerary | undefined;
  const parseEvent = (event: string) => {
    const type = event.split("\n").find(line => line.startsWith("event:"))?.slice(6).trim();
    const raw = event.split("\n").filter(line => line.startsWith("data:")).map(line => line.slice(5).trim()).join("\n");
    if (!raw) return;
    const data = JSON.parse(raw);
    if (type === "progress") onProgress(data.message);
    else if (type === "day") onDay(data);
    else if (type === "complete") result = data;
    else if (type === "error") throw new Error(data.message);
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");
      let boundary;
      while ((boundary = buffer.indexOf("\n\n")) >= 0) { parseEvent(buffer.slice(0, boundary)); buffer = buffer.slice(boundary + 2); }
      if (done) break;
    }
    if (buffer.trim()) parseEvent(buffer);
  } finally { reader.releaseLock(); }
  if (!result?.days.length || !result.sources.length) throw new Error("This itinerary is incomplete. Please try again.");
  return result;
}
export function useGenerateItinerary() { return useMutation({ mutationFn: generate }); }
