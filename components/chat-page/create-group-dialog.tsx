"use client";
import React, { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IUser } from "@/types/chat.d";

interface CreateGroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onlineUsers: IUser[];
  onCreateGroup: (groupName: string, memberIds: string[]) => void;
  currentUserId: string | undefined;
}

export function CreateGroupDialog({
  isOpen,
  onClose,
  onlineUsers,
  onCreateGroup,
  currentUserId,
}: CreateGroupDialogProps) {
  const [groupName, setGroupName] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selectableUsers = onlineUsers.filter(
    (user) => user.id !== currentUserId
  );

  const filteredUsers = selectableUsers.filter((user) =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleMemberSelectionChange = useCallback(
    (userId: string, isChecked: boolean) => {
      setSelectedMemberIds((prev) => {
        if (isChecked) {
          return [...prev, userId];
        } else {
          return prev.filter((id) => id !== userId);
        }
      });
    },
    []
  );

  const handleSubmit = useCallback(() => {
    if (!groupName.trim()) {
      setError("Group name cannot be empty.");
      return;
    }
    if (selectedMemberIds.length === 0) {
      setError("Please select at least one member for the group.");
      return;
    }

    setError(null);
    onCreateGroup(groupName.trim(), selectedMemberIds);
    setGroupName("");
    setSelectedMemberIds([]);
    setSearchTerm("");
    onClose();
  }, [groupName, selectedMemberIds, onCreateGroup, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Group</DialogTitle>
          <DialogDescription>
            Enter group name and select members.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="groupName" className="text-right">
              Group Name
            </Label>
            <Input
              id="groupName"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="col-span-3"
              placeholder="e.g., Team Alpha, Family Chat"
            />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            {" "}
            {/* Changed to items-start for better alignment */}
            <Label htmlFor="members" className="text-right pt-2">
              {" "}
              {/* Added pt-2 for label alignment */}
              Members
            </Label>
            <div className="col-span-3">
              <Input
                placeholder="Search members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="mb-2"
              />
              <ScrollArea className="h-40 w-full rounded-md border p-2">
                {filteredUsers.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No users found or online.
                  </p>
                ) : (
                  filteredUsers.map((user, index:number) => (
                    <div
                      key={index}
                      className="flex items-center space-x-2 py-1"
                    >
                      <Checkbox
                        id={`user-${user.id}`}
                        checked={selectedMemberIds.includes(user.id)}
                        onCheckedChange={(checked: boolean) =>
                          handleMemberSelectionChange(user.id, checked)
                        }
                      />
                      <Label htmlFor={`user-${user.id}`}>{user.username}</Label>
                    </div>
                  ))
                )}
              </ScrollArea>
            </div>
          </div>
          {error && (
            <p className="text-red-500 text-sm col-span-4 text-center">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Create Group</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
