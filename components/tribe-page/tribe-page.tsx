"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Users,
  Share,
  MoreHorizontal,
  Calendar,
  Globe,
  Lock,
} from "lucide-react";
import Image from "next/image";
import { formatCountNumber } from "@/lib/count-format";
import type { TribePageProps } from "@/types/tribes.d";
import { TribePosts } from "./tribe-posts";
import { TribeMemberButton } from "./tribe-member-button";
import { useTribeStore } from "./tribe.hooks";
import Dynamic from "next/dynamic";
import { LoadingSmall } from "../ui/loading";

// const CreatePost = Dynamic(
//   () => import("../create-post").then((mod) => mod.CreatePost),
//   {
//     ssr: false,
//     loading: ()=> <Button className="bg-white dark:bg-black"><LoadingSmall /></Button>
//   }
// )

export function TribePage_v1({ tribeData }: TribePageProps) {
  const [activeTab, setActiveTab] = useState("posts");
  const { isTribeAdmin, isTribeMember } = useTribeStore();
  console.log(isTribeMember, isTribeAdmin);

  if (!tribeData) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        Tribe not found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-50">
      <div className="max-w-4xl mx-auto">
        {/* Cover Image */}
        <div className="relative h-48 md:h-64 bg-gradient-to-r from-blue-400 to-purple-500">
          <Image
            src={tribeData.coverImage || "/placeholder.svg"}
            alt="Group cover"
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-black bg-opacity-30" />
        </div>

        {/* Group Info */}
        <div className="bg-white dark:bg-gray-900 px-4 pb-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between -mt-8 md:-mt-4">
            <div className="flex flex-col md:flex-row md:items-end gap-4">
              {/* Avatar with dark mode border */}
              <Avatar className="w-32 h-32 border-4 border-white dark:border-gray-900 shadow-lg mt-[-20px]">
                <AvatarImage
                  src={tribeData.profileImage || "/placeholder.svg"}
                />
                <AvatarFallback className="text-2xl">
                  {tribeData.name}
                </AvatarFallback>
              </Avatar>

              <div className="md:mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-2xl font-bold dark:text-white mt-10">
                    {tribeData.name}
                  </h1>
                </div>
                {tribeData.privacy === "PUBLIC" ? (
                  <Badge className="bg-teal-500/50 hover:bg-teal-500/70 text-white font-bold duration-300">
                    <Globe className="w-5 h-5" />
                    Public
                  </Badge>
                ) : (
                  <Badge className="bg-violet-500/50 hover:bg-violet-500/70 text-white font-bold duration-300">
                    <Lock className="w-5 h-5" />
                    Private
                  </Badge>
                )}
                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300 mb-2">
                  <span>
                    <strong>{formatCountNumber(tribeData.usersCount)}</strong>{" "}
                    members
                  </span>
                  <span>
                    <strong>{formatCountNumber(tribeData.postsCount)}</strong>{" "}
                    posts
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-4 md:mt-0 md:mb-4">
              <TribeMemberButton tribeId={tribeData.serial} />
              {
                // isTribeMember && <CreatePost groupId={tribeData._id} profileId={session?.user?.id} />
              }
              {
                // isTribeAdmin && <CreatePost groupId={tribeData._id} profileId={session?.user?.id} />
              }
              <Button variant="outline" size="icon">
                <Share className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Description */}
          <div className="mt-4">
            <p className="text-gray-800 dark:text-gray-200 leading-relaxed">
              {tribeData.description}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Created {new Date(tribeData.createdAt).toLocaleDateString()}
            </p>
          </div>

          {/* Admins - Assuming the payload doesn't have admins, using a placeholder */}
          <div className="mt-4">
            <h3 className="font-semibold mb-2 dark:text-white">Admins</h3>
            <div className="flex gap-3">
              {/* Replace with a loop through actual admin data if available */}
              <div className="flex items-center gap-2">
                <Avatar className="w-8 h-8">
                  <AvatarImage src="/placeholder.svg" />
                  <AvatarFallback>A</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium dark:text-white">
                    Admin Name
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    @admin_username
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Tabs */}
        <div className="bg-white dark:bg-gray-900 border-t dark:border-gray-800">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start border-b dark:border-gray-800 bg-transparent h-auto p-0">
              <TabsTrigger
                value="posts"
                className="border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:dark:border-blue-400 rounded-none bg-transparent dark:text-white dark:data-[state=active]:bg-transparent dark:data-[state=active]:text-white"
              >
                Posts
              </TabsTrigger>
              <TabsTrigger
                value="events"
                className="border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:dark:border-blue-400 rounded-none bg-transparent dark:text-white dark:data-[state=active]:bg-transparent dark:data-[state=active]:text-white"
              >
                Events
              </TabsTrigger>
              <TabsTrigger
                value="members"
                className="border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:dark:border-blue-400 rounded-none bg-transparent dark:text-white dark:data-[state=active]:bg-transparent dark:data-[state=active]:text-white"
              >
                Members
              </TabsTrigger>
              <TabsTrigger
                value="about"
                className="border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:dark:border-blue-400 rounded-none bg-transparent dark:text-white dark:data-[state=active]:bg-transparent dark:data-[state=active]:text-white"
              >
                About
              </TabsTrigger>
            </TabsList>

            <TabsContent value="posts" className="mt-0 p-4 space-y-6">
              {/* Create Post */}
              {
                // isJoined && (
                //   <Card className="dark:bg-gray-900 dark:border-gray-800">
                //     <CardContent className="p-4">
                //       <div className="flex gap-3">
                //         <Avatar className="w-10 h-10">
                //           <AvatarImage src="/placeholder.svg" />
                //           <AvatarFallback>U</AvatarFallback>
                //         </Avatar>
                //         <div className="flex-1 space-y-3">
                //           <Textarea
                //             placeholder="Share your photography tips, ask questions, or show your latest work..."
                //             value={newPost}
                //             onChange={(e) => setNewPost(e.target.value)}
                //             className="min-h-[100px] resize-none dark:bg-gray-950 dark:border-gray-700 dark:text-white placeholder:dark:text-gray-400"
                //           />
                //           <div className="flex items-center justify-between">
                //             <Button variant="outline" size="sm">
                //               <ImageIcon className="w-4 h-4 mr-2" />
                //               Add Photo
                //             </Button>
                //             <Button
                //               onClick={handleCreatePost}
                //               disabled={!newPost.trim()}
                //             >
                //               Post
                //             </Button>
                //           </div>
                //         </div>
                //       </div>
                //     </CardContent>
                //   </Card>
                // )
              }

              {/* Posts */}
              {tribeData.privacy === "PUBLIC" || isTribeMember || isTribeAdmin ? (
                <TribePosts tribeId={tribeData._id} />
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p className="text-lg">You must join this tribe to view its posts.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="events" className="mt-0 p-4 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold dark:text-white">
                  Upcoming Events
                </h2>
                <Button>
                  <Calendar className="w-4 h-4 mr-2" />
                  Create Event
                </Button>
              </div>
              {/* 
              {events.map((event) => (
                <Card
                  key={event.id}
                  className="dark:bg-gray-900 dark:border-gray-800"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="bg-blue-100 dark:bg-blue-950 p-3 rounded-lg">
                        <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1 dark:text-white">
                          {event.title}
                        </h3>
                        <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {event.date} at {event.time}
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            {event.location}
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            {event.attendees}/{event.maxAttendees} attending
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <Badge variant="outline">{event.type}</Badge>
                          <Button size="sm">Join Event</Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))} */}
            </TabsContent>

            <TabsContent value="members" className="mt-0 p-4 space-y-4">
              <div className="flex items-center justify-between mb-4">
                {/* <h2 className="text-lg font-semibold dark:text-white">
                  Members ({members.length})
                </h2> */}
                <Button variant="outline">
                  <Users className="w-4 h-4 mr-2" />
                  Invite Members
                </Button>
              </div>

              <div className="space-y-3">
                {/* {members.map((member) => (
                  <Card
                    key={member.username}
                    className="dark:bg-gray-900 dark:border-gray-800"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-12 h-12">
                            <AvatarImage
                              src={member.avatar || "/placeholder.svg"}
                            />
                            <AvatarFallback>{member.name[0]}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold dark:text-white">
                                {member.name}
                              </h3>
                              <Badge
                                variant={
                                  member.role === "Admin"
                                    ? "default"
                                    : member.role === "Moderator"
                                    ? "secondary"
                                    : "outline"
                                }
                                className="text-xs"
                              >
                                {member.role}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              @{member.username}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {member.posts} posts in group
                            </p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          View Profile
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))} */}
              </div>
            </TabsContent>

            <TabsContent value="about" className="mt-0 p-4 space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-3 dark:text-white">
                  About This Group
                </h2>
                <p className="text-gray-700 dark:text-gray-200 leading-relaxed">
                  {tribeData.description}
                </p>
              </div>

              <Separator className="dark:bg-gray-800" />

              <div>
                <h3 className="font-semibold mb-3 dark:text-white">
                  Group Rules
                </h3>
                <div className="space-y-2">
                  {/* Assuming rules are not in payload, using a placeholder */}
                  <div className="flex items-start gap-2">
                    <span className="text-blue-600 dark:text-blue-400 font-semibold">
                      1.
                    </span>
                    <span className="text-gray-700 dark:text-gray-200">
                      Be respectful and supportive.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-blue-600 dark:text-blue-400 font-semibold">
                      2.
                    </span>
                    <span className="text-gray-700 dark:text-gray-200">
                      No spam or self-promotion.
                    </span>
                  </div>
                </div>
              </div>

              <Separator className="dark:bg-gray-800" />

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">
                    Privacy:
                  </span>
                  <p className="font-medium dark:text-white">
                    {tribeData.privacy}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">
                    Created:
                  </span>
                  <p className="font-medium dark:text-white">
                    {new Date(tribeData.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">
                    Category:
                  </span>
                  <p className="font-medium dark:text-white">
                    {tribeData.category}
                  </p>
                </div>
                <div>
                  {/* <span className="text-gray-500 dark:text-gray-400">
                    Posts:
                  </span>
                  <p className="font-medium dark:text-white">{posts.length}</p> */}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
