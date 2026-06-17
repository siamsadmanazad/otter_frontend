// delete tribe prompt

import { Button } from "@/components/ui/button";
import { useTribeAPI } from "@/lib/requests";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function DeleteTribePrompt({ tribeSerial, closeButton }: any) {
  const queryClient = useQueryClient();
  const { mutate: deleteTribe, isPending: isDeletingTribe } = useMutation({
    mutationFn: async (serial: string) => {
      const response = await useTribeAPI.deleteTribe(serial);
      if (response.status !== 200) {
        throw new Error(response.message || "Failed to delete tribe.");
      }
      return response;
    },
    onSuccess: () => {
      // Invalidate and refetch if you want to update some other queries after a successful deletion
      queryClient.invalidateQueries({ queryKey: ["tribes"] });
      // You might also want to close the prompt here after success
      // closeButton(); 
    },
    onError: (error) => {
      console.error("Error deleting tribe:", error);
    }
  });

  const onDelete = () => {
    deleteTribe(tribeSerial);
  };

  return (
    <div className="flex flex-col">
      <h2 className="text-lg font-bold mb-4">
        Are you sure you want to delete this tribe?
      </h2>
      <p className="text-md mb-4">
        This action will remove all the posts and members associated with your
        tribe.
      </p>
      <div className="flex flex-row justify-end gap-2">
        <Button
          variant="destructive"
          onClick={onDelete}
          disabled={isDeletingTribe}
        >
          {isDeletingTribe ? "Deleting..." : "Delete"}
        </Button>
        {closeButton}
      </div>
    </div>
  );
}
