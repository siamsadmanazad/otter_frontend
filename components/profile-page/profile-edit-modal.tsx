"use client";
import { Button } from "@/components/ui/button";
import {
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect, useRef } from "react";
import { z } from "zod";
import {
  Plus,
  Minus,
  User,
  Mail,
  Lock,
  Text,
  MapPin,
  Link,
  AtSign,
  Check,
  ChevronsUpDown,
  Loader2,
} from "lucide-react";

import { useLocationApi, useUserApi } from "@/lib/requests";

import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  passwordSchema,
  bioSchema,
  locationSchema,
  socialsSchema,
  fullNameSchema,
  usernameSchema,
  emailSchema,
  fullFormSchema,
} from "./profile-edit-validation";

import type {
  BioFormData,
  LocationFormData,
  SocialsFormData,
  FullNameFormData,
  UsernameFormData,
  EmailFormData,
  FullFormData,
} from "./profile-edit-validation";

type ModalType = "LOCATION" | "SOCIALS" | "BIO" | "FULLFORM";

interface ProfileEditFormProps {
  type?: ModalType;
  defaultData?: any;
  onClose?: () => void; // Callback to close the parent modal
}

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "../ui/badge";
import { useSession } from "next-auth/react";
import { Loading } from "../ui/loading";

export function ProfileEditForm({ type, defaultData, onClose }: ProfileEditFormProps) {
  const queryClient = useQueryClient(); // Initialize query client

  const [bioData, setBioData] = useState<BioFormData>({
    bio: defaultData?.bio || "",
  });
  const [locationData, setLocationData] = useState<LocationFormData>({
    location: defaultData?.location || "",
  });
  const [socialsData, setSocialsData] = useState<SocialsFormData>({
    socials:
      defaultData?.socials && defaultData.socials.length > 0
        ? defaultData.socials
        : [{ platform: "", url: "" }],
  });
  const [fullNameData, setFullNameData] = useState<FullNameFormData>({
    fullName: defaultData?.fullName || "",
  });
  const [usernameData, setUsernameData] = useState<UsernameFormData>({
    username: defaultData?.username || "",
  });
  const [emailData, setEmailData] = useState<EmailFormData>({
    email: defaultData?.email || "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // State for location combobox
  const [openLocationCombobox, setOpenLocationCombobox] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [isSearchingLocations, setIsSearchingLocations] = useState(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setBioData({ bio: defaultData?.bio || "" });
    setLocationData({ location: defaultData?.location || "" });
    setSocialsData({
      socials:
        defaultData?.socials && defaultData.socials.length > 0
          ? defaultData.socials
          : [{ platform: "", url: "" }],
    });
    setFullNameData({ fullName: defaultData?.fullName || "" });
    setUsernameData({ username: defaultData?.username || "" });
    setEmailData({ email: defaultData?.email || "" });
  }, [defaultData, type]);

  // Effect for debounced location API call
  useEffect(() => {
    // Clear previous debounce timeout if exists
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Only search if location input is not empty
    if (locationData?.location.trim() !== "") {
      setIsSearchingLocations(true);
      debounceTimeoutRef.current = setTimeout(async () => {
        try {
          // Assuming useLocationApi.getLocations expects a string query
          const response = await useLocationApi.getLocations(
            locationData.location ?? ""
          );
          if (response && response.data) {
            const suggestions = response.data.map((item: any) => item.Location);
            setLocationSuggestions(suggestions);
          } else {
            setLocationSuggestions([]);
          }
        } catch (error) {
          console.error("Error fetching locations:", error);
          setLocationSuggestions([]);
        } finally {
          setIsSearchingLocations(false);
        }
      }, 2000); // 2 seconds debounce
    } else {
      setLocationSuggestions([]); // Clear suggestions if input is empty
      setIsSearchingLocations(false);
    }

    // Cleanup on unmount or dependency change
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [locationData.location]);

  const addSocialInput = () => {
    if (socialsData.socials.length < 5) {
      setSocialsData({
        socials: [...socialsData.socials, { platform: "", url: "" }],
      });
    }
  };

  const removeSocialInput = (index: number) => {
    if (socialsData.socials.length > 1) {
      setSocialsData({
        socials: socialsData.socials.filter((_, i) => i !== index),
      });
    } else if (socialsData.socials.length === 1) {
      setSocialsData({ socials: [{ platform: "", url: "" }] });
    }
  };

  const updateSocialInput = (
    index: number,
    field: "platform" | "url",
    value: string
  ) => {
    const newSocials = [...socialsData.socials];
    newSocials[index] = { ...newSocials[index], [field]: value };
    setSocialsData({ socials: newSocials });
  };

  // TanStack Query Mutation for profile updates
  const profileUpdateMutation = useMutation({
    mutationFn: async (payload: Partial<FullFormData>) => {
      const response = await useUserApi.updateUser(payload);
      if (response.status !== 200) {
        throw new Error(response.message || "Failed to update profile.");
      }
      return response.data;
    },
    onSuccess: (data) => {
      toast.success("Profile updated successfully!");
      // Invalidate the 'user' query for the specific user ID to refetch latest data
      queryClient.invalidateQueries({ queryKey: ["user", defaultData?._id] });
      onClose(); // Close the modal on successful submission
    },
    onError: (error) => {
      console.error("Error updating profile:", error);
      toast.error(error.message || "An error occurred while updating profile.");
    },
    onSettled: () => {
      // Optional: Invalidate again on settled to ensure consistency, though onSuccess already does it
      queryClient.invalidateQueries({ queryKey: ["user", defaultData?._id] });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      let validatedData: any;
      let payload: any;

      switch (type) {
        case "BIO":
          validatedData = bioSchema.parse(bioData);
          payload = { bio: validatedData.bio };
          break;
        case "LOCATION":
          validatedData = locationSchema.parse(locationData);
          payload = { location: validatedData.location };
          break;
        case "SOCIALS":
          const filteredSocials = socialsData.socials.filter(
            (social) =>
              social.platform.trim() !== "" || social.url.trim() !== ""
          );
          validatedData = socialsSchema.parse({ socials: filteredSocials });
          payload = { socials: validatedData.socials };
          break;
        case "FULLFORM":
          const fullFormData: FullFormData = {
            fullName: fullNameData.fullName,
            username: usernameData.username,
            email: emailData.email,
            bio: bioData.bio,
            location: locationData.location,
            socials: socialsData.socials.filter(
              (social) =>
                social.platform.trim() !== "" || social.url.trim() !== ""
            ),
          };
          validatedData = fullFormSchema.parse(fullFormData);
          payload = validatedData;
          break;
        default:
          return; // Should not happen
      }
      // Trigger the mutation
      profileUpdateMutation.mutate(payload);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          const field = err.path.join(".");
          fieldErrors[field] = err.message;
        });
        setErrors(fieldErrors);
      } else {
        console.error("An unexpected error occurred:", error);
        toast.error("An unexpected error occurred. Please try again.");
      }
    }
  };

  const renderBioForm = () => (
    <div className="grid gap-3">
      <Label htmlFor="bio-input" className="flex items-center gap-2 text-lg font-bold">
        <Text className="h-4 w-4" />
        Bio
      </Label>
      <Textarea
        id="bio-input"
        name="bio"
        value={bioData.bio}
        onChange={(e) => setBioData({ bio: e.target.value })}
        placeholder="Tell us about yourself..."
        maxLength={300}
        className="min-h-[100px]"
      />
      <div className="flex justify-between text-sm text-gray-500">
        <span>{bioData.bio?.length || 0}/300 characters</span>
        {errors.bio && <span className="text-red-500">{errors.bio}</span>}
      </div>
    </div>
  );

  const renderLocationForm = () => (
    <div className="grid gap-3">
      <Label htmlFor="location-input" className="flex items-center gap-2 text-lg font-bold">
        <MapPin className="h-4 w-4" />
        Location
      </Label>
      <Popover
        open={openLocationCombobox}
        onOpenChange={setOpenLocationCombobox}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={openLocationCombobox}
            className="w-full justify-between"
          >
            {locationData.location
              ? locationSuggestions.find(
                  (location) => location === locationData.location
                ) || locationData.location
              : "Select location..."}
            {isSearchingLocations ? (
              <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput
              placeholder="Search location..."
              value={locationData.location}
              onValueChange={(value) => {
                setLocationData({ location: value });
              }}
            />
            <CommandList>
              {isSearchingLocations && locationData.location.trim() !== "" ? (
                <CommandEmpty className="flex items-center justify-center p-4">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Searching...
                </CommandEmpty>
              ) : (
                <CommandEmpty>Search for a location</CommandEmpty>
              )}
              <CommandGroup>
                {locationSuggestions.map((location) => (
                  <CommandItem
                    key={location}
                    value={location}
                    onSelect={(currentValue) => {
                      setLocationData({
                        location:
                          currentValue === locationData.location
                            ? ""
                            : currentValue,
                      });
                      setOpenLocationCombobox(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        locationData.location === location
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    {location}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <div className="flex justify-between text-sm text-gray-500">
        <span>{locationData.location?.length || 0}/30 characters</span>
        {errors.location && (
          <span className="text-red-500">{errors.location}</span>
        )}
      </div>
    </div>
  );

  const renderSocialsForm = () => (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2 text-lg font-bold">
          <Link className="h-4 w-4" />
          Social Links
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addSocialInput}
          disabled={socialsData.socials.length >= 5}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>
      {socialsData.socials.map((social, index) => (
        <div key={index} className="flex flex-col gap-2 p-2 border rounded-md">
          <div className="grid gap-1">
            <Label
              htmlFor={`platform-${index}`}
              className="flex items-center gap-2 text-lg font-bold"
            >
              Platform
            </Label>
            <Input
              id={`platform-${index}`}
              value={social.platform}
              onChange={(e) =>
                updateSocialInput(index, "platform", e.target.value)
              }
              placeholder="e.g., Twitter, LinkedIn"
            />
            {errors[`socials.${index}.platform`] && (
              <span className="text-red-500 text-sm">
                {errors[`socials.${index}.platform`]}
              </span>
            )}
          </div>
          <div className="grid gap-1">
            <Label htmlFor={`url-${index}`} className="flex items-center gap-2 text-lg font-bold">
              URL
            </Label>
            <Input
              id={`url-${index}`}
              value={social.url}
              onChange={(e) => updateSocialInput(index, "url", e.target.value)}
              placeholder="https://..."
            />
            {errors[`socials.${index}.url`] && (
              <span className="text-red-500 text-sm">
                {errors[`socials.${index}.url`]}
              </span>
            )}
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeSocialInput(index)}
              disabled={
                socialsData.socials.length === 1 &&
                social.platform === "" &&
                social.url === ""
              }
            >
              <Minus className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        </div>
      ))}
      {errors.socials && (
        <span className="text-red-500 text-sm">{errors.socials}</span>
      )}
    </div>
  );

  const renderFullFormContent = () => (
    <>
      <div className="grid gap-3">
        <Label htmlFor="full-name-input" className="flex items-center gap-2 text-lg font-bold">
          <User className="h-4 w-4" />
          Full Name
        </Label>
        <Input
          id="full-name-input"
          name="fullName"
          value={fullNameData.fullName}
          onChange={(e) => setFullNameData({ fullName: e.target.value })}
          placeholder="Your full name"
        />
        {errors.fullName && (
          <span className="text-red-500 text-sm">{errors.fullName}</span>
        )}
      </div>

      <div className="grid gap-3">
        <Label htmlFor="username-input" className="flex items-center gap-2 text-lg font-bold">
          <AtSign className="h-4 w-4" />
          Username
        </Label>
        <Input
          id="username-input"
          name="username"
          value={usernameData.username}
          onChange={(e) => setUsernameData({ username: e.target.value })}
          placeholder="Your username"
        />
        {errors.username && (
          <span className="text-red-500 text-sm">{errors.username}</span>
        )}
      </div>

      <div className="grid gap-3">
        <Label htmlFor="email-input" className="flex items-center gap-2 text-lg font-bold">
          <Mail className="h-4 w-4" />
          Email
        </Label>
        <Input
          id="email-input"
          name="email"
          type="email"
          value={emailData.email}
          onChange={(e) => setEmailData({ email: e.target.value })}
          placeholder="your@email.com"
        />
        {errors.email && (
          <span className="text-red-500 text-sm">{errors.email}</span>
        )}
      </div>

      {renderBioForm()}
      {renderLocationForm()}
      {renderSocialsForm()}
    </>
  );

  const renderFormContent = () => {
    switch (type) {
      case "BIO":
        return renderBioForm();
      case "LOCATION":
        return renderLocationForm();
      case "SOCIALS":
        return renderSocialsForm();
      case "FULLFORM":
        return renderFullFormContent();
      default:
        return null;
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-4 py-4">{renderFormContent()}</div>
      <DialogClose asChild>
        <Button
          type="button"
          variant="outline"
          disabled={profileUpdateMutation.isPending}
        >
          Cancel
        </Button>
      </DialogClose>
      <Button type="submit" disabled={profileUpdateMutation.isPending}>
        {profileUpdateMutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
          </>
        ) : (
          "Save changes"
        )}
      </Button>
    </form>
  );
}

export function ProfileEditFormNoModal() {
  const queryClient = useQueryClient();
  const [defaultData, setDefaultData] = useState<any | null>(null);
  const { data: session } = useSession();

  const type: ModalType = "FULLFORM";

  useEffect(() => {
    async function fetchData() {
      if (!defaultData && session?.user?.id) {
        try {
          const data = await useUserApi.getUser(session.user.id);
          setDefaultData(data.data);
        } catch (error) {
          console.error("Failed to fetch user data:", error);
          toast.error("Failed to load profile data.");
        }
      }
    }
    fetchData();
  }, [session?.user?.id, defaultData]);

  const [bioData, setBioData] = useState<BioFormData>({
    bio: defaultData?.bio || "",
  });
  const [locationData, setLocationData] = useState<LocationFormData>({
    location: defaultData?.location || "",
  });
  const [socialsData, setSocialsData] = useState<SocialsFormData>({
    socials:
      defaultData?.socials && defaultData.socials.length > 0
        ? defaultData.socials
        : [{ platform: "", url: "" }],
  });
  const [fullNameData, setFullNameData] = useState<FullNameFormData>({
    fullName: defaultData?.fullName || "",
  });
  const [usernameData, setUsernameData] = useState<UsernameFormData>({
    username: defaultData?.username || "",
  });
  const [emailData, setEmailData] = useState<EmailFormData>({
    email: defaultData?.email || "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const [openLocationCombobox, setOpenLocationCombobox] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [isSearchingLocations, setIsSearchingLocations] = useState(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (defaultData) {
      setBioData({ bio: defaultData.bio || "" });
      setLocationData({ location: defaultData.location || "" });
      setSocialsData({
        socials:
          defaultData.socials && defaultData.socials.length > 0
            ? defaultData.socials
            : [{ platform: "", url: "" }],
      });
      setFullNameData({ fullName: defaultData.fullName || "" });
      setUsernameData({ username: defaultData.username || "" });
      setEmailData({ email: defaultData.email || "" });
    }
  }, [defaultData]);

  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (locationData?.location.trim() !== "") {
      setIsSearchingLocations(true);
      debounceTimeoutRef.current = setTimeout(async () => {
        try {
          const response = await useLocationApi.getLocations(
            locationData.location ?? ""
          );
          if (response && response.data) {
            const suggestions = response.data.map((item: any) => item.Location);
            setLocationSuggestions(suggestions);
          } else {
            setLocationSuggestions([]);
          }
        } catch (error) {
          console.error("Error fetching locations:", error);
          setLocationSuggestions([]);
        } finally {
          setIsSearchingLocations(false);
        }
      }, 2000);
    } else {
      setLocationSuggestions([]);
      setIsSearchingLocations(false);
    }

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [locationData.location]);

  const addSocialInput = () => {
    if (socialsData.socials.length < 5) {
      setSocialsData({
        socials: [...socialsData.socials, { platform: "", url: "" }],
      });
    }
  };

  const removeSocialInput = (index: number) => {
    if (socialsData.socials.length > 1) {
      setSocialsData({
        socials: socialsData.socials.filter((_, i) => i !== index),
      });
    } else if (socialsData.socials.length === 1) {
      setSocialsData({ socials: [{ platform: "", url: "" }] });
    }
  };

  const updateSocialInput = (
    index: number,
    field: "platform" | "url",
    value: string
  ) => {
    const newSocials = [...socialsData.socials];
    newSocials[index] = { ...newSocials[index], [field]: value };
    setSocialsData({ socials: newSocials });
  };

  const profileUpdateMutation = useMutation({
    mutationFn: async (payload: Partial<FullFormData>) => {
      const response = await useUserApi.updateUser(payload);
      if (response.status !== 200) {
        throw new Error(response.message || "Failed to update profile.");
      }
      return response.data;
    },
    onSuccess: (data) => {
      toast.success("Profile updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["user", defaultData?._id] });
    },
    onError: (error) => {
      console.error("Error updating profile:", error);
      toast.error(error.message || "An error occurred while updating profile.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["user", defaultData?._id] });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      let validatedData: any;
      let payload: any;

      switch (type) {
        case "FULLFORM":
          const fullFormData: FullFormData = {
            fullName: fullNameData.fullName,
            username: usernameData.username,
            email: emailData.email,
            bio: bioData.bio,
            location: locationData.location,
            socials: socialsData.socials.filter(
              (social) =>
                social.platform.trim() !== "" || social.url.trim() !== ""
            ),
          };
          validatedData = fullFormSchema.parse(fullFormData);
          payload = validatedData;
          break;
        default:
          return;
      }
      profileUpdateMutation.mutate(payload);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          const field = err.path.join(".");
          fieldErrors[field] = err.message;
        });
        setErrors(fieldErrors);
      } else {
        console.error("An unexpected error occurred:", error);
        toast.error("An unexpected error occurred. Please try again.");
      }
    }
  };

  const renderBioForm = () => (
    <div className="grid gap-3">
      <Label htmlFor="bio-input" className="flex items-center gap-2 text-lg font-bold dark:text-gray-100">
        <Text className="h-4 w-4" />
        Bio
      </Label>
      <Textarea
        id="bio-input"
        name="bio"
        value={bioData.bio}
        onChange={(e) => setBioData({ bio: e.target.value })}
        placeholder="Tell us about yourself..."
        maxLength={300}
        className="min-h-[100px] dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600 dark:placeholder-gray-400"
      />
      <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
        <span>{bioData.bio?.length || 0}/300 characters</span>
        {errors.bio && <span className="text-red-500">{errors.bio}</span>}
      </div>
    </div>
  );

  const renderLocationForm = () => (
    <div className="grid gap-3">
      <Label htmlFor="location-input" className="flex items-center gap-2 text-lg font-bold dark:text-gray-100">
        <MapPin className="h-4 w-4" />
        Location
      </Label>
      <Popover
        open={openLocationCombobox}
        onOpenChange={setOpenLocationCombobox}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={openLocationCombobox}
            className="w-full justify-between dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600 hover:dark:bg-gray-600"
          >
            {locationData.location
              ? locationSuggestions.find(
                  (location) => location === locationData.location
                ) || locationData.location
              : "Select location..."}
            {isSearchingLocations ? (
              <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0 dark:bg-gray-800 dark:border-gray-700">
          <Command className="dark:bg-gray-800">
            <CommandInput
              placeholder="Search location..."
              value={locationData.location}
              onValueChange={(value) => {
                setLocationData({ location: value });
              }}
              className="dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600 dark:placeholder-gray-400"
            />
            <CommandList className="dark:bg-gray-800">
              {isSearchingLocations && locationData.location.trim() !== "" ? (
                <CommandEmpty className="flex items-center justify-center p-4 dark:text-gray-300">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Searching...
                </CommandEmpty>
              ) : (
                <CommandEmpty className="dark:text-gray-300">Search for a location</CommandEmpty>
              )}
              <CommandGroup className="dark:text-gray-100">
                {locationSuggestions.map((location) => (
                  <CommandItem
                    key={location}
                    value={location}
                    onSelect={(currentValue) => {
                      setLocationData({
                        location:
                          currentValue === locationData.location
                            ? ""
                            : currentValue,
                      });
                      setOpenLocationCombobox(false);
                    }}
                    className="dark:hover:bg-gray-700 dark:data-[selected=true]:bg-gray-600"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        locationData.location === location
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    {location}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
        <span>{locationData.location?.length || 0}/30 characters</span>
        {errors.location && (
          <span className="text-red-500">{errors.location}</span>
        )}
      </div>
    </div>
  );

  const renderSocialsForm = () => (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2 text-lg font-bold dark:text-gray-100">
          <Link className="h-4 w-4" />
          Social Links
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addSocialInput}
          disabled={socialsData.socials.length >= 5}
          className="dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600 hover:dark:bg-gray-600"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>
      {socialsData.socials.map((social, index) => (
        <div key={index} className="flex flex-col gap-2 p-2 border rounded-md dark:border-gray-700">
          <div className="grid gap-1">
            <Label
              htmlFor={`platform-${index}`}
              className="flex items-center gap-2 text-lg font-bold dark:text-gray-100"
            >
              Platform
            </Label>
            <Input
              id={`platform-${index}`}
              value={social.platform}
              onChange={(e) =>
                updateSocialInput(index, "platform", e.target.value)
              }
              placeholder="e.g., Twitter, LinkedIn"
              className="dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600 dark:placeholder-gray-400"
            />
            {errors[`socials.${index}.platform`] && (
              <span className="text-red-500 text-sm">
                {errors[`socials.${index}.platform`]}
              </span>
            )}
          </div>
          <div className="grid gap-1">
            <Label htmlFor={`url-${index}`} className="flex items-center gap-2 text-lg font-bold dark:text-gray-100">
              URL
            </Label>
            <Input
              id={`url-${index}`}
              value={social.url}
              onChange={(e) => updateSocialInput(index, "url", e.target.value)}
              placeholder="https://..."
              className="dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600 dark:placeholder-gray-400"
            />
            {errors[`socials.${index}.url`] && (
              <span className="text-red-500 text-sm">
                {errors[`socials.${index}.url`]}
              </span>
            )}
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeSocialInput(index)}
              disabled={
                socialsData.socials.length === 1 &&
                social.platform === "" &&
                social.url === ""
              }
              className="dark:text-gray-100 hover:dark:bg-gray-700"
            >
              <Minus className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        </div>
      ))}
      {errors.socials && (
        <span className="text-red-500 text-sm">{errors.socials}</span>
      )}
    </div>
  );

  const renderFullFormContent = () => (
    <>
      <div className="grid gap-3">
        <Label htmlFor="full-name-input" className="flex items-center gap-2 text-lg font-bold dark:text-gray-100">
          <User className="h-4 w-4" />
          Full Name
        </Label>
        <Input
          id="full-name-input"
          name="fullName"
          value={fullNameData.fullName}
          className="dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600 dark:placeholder-gray-400"
          onChange={(e) => setFullNameData({ fullName: e.target.value })}
          placeholder="Your full name"
        />
        {errors.fullName && (
          <span className="text-red-500 text-sm">{errors.fullName}</span>
        )}
      </div>

      <div className="grid gap-3">
        <Label htmlFor="username-input" className="flex items-center gap-2 text-lg font-bold dark:text-gray-100">
          <AtSign className="h-4 w-4" />
          Username
        </Label>
        <Input
          id="username-input"
          name="username"
          value={usernameData.username}
          onChange={(e) => setUsernameData({ username: e.target.value })}
          placeholder="Your username"
          className="dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600 dark:placeholder-gray-400"
        />
        {errors.username && (
          <span className="text-red-500 text-sm">{errors.username}</span>
        )}
      </div>

      <div className="grid gap-3">
        <Label htmlFor="email-input" className="flex items-center gap-2 text-lg font-bold dark:text-gray-100">
          <Mail className="h-4 w-4" />
          Email
        </Label>
        <Input
          id="email-input"
          name="email"
          type="email"
          value={emailData.email}
          onChange={(e) => setEmailData({ email: e.target.value })}
          placeholder="your@email.com"
          className="dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600 dark:placeholder-gray-400"
        />
        {errors.email && (
          <span className="text-red-500 text-sm">{errors.email}</span>
        )}
      </div>

      {renderBioForm()}
      {renderLocationForm()}
      {renderSocialsForm()}
    </>
  );

  const renderFormContent = () => {
    switch (type) {
      case "FULLFORM":
        return renderFullFormContent();
      default:
        return null;
    }
  };
  if(!defaultData) return <Loading />;
  else
  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg">
      <div className="grid gap-4 py-4">{renderFormContent()}</div>
      <Button type="submit" disabled={profileUpdateMutation.isPending} className="dark:bg-blue-600 dark:hover:bg-blue-700 dark:text-white">
        {profileUpdateMutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
          </>
        ) : (
          "Save changes"
        )}
      </Button>
    </form>
  );
}

export function ProfileEditModal({
  type,
  children,
  defaultData,
}: {
  type: ModalType;
  children?: React.ReactNode;
  defaultData?: any;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const getModalConfig = () => {
    switch (type) {
      case "BIO":
        return {
          title: "Edit Bio",
          description: "Update your bio information. Maximum 300 characters.",
          triggerText: "Edit Bio",
        };
      case "LOCATION":
        return {
          title: "Edit Location",
          description: "Update your location. Maximum 30 characters.",
          triggerText: "Edit Location",
        };
      case "SOCIALS":
        return {
          title: "Edit Social Links",
          description:
            "Add or remove your social media links. Maximum 5 links.",
          triggerText: "Edit Socials",
        };
      case "FULLFORM":
        return {
          title: "Edit Full Profile",
          description: "Update all your profile details.",
          triggerText: "Edit Profile",
        };
      default:
        return {
          title: "Edit Profile",
          description: "Make changes to your profile here.",
          triggerText: "Edit Profile",
        };
    }
  };

  const config = getModalConfig();

  return (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <DialogTrigger asChild>
        {children || <Badge>{config.triggerText}</Badge>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] h-[65vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>
        {/* Render the separated form component here */}
        <ProfileEditForm
          type={type}
          defaultData={defaultData}
          onClose={() => setIsModalOpen(false)} // Pass the close handler
        />
      </DialogContent>
    </Dialog>
  );
}