"use client";

import Link from "next/link";
import AuthLayout from "../components/AuthLayout";
import { POLICY_UPDATED, PrivacyPolicy, TermsOfUse } from "../content/policies";

export default function LegalPage({ doc }: { doc: "terms" | "privacy" }) {
  return (
    <AuthLayout wide title={doc === "terms" ? "Terms of Use" : "Privacy Policy"} lead={`Last updated ${POLICY_UPDATED}`}>
      <div className="policy__body policy__body--page">{doc === "terms" ? <TermsOfUse /> : <PrivacyPolicy />}</div>
      <p className="login__foot"><Link className="link" href="/signup">Back to sign up</Link></p>
    </AuthLayout>
  );
}