import { ChefHat, Heart, MessageSquare, Search, Sparkles, Tag, type LucideIcon } from "lucide-react";

export const NAV: { href: string; title: string; icon: LucideIcon; blurb: string }[] = [
  { href: "/", title: "Offers", icon: Tag, blurb: "Discounted staples, best % off first" },
  { href: "/new", title: "New in", icon: Sparkles, blurb: "Recently added to the range" },
  { href: "/mealprep", title: "Plan", icon: ChefHat, blurb: "Pick dishes priced from today's offers, hit your macros, get one shopping list" },
  { href: "/search", title: "Search", icon: Search, blurb: "Anything in the online range" },
  { href: "/favourites", title: "Favourites", icon: Heart, blurb: "Starred items, refreshed against today's prices" },
  { href: "/ask", title: "Ask", icon: MessageSquare, blurb: "An agent that knows today's offers and your store" },
];
