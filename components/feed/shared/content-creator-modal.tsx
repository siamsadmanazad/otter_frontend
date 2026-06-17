"use client";

// import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
// import {
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogHeader,
//   DialogTitle,
//   DialogTrigger,
// } from "@/components/ui/dialog";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
import {
  Camera,
  ImageIcon,
  Globe,
  Mountain,
  Plane,
  // Compass,
} from "lucide-react";
import Dynamic from "next/dynamic";
import { LoadingSmall } from "@/components/ui/loading";

const CreatePost = Dynamic(
  () => import("../shared/create-post").then((mod) => mod.CreatePost),
  {
    ssr: false,
    loading: ()=> <Button className="bg-white dark:bg-black"><LoadingSmall /></Button>
  }
)

// const CreateJournal = Dynamic(
//   () => import("@/components/create-journal").then((mod) => mod.CreateJournal),
//   {
//     ssr: true,
//     loading: () => (
//       <Button className="bg-white dark:bg-black">
//         <LoadingSmall />
//       </Button>
//     ),
//   }
// );

export default function ContentCreator({profileId, userImage}: { profileId: string, userImage: string }) {
  return (
    <Card className="w-full h-full">
         <CardHeader className="relative">
           <div className="flex items-center gap-4">
             <Avatar className="w-16 h-16 ring-4 ring-white dark:ring-gray-800 shadow-lg">
               <AvatarImage src={ userImage } alt="User" />
               <AvatarFallback className="bg-gradient-to-br from-blue-500 to-orange-500 text-white text-xl font-bold">
                 JD
               </AvatarFallback>
             </Avatar>
             <div className="flex-1">
               <h2 className="text-2xl font-bold bg-gradient-to-br from-[#0099DB] to-[#00F0E4] bg-clip-text text-transparent">
                 Share Your Adventure
               </h2>
               <p className="text-muted-foreground flex items-center gap-1">
                 <Globe className="w-4 h-4" />
                 What's your next story?
               </p>
             </div>
             <div className="hidden sm:flex items-center gap-2 text-muted-foreground">
               <Mountain className="w-5 h-5" />
               <Plane className="w-5 h-5" />
             </div>
           </div>
         </CardHeader>
         <CardContent className="relative space-y-4">
           <div className="flex flex-row justify-between gap-4">
             {/* Create Post Dialog */}
             <div className="w-full">
               <CreatePost profileId={profileId}>
                 <Button
                   variant="outline"
                   className="w-full h-24 flex-col gap-3 bg-gradient-to-br from-blue-500/10 to-blue-600/20 border-blue-200 dark:border-blue-800 dark:bg-blue-900/10 hover:from-blue-500/20 hover:to-blue-600/30 transition-all duration-300 group"
                 >
                   <div className="flex items-center gap-2">
                     <Camera className="w-6 h-6 text-blue-600 group-hover:scale-110 transition-transform" />
                     <ImageIcon className="w-5 h-5 text-blue-500" />
                   </div>
                   <div className="text-center">
                     <div className="font-semibold text-blue-700 dark:text-blue-300">
                       Create Post
                     </div>
                     <div className="text-xs text-blue-600 dark:text-blue-400">
                       Share a moment
                     </div>
                   </div>
                 </Button>
               </CreatePost>
             </div>
           </div>
         </CardContent>
    </Card>
  )
}