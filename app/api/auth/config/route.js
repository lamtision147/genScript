import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    googleEnabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    otpEnabled: true
  });
}
