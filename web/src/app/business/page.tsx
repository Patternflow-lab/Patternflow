import { redirect } from "next/navigation";

// /business was never a page. It has sent people to /contact since the contact
// page arrived on 12 May 2026 (bbb6a21a), and that page still wears the
// business-* classes in globals.css. Nothing in the repository links /business.

export default function BusinessPage() {
  redirect("/contact");
}
