import { z } from "zod";

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

export const documentMetadataSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.preprocess(emptyToNull, z.string().trim().max(2000).nullable()),
  categoryId: z.preprocess(emptyToNull, z.string().uuid().nullable()),
});

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.preprocess(emptyToNull, z.string().trim().max(1000).nullable()),
});

export const uuidSchema = z.string().uuid();

/** Same rule as the DB check: http(s) URLs or site-relative paths; blocks javascript:, data: and //host. */
export const SAFE_URL = /^(https?:\/\/[^\s]+|\/[^/\s][^\s]*)$/;

export const contentSchema = z
  .object({
    kind: z.enum(["announcement", "faq", "quick_link"]),
    title: z.string().trim().min(1, "Title is required").max(200),
    body: z.preprocess(emptyToNull, z.string().trim().max(5000).nullable()),
    url: z.preprocess(emptyToNull, z.string().trim().max(2000).regex(SAFE_URL, "URL must start with http(s):// or /").nullable()),
    sortOrder: z.coerce.number().int().min(-9999).max(9999).default(0),
    isPublished: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "quick_link" && !v.url) ctx.addIssue({ code: "custom", path: ["url"], message: "A quick link needs a URL" });
    if (v.kind === "faq" && !v.body) ctx.addIssue({ code: "custom", path: ["body"], message: "An FAQ needs an answer" });
  });
