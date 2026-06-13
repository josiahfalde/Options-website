import { ShieldAlert } from "lucide-react";
import { Card } from "../components/ui";
import { BRAND } from "../brand";
import { DISCLAIMER_EFFECTIVE, DISCLAIMER_SECTIONS } from "../content/legal";

export default function Disclaimer() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-torque-500/10 ring-1 ring-torque-500/25">
          <ShieldAlert className="text-torque-400" size={22} />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100">Disclaimer</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Important information about how to use {BRAND.name}.
          </p>
        </div>
      </div>

      <Card className="mb-4 border-torque-500/25 bg-torque-500/[0.04]">
        <p className="text-sm font-medium leading-relaxed text-torque-200">
          {BRAND.name} is for informational and educational purposes only. It is{" "}
          <span className="font-bold">not financial, investment, or tax advice</span>, and it is
          not a recommendation to buy or sell any security or option.
        </p>
      </Card>

      <Card>
        <div className="space-y-6">
          {DISCLAIMER_SECTIONS.map((s) => (
            <section key={s.heading}>
              <h2 className="text-sm font-bold tracking-tight text-slate-100">{s.heading}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{s.body}</p>
            </section>
          ))}
        </div>
        <p className="mt-6 border-t border-white/5 pt-4 text-xs text-slate-500">
          Effective {DISCLAIMER_EFFECTIVE}.
        </p>
      </Card>
    </div>
  );
}
