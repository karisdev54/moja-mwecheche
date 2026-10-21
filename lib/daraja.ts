const BASE =
  process.env.DARAJA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

async function getAccessToken(): Promise<string> {
  const auth = Buffer.from(
    `${process.env.DARAJA_CONSUMER_KEY}:${process.env.DARAJA_CONSUMER_SECRET}`
  ).toString("base64");

  const res = await fetch(`${BASE}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Daraja login failed (${res.status}). Check your keys.`);
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

type StkResult = {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage?: string;
  errorMessage?: string;
};

export async function stkPush(args: {
  phone: string; // 2547XXXXXXXX
  amount: number; // whole shillings
  reference: string; // max 12 chars
  description: string; // keep short
  callbackUrl: string;
}): Promise<StkResult> {
  const shortcode = process.env.DARAJA_SHORTCODE as string;
  const passkey = process.env.DARAJA_PASSKEY as string;
  const timestamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const password = Buffer.from(shortcode + passkey + timestamp).toString("base64");
  const token = await getAccessToken();

  const res = await fetch(`${BASE}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: process.env.DARAJA_TRANSACTION_TYPE ?? "CustomerPayBillOnline",
      Amount: args.amount,
      PartyA: args.phone,
      PartyB: process.env.DARAJA_PARTY_B ?? shortcode,
      PhoneNumber: args.phone,
      CallBackURL: args.callbackUrl,
      AccountReference: args.reference,
      TransactionDesc: args.description,
    }),
  });

  const json = (await res.json()) as StkResult;
  if (!res.ok || json.ResponseCode !== "0") {
    throw new Error(json.errorMessage ?? json.ResponseDescription ?? "STK push failed");
  }
  return json;
}