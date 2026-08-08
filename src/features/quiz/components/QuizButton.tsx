"use client";

import { BrainIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { QuizModal } from "./QuizModal";

type QuizButtonProps = {
  noteId: string;
  noteTitle: string;
};

export function QuizButton({ noteId, noteTitle }: QuizButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <BrainIcon data-icon="inline-start" className="size-4" />
        퀴즈 풀기
      </Button>

      <QuizModal
        noteId={noteId}
        noteTitle={noteTitle}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
