import { Suspense } from "react";
import { Ask } from "@/components/ask";

export const metadata = { title: "Ask" };
export default function AskPage() {
  return <Suspense><Ask /></Suspense>; // useSearchParams (prefill from /mealprep) needs a boundary for static prerender
}
