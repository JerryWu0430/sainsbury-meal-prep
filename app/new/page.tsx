import { Listing } from "@/components/listing";

export const metadata = { title: "New in" };
export default function NewPage() {
  return <Listing path="new" placeholder="Keywords, comma-separated (default: meal, chicken, snack…)" />;
}
