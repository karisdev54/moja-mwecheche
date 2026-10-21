import { toMsisdn } from "@/lib/phone";

const AT_URL =
  process.env.AT_ENV === "production"
    ? "https://api.africastalking.com/version1/messaging"
    : "https://api.sandbox.africastalking.com/version1/messaging";

export async function sendSms(phone: string | null | undefined, message: string): Promise<void> {
  const msisdn = toMsisdn(phone ?? "");
  if (!msisdn || !process.env.AT_API_KEY) return;

  const params = new URLSearchParams({
    username: process.env.AT_USERNAME ?? "sandbox",
    to: `+${msisdn}`,
    message,
  });
  if (process.env.AT_SENDER_ID) params.set("from", process.env.AT_SENDER_ID);

  try {
    const res = await fetch(AT_URL, {
      method: "POST",
      headers: {
        apiKey: process.env.AT_API_KEY,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
      cache: "no-store",
    });
    if (!res.ok) console.error("SMS failed", res.status, await res.text());
  } catch (e) {
    console.error("SMS error", e);
  }
}