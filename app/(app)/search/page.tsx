import { Listing } from "@/components/listing";

export const metadata = { title: "Search" };
export default function SearchPage() {
  return <Listing path="search" placeholder="Search products…" required />;
}
