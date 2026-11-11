// Recognises the many ways browsers say "the network is down"
export function isNetworkError(e: unknown): boolean {
  const m = e instanceof Error ? e.message : String(e ?? "");
  return /failed to fetch|networkerror|load failed|network request failed|fetch failed|internet|connection was lost|econnreset/i.test(m);
}

export function friendlyError(message: string): string {
  return isNetworkError(message) ? "Network error. Check your internet connection and try again." : message;
}

// Tells the full-screen network screen to check the connection right now
export function notifyNetworkDown() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("net:down"));
}