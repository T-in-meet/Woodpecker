import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils/formatDate";

import type { OperationalErrorStatusHistoryItem } from "../types/operational-error-list";
import { OperationalErrorStatusBadge } from "./OperationalErrorStatusBadge";

type AdminOperationalErrorHistoryCardProps = {
  /** 운영 오류의 상태 변경 이력 */
  history: OperationalErrorStatusHistoryItem[];
};

/**
 * 운영 오류의 상태 변경 이력을 표시합니다.
 *
 * 처리 이력이 없으면 빈 상태 안내를 표시합니다.
 */
export function AdminOperationalErrorHistoryCard({
  history,
}: AdminOperationalErrorHistoryCardProps) {
  return (
    <Card>
      <CardContent className="pt-2">
        <Accordion type="multiple" className="divide-y">
          <AccordionItem value="history" className="border-b-0">
            <AccordionTrigger className="cursor-pointer py-4 text-base">
              처리 이력
            </AccordionTrigger>

            <AccordionContent>
              {history.length > 0 ? (
                <OperationalErrorHistoryList history={history} />
              ) : (
                <p className="rounded-md border px-3 py-4 text-sm text-muted-foreground">
                  아직 처리 이력이 없습니다.
                </p>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}

function OperationalErrorHistoryList({
  history,
}: {
  history: OperationalErrorStatusHistoryItem[];
}) {
  return (
    <ol className="space-y-3">
      {history.map((item) => (
        <li key={item.id} className="rounded-md border px-3 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {item.fromStatus ? (
              <>
                <OperationalErrorStatusBadge status={item.fromStatus} />

                <span className="text-xs text-muted-foreground">→</span>
              </>
            ) : null}

            <OperationalErrorStatusBadge status={item.toStatus} />
          </div>

          <div className="mt-2 text-xs text-muted-foreground">
            {formatDateTime(item.createdAt)}
            {item.changedByLabel ? ` / ${item.changedByLabel}` : ""}
          </div>

          {item.note ? (
            <p className="mt-2 whitespace-pre-wrap text-sm">{item.note}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
