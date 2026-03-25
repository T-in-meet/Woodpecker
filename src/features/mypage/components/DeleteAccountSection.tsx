"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { DeleteAccountDialog } from "./DeleteAccountDialog";

type DeleteAccountSectionProps = {
  userEmail: string;
};

export function DeleteAccountSection({ userEmail }: DeleteAccountSectionProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-destructive">계정 삭제</CardTitle>
      </CardHeader>
      <Separator />
      <CardContent>
        <div className="pt-5">
          {/* <h4 className="mb-2 text-sm font-medium">계정 삭제</h4> */}
          <p className="mb-4 text-sm text-muted-foreground">
            계정을 삭제하면 모든 데이터가 영구적으로 삭제됩니다.
          </p>
          <Button
            variant="destructive"
            size="md"
            onClick={() => setShowDeleteDialog(true)}
          >
            계정 삭제
          </Button>
          <DeleteAccountDialog
            open={showDeleteDialog}
            onOpenChange={setShowDeleteDialog}
            userEmail={userEmail}
          />
        </div>
      </CardContent>
    </Card>
  );
}
