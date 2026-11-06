import { PageSkeleton } from "@/components/ui/page-skeleton";

// Per-page boundary: a loading.tsx only shows on navigations into its own segment, so the group-level one does not cover
// moving between sibling pages. This one makes the skeleton appear the moment a link is clicked.
export default function Loading() {
  return <PageSkeleton />;
}
