import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runPendingJobs } from "@/services/documents/processing.service";

export const maxDuration = 300;

function validSecret(provided: string | null): boolean {
  const expected = process.env.JOB_RUNNER_SECRET;
  if (!expected || expected.length < 16 || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Sweep endpoint for a scheduler: processes queued jobs and reclaims stuck ones. */
export async function POST(request: Request) {
  if (!validSecret(request.headers.get("x-job-secret"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const handled = await runPendingJobs(10);
  return NextResponse.json({ handled });
}
