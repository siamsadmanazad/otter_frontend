"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { CreateTribeForm } from "./create-tribe.form";

export function CreateTribeModal() {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>Create Your Tribe</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md h-[70vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Your Tribe</DialogTitle>
          <DialogDescription>
            Provide the details of your tribe
          </DialogDescription>
        </DialogHeader>
        <CreateTribeForm
          submitTrigger={setIsOpen}
          closeButton={
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Close
              </Button>
            </DialogClose>
          }
        />
        <DialogFooter className="sm:justify-start">
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
