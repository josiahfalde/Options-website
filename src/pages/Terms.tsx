import { FileText } from "lucide-react";
import { Card } from "../components/ui";
import { BRAND } from "../brand";
import { DISCLAIMER_EFFECTIVE, TOS_SECTIONS } from "../content/legal";

export default function Terms() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-flux-500/10 ring-1 ring-flux-500/25">
          <FileText className="text-flux-400" size={22} />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100">Terms of Service</h1>
          <p className="mt-0.5 text-sm text-slate-400">The agreement for using {BRAND.name}.</p>
        </div>
      </div>

      <Card>
        <div className="space-y-6">
          {TOS_SECTIONS.map((s) => (
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
