"use client";
import React, { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useSettingsApi } from "@/lib/requests";
import { DEFAULT_PREFERENCES, type PrivacyPrefs } from "@/lib/preferences";
import { SettingsShell, SettingsSkeleton } from "./settings-shell";

export default function PrivacyForm() {
  const [prefs, setPrefs] = useState<PrivacyPrefs>(DEFAULT_PREFERENCES.privacy);

  const { data, isLoading } = useQuery({
    queryKey: ["preferences"],
    queryFn: async () => {
      const res: any = await useSettingsApi.getPreferences();
      return res?.data;
    },
  });

  useEffect(() => {
    if (data?.preferences?.privacy) setPrefs(data.preferences.privacy);
  }, [data]);

  const save = useMutation({
    mutationFn: () => useSettingsApi.updatePreferences({ privacy: prefs }),
    onSuccess: () => toast.success("Privacy preferences saved."),
    onError: (e: any) => toast.error(e?.message || "Failed to save."),
  });

  return (
    <SettingsShell
      title="Privacy"
      description="Manage your privacy and who can reach you."
    >
      {isLoading ? (
        <SettingsSkeleton />
      ) : (
        <>
          <div className="space-y-2">
            <Label className="dark:text-gray-100">Profile visibility</Label>
            <Select
              value={prefs.profileVisibility}
              onValueChange={(v) =>
                setPrefs((p) => ({ ...p, profileVisibility: v as any }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PUBLIC">Public — anyone</SelectItem>
                <SelectItem value="FOLLOWERS">Followers only</SelectItem>
                <SelectItem value="PRIVATE">Private — only you</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="dark:text-gray-100">Who can message you</Label>
            <Select
              value={prefs.whoCanMessage}
              onValueChange={(v) =>
                setPrefs((p) => ({ ...p, whoCanMessage: v as any }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EVERYONE">Everyone</SelectItem>
                <SelectItem value="FOLLOWERS">People you follow</SelectItem>
                <SelectItem value="NONE">No one</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="dark:text-gray-100">Show activity</Label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Let others see your recent activity.
              </p>
            </div>
            <Switch
              checked={prefs.showActivity}
              onCheckedChange={(v) =>
                setPrefs((p) => ({ ...p, showActivity: v }))
              }
            />
          </div>

          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving..." : "Save changes"}
          </Button>
        </>
      )}
    </SettingsShell>
  );
}
