"use client";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EditTribeForm } from "./edit-tribe-form";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { DeleteTribePrompt } from "./delete-tribe-form";

interface IModifyTribeModalProps {
  tribeSerial: string;
  type: "EDIT" | "DELETE";
  editButton: React.ReactNode;
}

export function ModifyTribeModal({
  tribeSerial,
  type,
  editButton,
}: IModifyTribeModalProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger>{editButton}</DialogTrigger>
      <DialogContent className="overflow-y-auto max-h-[70vh]">
        <DialogTitle className="hidden"></DialogTitle>
        {type === "EDIT" ? (
          <EditTribeForm
            tribeSerial={tribeSerial}
            submitTrigger={setIsOpen}
            closeButton={<Button onClick={()=>setIsOpen(false)}>Close</Button>}
          />
        ) : (
          <DeleteTribePrompt
          tribeSerial={tribeSerial}
          closeButton={<Button onClick={()=>setIsOpen(false)}>Close</Button>}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
