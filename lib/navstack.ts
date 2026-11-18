// A small memory of the pages visited in this tab, so a back arrow can return to the real previous page
const KEY = "nav-stack";
const SKIP = ["/login", "/auth/complete", "/goodbye", "/suspended", "/reset-password"];
const RESET = ["/login", "/goodbye"]; // a new session starts here, so forget the old trail

function read(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}
function write(s: string[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(s.slice(-30)));
  } catch {
    // storage blocked: the arrows simply use their fallback page
  }
}

export function recordPath(path: string) {
  if (RESET.includes(path)) {
    write([]);
    return;
  }
  if (SKIP.includes(path)) return;
  const s = read();
  if (s[s.length - 1] === path) return;
  if (s.length >= 2 && s[s.length - 2] === path) s.pop(); // the person went back
  else s.push(path);
  write(s);
}

// The page before the current one, or null if there is none
export function previousPath(current: string): string | null {
  const s = read();
  const prev = s[s.length - 1] === current ? s[s.length - 2] : s[s.length - 1];
  return prev && prev !== current ? prev : null;
}