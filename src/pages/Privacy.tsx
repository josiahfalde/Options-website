import { Lock } from "lucide-react";
import { Card } from "../components/ui";
import { BRAND } from "../brand";
import { DISCLAIMER_EFFECTIVE, PRIVACY_SECTIONS } from "../content/legal";

export default function Privacy() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-flux-500/10 ring-1 ring-flux-500/25">
          <Lock className="text-flux-400" size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100">Privacy Policy</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            What {BRAND.name} collects and the control you have over it.
          </p>
        </div>
      </div>

      <Card>
        <div className="space-y-6">
          {PRIVACY_SECTIONS.map((s) => (
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
