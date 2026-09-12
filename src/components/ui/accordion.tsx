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

/* forceMount를 넘기면 닫힌 항목의 답변도 DOM에 남는다(Radix는 기본적으로 닫힌
   content를 언마운트한다). 색인돼야 하는 공개 페이지의 FAQ가 이 경우다.

   다만 forceMount는 마운트만 유지할 뿐 Radix가 붙이던 hidden 속성까지 없애서,
   그대로 두면 닫힌 항목이 펼쳐진 채로 보인다. 그래서 닫힘 상태를 CSS로 감춘다.
   - h-0: 레이아웃에서 자리를 뺀다. 접기 애니메이션이 도는 동안에는 실행 중인
     animation이 이 값을 덮으므로 애니메이션은 그대로 돈다.
   - invisible + transition-[visibility] duration-200: visibility는 전환이 끝나는
     시점에만 hidden으로 바뀌므로, 200ms짜리 accordion-up이 끝난 뒤에 사라진다.
     display:none과 달리 접기 애니메이션을 죽이지 않으면서, 닫힌 답변을 보조기술과
     탭 순서에서는 빼준다.
   forceMount를 쓰지 않는 기존 사용처는 닫히면 언마운트되므로 이 클래스들이
   퇴장 애니메이션 동안에만 걸리고, 동작은 이전과 같다. */
function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      className="overflow-hidden text-sm transition-[visibility] duration-200 data-open:animate-accordion-down data-closed:h-0 data-closed:invisible data-closed:animate-accordion-up"
      {...props}
    >
      <div
        className={cn(
          "pt-0 pb-2.5 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
          className,
        )}
      >
        {children}
      </div>
    </AccordionPrimitive.Content>
  );
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
