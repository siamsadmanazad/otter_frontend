"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  MessageSquareText,
  Bug,
  Send,
  CheckCircle,
  XCircle,
  ChevronRight,
  FileText,
  Pencil,
  Calendar,
  Paperclip,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useReviewAPI } from "@/lib/requests";
import { toast } from "sonner";
import { getSanityMedia } from "@/lib/getSanityImage";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface FormData {
  type: "review" | "bug" | null;
  reviewScope: string;
  reviewContent: string;
  bugTitle: string;
  bugDescription: string;
  bugOccurredWhen: string;
  bugMedia: File | null;
}

export const FeedbackFormContainer = () => {
  const { data: session } = useSession();
  const profileId = session?.user?.id ?? "";
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    type: null,
    reviewScope: "",
    reviewContent: "",
    bugTitle: "",
    bugDescription: "",
    bugOccurredWhen: "",
    bugMedia: null,
  });
  const [showThankYou, setShowThankYou] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const createReviewMutation = useMutation({
    mutationFn: async (payload: any) => {
      return useReviewAPI.createReview(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      setShowThankYou(true);
      setCurrentStep(3);
      toast.success("Feedback submitted successfully!");
      setTimeout(() => {
        setIsOpen(false);
      }, 3000);
    },
    onError: (error: any) => {
      console.error("Error submitting feedback:", error);
      setErrorMessage(
        error.message || "Failed to submit feedback. Please try again."
      );
      toast.error(
        error.message || "Failed to submit feedback. Please try again."
      );
    },
    onSettled: () => {
    },
  });

  useEffect(() => {
    if (!isOpen) {
      const timeout = setTimeout(() => {
        setCurrentStep(1);
        setFormData({
          type: null,
          reviewScope: "",
          reviewContent: "",
          bugTitle: "",
          bugDescription: "",
          bugOccurredWhen: "",
          bugMedia: null,
        });
        setShowThankYou(false);
        setErrorMessage(null);
      }, 150);
      return () => clearTimeout(timeout);
    }
  }, [isOpen]);

  const handleTypeSelect = (type: "review" | "bug") => {
    setFormData((prev) => ({ ...prev, type }));
    setCurrentStep(2);
    setErrorMessage(null);
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData((prev) => ({ ...prev, bugMedia: e.target.files![0] }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!profileId) {
      setErrorMessage(
        "User not authenticated. Please log in to submit feedback."
      );
      return;
    }

    let payload: any = {
      user: profileId,
      media: [],
    };

    if (formData.type === "review") {
      payload.type = "REVIEW";
      payload.scope = formData.reviewScope;
      payload.review = formData.reviewContent;
    } else if (formData.type === "bug") {
      payload.type = "BUG_REPORT";
      payload.scope = "OTHER";
      payload.title = formData.bugTitle;
      payload.description = `${formData.bugDescription}\n\nOccurred When: ${formData.bugOccurredWhen}`;

      if (formData.bugMedia) {
        setIsUploadingMedia(true);
        try {
          const formDataForUpload = new FormData();
          formDataForUpload.append("file", formData.bugMedia);

          const res = await fetch("/api/media", {
            method: "POST",
            body: formDataForUpload,
          });

          if (!res.ok) {
            const dataRes = await res.json();
            throw new Error(dataRes.error || "Failed to upload media");
          }

          const result = await res.json();
          const mediaLink = await getSanityMedia(result.mediaId);
          payload.media.push({ url: mediaLink.data.url });
          toast.success("Media uploaded successfully!");
        } catch (uploadError: any) {
          console.error("Error uploading media:", uploadError);
          setErrorMessage(
            uploadError.message || "Failed to upload media. Please try again."
          );
          setIsUploadingMedia(false);
          return;
        } finally {
          setIsUploadingMedia(false);
        }
      }
    }

    createReviewMutation.mutate(payload);
  };

  const reviewScopes = [
    "FEED",
    "CHAT",
    "SEARCH",
    "PROFILE",
    "USER_INTERFACE",
    "USER_EXPERIENCE",
    "AI",
    "PERFORMANCE",
    "CONTENT",
    "OTHER",
  ];

  const isSubmitting = createReviewMutation.isPending || isUploadingMedia;

  if(session?.user) {
    return (
      <DropdownMenu onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <button
            className="fixed bottom-16 md:bottom-4 right-4 p-4 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 transition-all duration-300 ease-in-out z-50 transform hover:scale-105 dark:bg-blue-700 dark:hover:bg-blue-800 dark:focus:ring-blue-800"
            aria-label="Open feedback form"
          >
            {formData.type === "bug" ? (
              <Bug className="h-6 w-6" />
            ) : (
              <MessageSquareText className="h-6 w-6" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          align="end"
          className="w-80 md:w-96 p-0 shadow-xl rounded-lg overflow-hidden bg-white z-50 dark:bg-gray-800 dark:border-gray-700"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {showThankYou ? (
            <div className="flex flex-col items-center justify-center p-6 text-center dark:text-gray-100">
              <CheckCircle className="h-12 w-12 text-green-500 mb-4 animate-bounce" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2 dark:text-gray-100">
                Thank You!
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Your feedback is valuable and helps us improve.
              </p>
            </div>
          ) : (
            <>
              <DropdownMenuLabel className="flex justify-between items-center p-4 bg-gray-50 border-b border-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                  {currentStep === 1
                    ? "What would you like to submit?"
                    : formData.type === "review"
                    ? "Submit a Review"
                    : "Report a Bug"}
                </h3>
                {currentStep > 1 && (
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="p-1 rounded-full hover:bg-gray-200 text-gray-500 transition-colors duration-200 dark:hover:bg-gray-600 dark:text-gray-300"
                    aria-label="Go back"
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="dark:bg-gray-700" />

              {errorMessage && (
                <div className="p-4 text-sm text-red-700 bg-red-100 border border-red-200 rounded-md mx-4 my-2 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300">
                  {errorMessage}
                </div>
              )}

              <DropdownMenuGroup className="p-4">
                {currentStep === 1 && (
                  <div className="flex flex-col space-y-3">
                    <DropdownMenuItem
                      className="p-3 cursor-pointer flex items-center justify-between hover:bg-blue-50 rounded-md transition-colors dark:hover:bg-blue-900/20 dark:text-gray-100"
                      onClick={() => handleTypeSelect("review")}
                      onSelect={(e) => e.preventDefault()}
                    >
                      <div className="flex items-center">
                        <MessageSquareText className="h-5 w-5 mr-3 text-blue-600 dark:text-blue-400" />
                        <span className="text-base text-gray-800 dark:text-gray-100">Review</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="p-3 cursor-pointer flex items-center justify-between hover:bg-red-50 rounded-md transition-colors dark:hover:bg-red-900/20 dark:text-gray-100"
                      onClick={() => handleTypeSelect("bug")}
                      onSelect={(e) => e.preventDefault()}
                    >
                      <div className="flex items-center">
                        <Bug className="h-5 w-5 mr-3 text-red-600 dark:text-red-400" />
                        <span className="text-base text-gray-800 dark:text-gray-100">
                          Bug Report
                        </span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    </DropdownMenuItem>
                  </div>
                )}

                {currentStep === 2 && formData.type === "review" && (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label
                        htmlFor="reviewScope"
                        className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-200"
                      >
                        <FileText className="inline-block h-4 w-4 mr-1 text-gray-500 dark:text-gray-400" />
                        Scope
                      </label>
                      <select
                        id="reviewScope"
                        name="reviewScope"
                        value={formData.reviewScope}
                        onChange={handleInputChange}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                        required
                      >
                        <option value="" className="dark:bg-gray-700">Select a scope</option>
                        {reviewScopes.map((scope) => (
                          <option key={scope} value={scope} className="dark:bg-gray-700">
                            {scope}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor="reviewContent"
                        className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-200"
                      >
                        <Pencil className="inline-block h-4 w-4 mr-1 text-gray-500 dark:text-gray-400" />
                        Your Review
                      </label>
                      <textarea
                        id="reviewContent"
                        name="reviewContent"
                        rows={4}
                        value={formData.reviewContent}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm resize-y dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
                        placeholder="Share your thoughts..."
                        required
                      ></textarea>
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-700 dark:hover:bg-blue-800 dark:focus:ring-blue-800"
                    >
                      {isSubmitting
                        ? "Submitting..."
                        : "Submit Review"}
                      <Send className="h-4 w-4 ml-2" />
                    </button>
                  </form>
                )}

                {currentStep === 2 && formData.type === "bug" && (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label
                        htmlFor="bugTitle"
                        className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-200"
                      >
                        <Pencil className="inline-block h-4 w-4 mr-1 text-gray-500 dark:text-gray-400" />
                        Title
                      </label>
                      <input
                        type="text"
                        id="bugTitle"
                        name="bugTitle"
                        value={formData.bugTitle}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
                        placeholder="Short summary of the bug"
                        required
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="bugDescription"
                        className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-200"
                      >
                        <FileText className="inline-block h-4 w-4 mr-1 text-gray-500 dark:text-gray-400" />
                        Description
                      </label>
                      <textarea
                        id="bugDescription"
                        name="bugDescription"
                        rows={4}
                        value={formData.bugDescription}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm resize-y dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
                        placeholder="Detailed explanation of the bug"
                        required
                      ></textarea>
                    </div>
                    <div>
                      <label
                        htmlFor="bugOccurredWhen"
                        className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-200"
                      >
                        <Calendar className="inline-block h-4 w-4 mr-1 text-gray-500 dark:text-gray-400" />
                        When did it occur?
                      </label>
                      <input
                        type="text"
                        id="bugOccurredWhen"
                        name="bugOccurredWhen"
                        value={formData.bugOccurredWhen}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
                        placeholder="e.g., Yesterday afternoon, Every time I log in"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="bugMedia"
                        className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-200"
                      >
                        <Paperclip className="inline-block h-4 w-4 mr-1 text-gray-500 dark:text-gray-400" />
                        Media (Optional)
                      </label>
                      <input
                        type="file"
                        id="bugMedia"
                        name="bugMedia"
                        accept="image/*,video/*"
                        onChange={handleFileChange}
                        ref={fileInputRef}
                        className="mt-1 block w-full text-sm text-gray-500 dark:text-gray-300
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-full file:border-0
                        file:text-sm file:font-semibold
                        file:bg-blue-50 file:text-blue-700
                        hover:file:bg-blue-100
                        dark:file:bg-blue-800/30 dark:file:text-blue-300
                        dark:hover:file:bg-blue-800/50"
                      />
                      {formData.bugMedia && (
                        <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">
                          Selected file: {formData.bugMedia.name}
                        </p>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-red-700 dark:hover:bg-red-800 dark:focus:ring-red-800"
                    >
                      {isSubmitting
                        ? "Submitting..."
                        : "Submit Bug Report"}
                      <Send className="h-4 w-4 ml-2" />
                    </button>
                  </form>
                )}
              </DropdownMenuGroup>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  } else return <></>;
};
