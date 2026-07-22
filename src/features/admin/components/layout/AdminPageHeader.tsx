import type { ReactNode } from "react";

interface Props {
  title: string;

  description?: string;

  actions?: ReactNode;
}

export function AdminPageHeader({ title, description, actions }: Props) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between -mx-6 border-b px-6 pb-6 md:mx-0 md:px-0">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>

        {description ? (
          <p className="mt-2 text-muted-foreground">{description}</p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
