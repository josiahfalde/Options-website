import { BRAND } from "../brand";

// ============================================================================
// Legal copy — single source of truth so the footer, disclaimer page, and the
// signup acknowledgment all stay consistent. This is NOT legal advice and is a
// reasonable default for an informational options-analytics tool; have it
// reviewed before relying on it for a real public launch.
// ============================================================================

export const DISCLAIMER_EFFECTIVE = "June 13, 2026";

/** One-liner for the footer / signup acknowledgment. */
export const DISCLAIMER_SHORT =
  `${BRAND.name} is for informational and educational purposes only and is not ` +
  `financial, investment, or tax advice.`;

export interface LegalSection {
  heading: string;
  body: string;
}

export const DISCLAIMER_SECTIONS: LegalSection[] = [
  {
    heading: "Not financial advice",
    body:
      `${BRAND.name} provides analytics and visualizations of options-trading ` +
      `activity for informational and educational purposes only. Nothing in this ` +
      `application is, or should be construed as, financial, investment, tax, ` +
      `legal, or accounting advice, or a recommendation, solicitation, or offer to ` +
      `buy or sell any security, option, or other financial instrument. Using ` +
      `${BRAND.name} does not create an advisory, brokerage, or fiduciary ` +
      `relationship of any kind.`,
  },
  {
    heading: "Options trading involves substantial risk",
    body:
      "Trading options carries a high level of risk and is not suitable for every " +
      "investor. You can lose some or all of your investment, and certain " +
      "strategies (including selling uncovered options) can expose you to losses " +
      "that substantially exceed your initial outlay. Only trade with capital you " +
      "can afford to lose, and read the standardized options disclosure document, " +
      '"Characteristics and Risks of Standardized Options," before trading.',
  },
  {
    heading: "No guarantee of accuracy",
    body:
      `${BRAND.name}'s figures are computed from data you provide or import (for ` +
      `example, broker CSVs or your spreadsheet) and from any prices you enter. ` +
      `That data may be incomplete, delayed, or incorrect, and the resulting ` +
      `calculations may contain errors. You are responsible for independently ` +
      `verifying anything before acting on it. The demo data shown to ` +
      `logged-out visitors is anonymized sample data and does not represent real ` +
      `performance.`,
  },
  {
    heading: "Past and hypothetical performance",
    body:
      "Past performance is not indicative of future results. Any historical, " +
      "simulated, or hypothetical figures shown do not guarantee future returns, " +
      "and your actual results will differ.",
  },
  {
    heading: "Consult a professional",
    body:
      "Before making any investment decision, consult a licensed financial " +
      "advisor, broker, or tax professional who understands your specific " +
      "situation. You are solely responsible for your own trading and investment " +
      "decisions and their outcomes.",
  },
  {
    heading: "No warranty",
    body:
      `${BRAND.name} is provided "as is," without warranties of any kind, express ` +
      `or implied. To the fullest extent permitted by law, ${BRAND.name} and its ` +
      `creators disclaim all liability for any loss or damage arising from your ` +
      `use of, or reliance on, the application or its calculations.`,
  },
];

/** Contact address shown in the legal pages — single-sourced so it's easy to change. */
export const LEGAL_CONTACT = "josiahfalde@gmail.com";

// ---- Terms of Service ------------------------------------------------------
export const TOS_SECTIONS: LegalSection[] = [
  {
    heading: "1. Acceptance of these terms",
    body:
      `By accessing or using ${BRAND.name} (the "Service"), you agree to be bound ` +
      `by these Terms of Service. If you do not agree, do not use the Service.`,
  },
  {
    heading: "2. What the Service is",
    body:
      `${BRAND.name} is a tool that organizes and visualizes options-trading ` +
      `activity you provide or import, and computes analytics from it. It is for ` +
      `informational and educational purposes only and is NOT financial, ` +
      `investment, or tax advice and not a recommendation to trade — see the ` +
      `Disclaimer, which is incorporated into these Terms.`,
  },
  {
    heading: "3. Your account",
    body:
      "You must be at least 18 years old to create an account. You are responsible " +
      "for the accuracy of the information you provide, for keeping your login " +
      "credentials secure, and for all activity that occurs under your account. " +
      "Notify us promptly of any unauthorized use.",
  },
  {
    heading: "4. Acceptable use",
    body:
      "You agree not to misuse the Service: no unlawful use, no attempts to breach " +
      "security or access other users' data, no scraping or automated bulk access, " +
      "no reverse engineering, and no interfering with the Service's operation or " +
      "other users' use of it.",
  },
  {
    heading: "5. Your data",
    body:
      `The trade data, notes, and settings you enter remain yours. You grant ` +
      `${BRAND.name} the limited permission needed to store and process that data ` +
      `solely to provide the Service to you. You are responsible for the accuracy ` +
      `of what you enter and for independently verifying any output before relying ` +
      `on it. You can export or delete your data at any time from your Account.`,
  },
  {
    heading: "6. No warranty & limitation of liability",
    body:
      `The Service is provided "as is," without warranties of any kind. To the ` +
      `fullest extent permitted by law, ${BRAND.name} and its creators are not ` +
      `liable for any indirect, incidental, or consequential damages, or for any ` +
      `trading or investment losses, arising from your use of or reliance on the ` +
      `Service.`,
  },
  {
    heading: "7. Changes & termination",
    body:
      "We may modify or discontinue the Service or these Terms at any time; " +
      "material changes will be reflected by an updated effective date, and " +
      "continued use means you accept the revised Terms. You may stop using the " +
      "Service at any time, and we may suspend or terminate accounts that violate " +
      "these Terms.",
  },
  {
    heading: "8. Governing law",
    body:
      "These Terms are governed by the laws of the United States and the state in " +
      "which the operator resides, without regard to conflict-of-law principles.",
  },
  {
    heading: "9. Contact",
    body: `Questions about these Terms? Contact ${LEGAL_CONTACT}.`,
  },
];

// ---- Privacy Policy --------------------------------------------------------
export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    heading: "Overview",
    body:
      `This policy explains what ${BRAND.name} collects, how it's used, and the ` +
      `control you have over it. ${BRAND.name} is built to be privacy-respecting: ` +
      `your data exists to power your own analytics, and it is never sold.`,
  },
  {
    heading: "What we collect",
    body:
      "Account information (your email, and — if you sign in with Google — the " +
      "name and email Google shares); the trading data you enter or import (trades, " +
      "prices, settings, and journal notes); and minimal technical data needed to " +
      "operate and secure the Service. Logged-out visitors use anonymized demo " +
      "data and create no account.",
  },
  {
    heading: "How we use it",
    body:
      "Solely to provide the Service: to authenticate you, store your data, compute " +
      "your analytics, and keep your account secure. We do not use your trading " +
      "data for advertising, and we do not sell it.",
  },
  {
    heading: "Where it's stored",
    body:
      "Your data is stored in a Postgres database hosted by Supabase (United " +
      "States) and the app is served via Vercel. Row-Level Security isolates your " +
      "data so it is only accessible to your authenticated account.",
  },
  {
    heading: "Cookies & local storage",
    body:
      "We use your browser's local storage and a first-party cookie to keep you " +
      "signed in and to complete the secure sign-in handshake. We do not use " +
      "third-party advertising or tracking cookies.",
  },
  {
    heading: "Service providers",
    body:
      "We rely on a small set of processors strictly to run the Service: Supabase " +
      "(database and authentication), Google (optional OAuth sign-in), and Vercel " +
      "(hosting). If paid plans launch, a payment processor (Stripe) will handle " +
      "billing; we never store your full card details.",
  },
  {
    heading: "Your rights & control",
    body:
      "From your Account page you can export everything we hold for you as a JSON " +
      "file, or delete your stored data. You may also request removal of your " +
      `account by contacting ${LEGAL_CONTACT}.`,
  },
  {
    heading: "Children",
    body: `${BRAND.name} is not intended for anyone under 18, and we do not knowingly collect their data.`,
  },
  {
    heading: "Changes & contact",
    body:
      `We may update this policy; the effective date below reflects the latest ` +
      `version. Questions? Contact ${LEGAL_CONTACT}.`,
  },
];
