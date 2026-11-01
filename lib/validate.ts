export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

export function emailProblem(v: string): string | null {
  if (!v.trim()) return "Enter your email.";
  return isEmail(v) ? null : "Enter a valid email, like name@example.com.";
}

export const cleanName = (v: string) => v.trim().replace(/\s+/g, " ");

export function nameProblem(v: string): string | null {
  const n = cleanName(v);
  if (!n) return "Enter your full name.";
  if (n.length > 60) return "That name is too long.";
  if (!/^\p{L}[\p{L}\s'.-]*$/u.test(n)) return "Use letters only in your name.";
  if (!n.includes(" ")) return "Enter your first and last name.";
  return null;
}

// Kenyan numbers: 07xx, 01xx, 7xx, 254... or +254... all become +2547xxxxxxxx
export function normalizePhone(v: string): string | null {
  const d = v.replace(/\D/g, "");
  if (/^254[17]\d{8}$/.test(d)) return `+${d}`;
  if (/^0[17]\d{8}$/.test(d)) return `+254${d.slice(1)}`;
  if (/^[17]\d{8}$/.test(d)) return `+254${d}`;
  return null;
}

export function phoneProblem(v: string): string | null {
  if (!v.trim()) return "Enter your phone number.";
  return normalizePhone(v) ? null : "Enter a valid Kenyan number, e.g. 0712 345 678.";
}

export function passwordProblem(v: string, loginOnly: boolean): string | null {
  if (!v) return "Enter your password.";
  if (loginOnly) return null;
  if (v.length < 8) return "Use at least 8 characters.";
  if (!/[a-z]/i.test(v) || !/\d/.test(v)) return "Use a mix of letters and numbers.";
  return null;
}

// Turns database messages into plain language
export function friendlyDbError(msg: string, code?: string): string {
  if (code === "23505" || /profiles_phone_unique|duplicate key|already registered/i.test(msg)) {
    return "That phone number is already used by another account.";
  }
  if (/valid Kenyan phone/i.test(msg)) return "Enter a valid Kenyan number, e.g. 0712 345 678.";
  return msg;
}