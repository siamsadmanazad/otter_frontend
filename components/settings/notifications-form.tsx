"use client";
import React, { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useSettingsApi } from "@/lib/requests";
import {
  DEFAULT_PREFERENCES,
  type NotificationPrefs,
} from "@/lib/preferences";
import { SettingsShell, SettingsSkeleton } from "./settings-shell";

const ROWS: { key: keyof NotificationPrefs; label: string; hint: string }[] = [
  { key: "likes", label: "Likes", hint: "When someone likes your post" },
  { key: "comments", label: "Comments", hint: "When someone comments on your post" },
  { key: "follows", label: "New followers", hint: "When someone follows you" },
  { key: "messages", label: "Messages", hint: "When you receive a direct message" },
  { key: "mentions", label: "Mentions", hint: "When someone mentions you" },
  { key: "email", label: "Email notifications", hint: "Also send important updates by email" },
];

export default function NotificationsForm() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(
    DEFAULT_PREFERENCES.notifications
  );

  const { data, isLoading } = useQuery({
    queryKey: ["preferences"],
    queryFn: async () => {
      const res: any = await useSettingsApi.getPreferences();
      return res?.data;
    },
  });

  useEffect(() => {
    if (data?.preferences?.notifications)
      setPrefs(data.preferences.notifications);
  }, [data]);

  const save = useMutation({
    mutationFn: () => useSettingsApi.updatePreferences({ notifications: prefs }),
    onSuccess: () => toast.success("Notification preferences saved."),
    onError: (e: any) => toast.error(e?.message || "Failed to save."),
  });

  return (
    <SettingsShell
      title="Notifications"
      description="Control how you receive notifications."
    >
      {isLoading ? (
        <SettingsSkeleton />
      ) : (
        <>
          {ROWS.map((row) => (
            <div key={row.key} className="flex items-center justify-between">
              <div>
                <Label className="dark:text-gray-100">{row.label}</Label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {row.hint}
                </p>
              </div>
              <Switch
                checked={prefs[row.key]}
                onCheckedChange={(v) =>
                  setPrefs((p) => ({ ...p, [row.key]: v }))
                }
              />
            </div>
          ))}
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving..." : "Save changes"}
          </Button>
        </>
      )}
    </SettingsShell>
  );
}
