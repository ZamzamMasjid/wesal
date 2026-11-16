import { notFound } from "next/navigation";

// Any path with no page of its own lands here, so it renders the localized
// not-found page inside the locale layout instead of a bare 404.
export default function CatchAll() {
  notFound();
}
