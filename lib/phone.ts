// Returns 2547XXXXXXXX (or 2541XXXXXXXX) or null if the number is invalid
export function toMsisdn(input: string): string | null {
  const d = input.replace(/\D/g, "");
  let n = d;
  if (d.startsWith("254")) n = d;
  else if (d.startsWith("0")) n = "254" + d.slice(1);
  else if (d.length === 9) n = "254" + d;
  return /^254[17]\d{8}$/.test(n) ? n : null;
}