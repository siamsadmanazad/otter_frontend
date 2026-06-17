"use client";

import { useTribeAPI } from "@/lib/requests";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "../ui/button";
import { useSession } from "next-auth/react";
import { LoadingSmall } from "../ui/loading";
import { useTribeStore } from "./tribe.hooks";
import { useEffect } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ModifyTribeModal } from "./modify-tribe/modify-tribe-modal";

export function TribeMemberButton({ tribeId }: { tribeId: string }) {
  const { data: session } = useSession();
  const { setIsTribeAdmin, setIsTribeMember } = useTribeStore();
  const currentLoggedInUser = session?.user;

  const joinTribeMutation = useMutation({
    mutationFn: async (data: { tribeId: string; userId: string }) => {
      return useTribeAPI.joinTribe(data.tribeId, data.userId);
    },
    onSuccess: (data) => {
      console.log(data);
    },
  });

  const {
    data: isTribeMember,
    isLoading: isLoadingTribeMembership,
    isError,
  } = useQuery({
    queryKey: [`isMember-${tribeId}`],
    queryFn: async () => {
      const response = await useTribeAPI.isTribeMember(
        currentLoggedInUser?.id as string,
        tribeId
      );
      if (response.status !== 200) {
        throw new Error(response.message || "Failed to fetch membership.");
      }
      return response;
    },
    enabled: !!currentLoggedInUser && !!tribeId,
  });

  useEffect(() => {
    if (isTribeMember?.data) {
      const { isAdmin, isMember } = isTribeMember.data;
      setIsTribeAdmin(isAdmin);
      setIsTribeMember(isMember);
    }
  }, [isTribeMember, setIsTribeAdmin, setIsTribeMember]);

  const onJoinTribe = async () => {
    await joinTribeMutation.mutateAsync({
      tribeId,
      userId: session?.user?.id as string,
    });
  };

  if (isLoadingTribeMembership) {
    return <Button><LoadingSmall /></Button>;
  }

  if (!isTribeMember || !isTribeMember.data) {
    return <Button variant="outline">Check Membership</Button>;
  }

  const { isAdmin, isMember } = isTribeMember.data;
  console.log("from member button", isAdmin, isMember);
  
  if (isAdmin) {
    return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button>Edit Tribe</Button>
      </DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuItem onSelect={(e)=> e.preventDefault()}>
        <ModifyTribeModal
          tribeSerial={tribeId}
          type="EDIT"
          editButton= {<Button>Edit your tribe</Button>}
        />
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e)=>e.preventDefault()}>
        <ModifyTribeModal
          tribeSerial={tribeId}
          type="DELETE"
          editButton= {<Button>Delete your tribe</Button>}
        />
      </DropdownMenuItem>
    </DropdownMenuContent>
    </DropdownMenu>
  );
  } else if (isMember) {
    return <Button variant="destructive">Leave Tribe</Button>;
  } else {
    return <Button onClick={onJoinTribe}>Join Tribe</Button>;
  }
}