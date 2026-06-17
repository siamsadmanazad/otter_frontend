import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateUniqueFilename() {
  const timestamp = new Date().toISOString().replace(/[:.-]/g, "_");
  const randomString = Math.random().toString(36).substring(2, 8);
  return `${timestamp}_${randomString}.webp`;
}
export function generateUniqueVideoFilename(mimeType: string) {
  const timestamp = new Date().toISOString().replace(/[:.-]/g, "_");
  const randomString = Math.random().toString(36).substring(2, 8);
  return `${timestamp}_${randomString}.${mimeType}`;
}
