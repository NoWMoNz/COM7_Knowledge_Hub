import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const DAYS = 14;
const TZ = "Asia/Bangkok";
const dayKey = (d: Date | string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(d)); // YYYY-MM-DD

export function lastDays(n = DAYS): string[] {
  return Array.from({ length: n }, (_, i) => dayKey(new Date(Date.now() - (n - 1 - i) * 86_400_000)));
}

function bucket(rows: { created_at: string }[], days: string[]): number[] {
  const m = new Map(days.map((d) => [d, 0]));
  rows.forEach((r) => { const k = dayKey(r.created_at); if (m.has(k)) m.set(k, m.get(k)! + 1); });
  return days.map((d) => m.get(d)!);
}

export const normalizeQuestion = (q: string) => q.toLowerCase().replace(/\s+/g, " ").replace(/[?？!.\s]+$/g, "").trim();

/** All figures come from database rows; an empty database yields zeros and empty lists. */
export async function getAdminStats() {
  const sb = createAdminClient();
  const days = lastDays();
  const since14 = new Date(Date.now() - DAYS * 86_400_000).toISOString();
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const since90 = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const head = { count: "exact", head: true } as const;

  const [users, activeUsers, docs, totalQ, totalUnanswered, openUnanswered, uploads, qSeries, uSeries, sources, userQs, recentQs] = await Promise.all([
    sb.from("profiles").select("id", head),
    sb.from("profiles").select("id", head).eq("is_active", true),
    sb.from("documents").select("id, created_at, current_version_id, title, latest:document_versions!documents_latest_version_fk(status, uploaded_by_name)").order("created_at", { ascending: false }).limit(5000),
    sb.from("chat_messages").select("id", head).eq("role", "user"),
    sb.from("unanswered_questions").select("id", head),
    sb.from("unanswered_questions").select("id", head).eq("status", "open"),
    sb.from("document_versions").select("created_at").gte("created_at", since14).limit(5000),
    sb.from("chat_messages").select("created_at").eq("role", "user").gte("created_at", since14).limit(5000),
    sb.from("unanswered_questions").select("created_at").gte("created_at", since14).limit(5000),
    sb.from("message_sources").select("document_id, chat_messages!inner(created_at)").gte("chat_messages.created_at", since30).limit(5000),
    sb.from("chat_messages").select("chat_sessions!inner(user_id)").eq("role", "user").gte("created_at", since30).limit(5000),
    sb.from("chat_messages").select("content").eq("role", "user").gte("created_at", since90).limit(3000),
  ]);

  type DocRow = { id: string; created_at: string; current_version_id: string | null; title: string; latest: { status: string; uploaded_by_name: string | null } | { status: string; uploaded_by_name: string | null }[] | null };
  const docRows = (docs.data ?? []) as unknown as DocRow[];
  const statusOf = (d: DocRow) => (Array.isArray(d.latest) ? d.latest[0] : d.latest)?.status;
  const documents = {
    total: docRows.length,
    ready: docRows.filter((d) => d.current_version_id).length,
    processing: docRows.filter((d) => ["uploading", "processing"].includes(statusOf(d) ?? "")).length,
    failed: docRows.filter((d) => statusOf(d) === "failed").length,
  };

  // Category usage = which categories the AI answers actually drew on (last 30 days).
  const srcDocIds = [...new Set((sources.data ?? []).map((s) => s.document_id).filter(Boolean) as string[])];
  const { data: srcDocs } = srcDocIds.length
    ? await sb.from("documents").select("id, categories(name)").in("id", srcDocIds)
    : { data: [] as { id: string; categories: { name: string } | { name: string }[] | null }[] };
  const catOf = new Map((srcDocs ?? []).map((d) => [d.id, (Array.isArray(d.categories) ? d.categories[0]?.name : d.categories?.name) ?? "ไม่ระบุหมวด / Uncategorized"]));
  const catCounts = new Map<string, number>();
  (sources.data ?? []).forEach((s) => { if (s.document_id) { const n = catOf.get(s.document_id as string) ?? "-"; catCounts.set(n, (catCounts.get(n) ?? 0) + 1); } });

  const faq = new Map<string, { text: string; n: number }>();
  (recentQs.data ?? []).forEach((r) => {
    const key = normalizeQuestion(r.content as string);
    if (!key) return;
    const cur = faq.get(key) ?? { text: (r.content as string).slice(0, 200), n: 0 };
    cur.n++; faq.set(key, cur);
  });

  const perUser = new Map<string, number>();
  (userQs.data ?? []).forEach((r) => {
    const s = r.chat_sessions as unknown as { user_id: string } | { user_id: string }[];
    const uid = Array.isArray(s) ? s[0]?.user_id : s?.user_id;
    if (uid) perUser.set(uid, (perUser.get(uid) ?? 0) + 1);
  });
  const topIds = [...perUser.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const { data: topProfiles } = topIds.length ? await sb.from("profiles").select("id, email, full_name").in("id", topIds.map(([id]) => id)) : { data: [] };
  const nameOf = new Map((topProfiles ?? []).map((p) => [p.id, p.full_name || p.email]));

  const totalQuestions = totalQ.count ?? 0;
  const unansweredTotal = totalUnanswered.count ?? 0;
  return {
    users: { total: users.count ?? 0, active: activeUsers.count ?? 0 },
    documents,
    questions: { total: totalQuestions, unanswered: unansweredTotal, openUnanswered: openUnanswered.count ?? 0 },
    days,
    series: { uploads: bucket(uploads.data ?? [], days), questions: bucket(qSeries.data ?? [], days), unanswered: bucket(uSeries.data ?? [], days) },
    topCategories: [...catCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([name, count]) => ({ name, count })),
    frequentQuestions: [...faq.values()].filter((f) => f.n >= 2).sort((a, b) => b.n - a.n).slice(0, 8),
    activeUsers30d: topIds.map(([id, count]) => ({ name: nameOf.get(id) ?? id, count })),
    recentDocuments: docRows.slice(0, 5).map((d) => ({ id: d.id, title: d.title, created_at: d.created_at, status: statusOf(d) ?? "-", by: (Array.isArray(d.latest) ? d.latest[0] : d.latest)?.uploaded_by_name ?? "-" })),
  };
}
