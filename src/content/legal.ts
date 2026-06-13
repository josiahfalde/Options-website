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
