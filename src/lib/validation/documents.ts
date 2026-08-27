import { z } from "zod";

// Loose shape check for a ProseMirror document — just enough to reject
// obviously-wrong input (e.g. HTML, plain strings) without re-implementing
// ProseMirror's own schema validation here.
const proseMirrorDocSchema = z
  .object({
    type: z.literal("doc"),
    content: z.array(z.unknown()),
  })
  .passthrough();

export const createDocumentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: proseMirrorDocSchema.optional(),
});

export const updateDocumentSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    content: proseMirrorDocSchema.optional(),
  })
  .refine((data) => data.title !== undefined || data.content !== undefined, {
    message: "At least one of title or content must be provided",
  });
