"use client";

import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { Accordion as AccordionPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils/cn";

function Accordion({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Root>) {
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      className={cn("flex w-full flex-col", className)}
      {...props}
    />
  );
}

function AccordionItem({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("not-last:border-b", className)}
      {...props}
    />
  );
}

function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "group/accordion-trigger relative flex flex-1 cursor-pointer items-start justify-between rounded-lg border border-transparent py-2.5 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:after:border-ring disabled:pointer-events-none disabled:opacity-50 **:data-[slot=accordion-trigger-icon]:ml-auto **:data-[slot=accordion-trigger-icon]:size-4 **:data-[slot=accordion-trigger-icon]:text-muted-foreground",
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDownIcon
          data-slot="accordion-trigger-icon"
          className="pointer-events-none shrink-0 group-aria-expanded/accordion-trigger:hidden"
        />
        <ChevronUpIcon
          data-slot="accordion-trigger-icon"
          className="pointer-events-none hidden shrink-0 group-aria-expanded/accordion-trigger:inline"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

/* 닫힌 항목도 DOM에 남기고(forceMount) 열고 닫는 전환은 안쪽 래퍼가 맡는다.

   - forceMount: Radix는 기본적으로 닫힌 content를 언마운트한다. 색인돼야 하는
     공개 페이지의 FAQ는 닫힌 답변도 HTML에 있어야 하고, 아래 CSS transition은
     Radix Presence가 퇴장 애니메이션으로 감지하지 못해 forceMount 없이는 닫는
     즉시 언마운트돼 전환이 보이지 않는다.
   - 전환을 바깥 Content 노드가 아니라 안쪽 래퍼에 두는 이유: Radix는 열림·닫힘이
     바뀔 때마다 Content 노드에 인라인으로 animation-name: none·
     transition-duration: 0s를 걸고 높이를 잰 뒤 원복한다. Content 노드에 건
     transition·닫힘 상태 클래스는 이 측정 순간에 무력화되거나(visibility가 즉시
     hidden으로 확정) 측정값을 0으로 만들어(다음 열기가 auto로 점프) 전환이
     끊긴다. 안쪽 래퍼는 이 인라인 스타일의 영향을 받지 않는다.
   - grid-rows 0fr↔1fr: 높이를 재지 않고도 auto 높이를 전환할 수 있다.
   - visibility transition: 닫힐 때는 전환이 끝나는 시점에 hidden으로 바뀌어
     접히는 동안 글자가 보이고, 닫힌 뒤에는 보조기술과 탭 순서에서 빠진다. */
function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      forceMount
      className="group/accordion-content text-sm"
      {...props}
    >
      <div className="grid transition-[grid-template-rows,visibility] duration-200 ease-out motion-reduce:transition-none group-data-[state=closed]/accordion-content:invisible group-data-[state=closed]/accordion-content:grid-rows-[0fr] group-data-[state=open]/accordion-content:grid-rows-[1fr]">
        <div className="min-h-0 overflow-hidden">
          <div
            className={cn(
              "pt-0 pb-2.5 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
              className,
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </AccordionPrimitive.Content>
  );
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
