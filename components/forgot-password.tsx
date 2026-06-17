"use client";

import { useState } from "react";
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
import { Mail, Camera } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useResetPasswordAPI } from "@/lib/requests";

// Define Zod schema for email input
const emailSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
});

type EmailFormValues = z.infer<typeof emailSchema>;

export function ForgotPasswordPage() {
  const [currentStep, setCurrentStep] = useState(1); // 1 for email, 2 for verification message
  const [isLoading, setIsLoading] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: "",
    },
  });

  const handleEmailSubmit = async (data: EmailFormValues) => {
    setIsLoading(true);
    setUserEmail(data.email);
    // Simulate API call to send verification email
    const response = await useResetPasswordAPI.createEmail({
      email: data.email,
      reason: "PASSWORD_RESET",
    });
    if (response.status === 200) {
      toast.success(`Verification email sent to ${data.email}`);
      setCurrentStep(2);
      setIsLoading(false);
    } else {
      toast.error("Failed to send verification email, try again?");
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
          <p className="text-gray-600 dark:text-gray-300">
            {currentStep === 1
              ? "Enter your email to reset your password"
              : `Verification email sent to ${userEmail}`}
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {currentStep === 1 && (
            <Form {...emailForm}>
              <form
                onSubmit={emailForm.handleSubmit(handleEmailSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={emailForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700 font-medium dark:text-gray-200">
                        Email
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                          <Input
                            {...field}
                            type="email"
                            placeholder="Enter your email"
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
                  {isLoading ? "Sending..." : "Send Reset Link"}
                </Button>
              </form>
            </Form>
          )}

          {currentStep === 2 && (
            <div className="text-center space-y-4">
              <p className="text-lg text-gray-700 dark:text-gray-200">
                We've sent a verification email to **{userEmail}**. Please check
                your inbox (and spam folder) to proceed with resetting your
                password.
              </p>
            </div>
          )}

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
