/** Consistent page title block: title, optional description and right-aligned actions. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="rise-in mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 space-y-1">
        <h1 className="text-[1.625rem] font-semibold leading-tight tracking-tight text-slate-900 sm:text-[1.875rem]">{title}</h1>
        {description && <p className="max-w-3xl text-[0.9375rem] text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Section title used between blocks on a page. */
export function SectionTitle({ children, id, aside }: { children: React.ReactNode; id?: string; aside?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 id={id} className="text-lg font-semibold tracking-tight text-slate-900">{children}</h2>
      {aside}
    </div>
  );
}
