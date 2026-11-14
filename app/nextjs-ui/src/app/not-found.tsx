import Link from "next/link";

export const metadata = { title: "Page not found" };

// Tell people the link is wrong instead of silently dropping them on Home.
export default function NotFound() {
  return (
    <main className="page" id="main-content">
      <div className="card form-card">
        <h1 className="h1">Page not found</h1>
        <p className="lead">That link doesn&apos;t go anywhere. It may be mistyped, or the page may have moved.</p>
        <Link href="/" className="btn btn--primary btn--auto">Back to Home</Link>
      </div>
    </main>
  );
}
