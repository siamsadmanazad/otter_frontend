"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoadingSmall } from "@/components/ui/loading";
import { createClient } from "@/lib/supabase/browser";

const resetPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, { message: "Password must be at least 8 characters" }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

interface ResetPasswordPageProps {
  id: string;
}

export function ResetPasswordPage({ id }: ResetPasswordPageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    async function loadRecoveryUser() {
      // The recovery email link routes through /auth/callback, which sets a session cookie.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Reset link is invalid or expired. Please request a new one.");
        router.push("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, location, profile_image, email")
        .eq("id", user.id)
        .single();
      setUserData({
        fullName: profile?.full_name ?? "",
        location: profile?.location ?? "",
        image: profile?.profile_image ?? null,
        email: profile?.email ?? user.email,
      });
    }
    loadRecoveryUser();
  }, [router]);

  const resetPasswordForm = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const handleResetPasswordSubmit = async (data: ResetPasswordFormValues) => {
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: data.newPassword,
      });
      if (error) throw error;

      await supabase.auth.signOut();
      toast.success("Password has been reset successfully!");
      router.push("/login");
    } catch (error) {
      console.error("Password reset error:", error);
      toast.error(
        "Unable to reset password. Please try again or request a new link."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0099DB] to-[#00F0E4] dark:from-gray-900 dark:via-gray-800 dark:to-gray-700 p-4">
      <Card className="w-full max-w-md bg-white/95 backdrop-blur-sm shadow-2xl dark:bg-gray-800/95 dark:border-gray-700">
        <CardHeader className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <CardTitle className="text-3xl font-bold tracking-widest bg-gradient-to-br from-[#0099DB] to-[#00F0E4] bg-clip-text text-transparent dark:from-purple-400 dark:to-pink-400">
              Tripotter
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {userData ? (
            <Card className="dark:bg-gray-700 dark:border-gray-600">
              <CardContent>
                <div className="flex flex-row mt-5 p-auto justify-center items-center">
                  <img
                    src={userData?.image ?? "/placeholder.jpg"}
                    height="50"
                    width="50"
                    className="rounded-full"
                  />
                  <div className="flex flex-col justify-center ml-4">
                    <h1 className="text-md font-bold text-gray-900 dark:text-gray-100">
                      {userData?.fullName ?? ""}
                    </h1>
                    <p className="text-gray-500 text-sm dark:text-gray-400">
                      {userData?.location ?? ""}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <LoadingSmall />
          )}
          <Form {...resetPasswordForm}>
            <form
              onSubmit={resetPasswordForm.handleSubmit(
                handleResetPasswordSubmit
              )}
              className="space-y-4"
            >
              <FormField
                control={resetPasswordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 font-medium dark:text-gray-200">
                      New Password
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <Input
                          {...field}
                          type="password"
                          placeholder="Enter your new password"
                          className="pl-10 h-12 border-gray-200 focus:border-purple-500 focus:ring-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400 dark:focus:border-purple-400 dark:focus:ring-purple-400"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={resetPasswordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 font-medium dark:text-gray-200">
                      Confirm New Password
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <Input
                          {...field}
                          type="password"
                          placeholder="Confirm your new password"
                          className="pl-10 h-12 border-gray-200 focus:border-purple-500 focus:ring-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400 dark:focus:border-purple-400 dark:focus:ring-purple-400"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-br from-[#0099DB] to-[#00F0E4] text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200
                dark:from-purple-600 dark:to-pink-600 dark:hover:from-purple-700 dark:hover:to-pink-700"
                disabled={isLoading}
              >
                {isLoading ? "Setting New Password..." : "Set New Password"}
              </Button>
            </form>
          </Form>

          <div className="text-center">
            <Link
              href="/login"
              className="text-[#0099DB] hover:text-purple-700 font-semibold dark:text-purple-400 dark:hover:text-purple-300"
            >
              Back to Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
