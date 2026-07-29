import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";

type AdminOperationalErrorContextCardProps = {
  /** 오류 발생 시 함께 저장된 진단 정보 */
  context: unknown;
};

/**
 * 운영 오류 발생 시 수집된 진단 정보를 JSON 형태로 표시합니다.
 */
export function AdminOperationalErrorContextCard({
  context,
}: AdminOperationalErrorContextCardProps) {
  return (
    <Card>
      <CardContent className="pt-2">
        <Accordion type="multiple" className="divide-y">
          <AccordionItem value="context" className="border-b-0">
            <AccordionTrigger className="cursor-pointer py-4 text-base">
              진단 정보
            </AccordionTrigger>

            <AccordionContent>
              <pre className="max-h-128 overflow-auto rounded-md bg-muted p-4 text-xs">
                {JSON.stringify(context, null, 2)}
              </pre>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
