"use client";
// not being used
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function AuthChecker() {
    const {data: session} = useSession();
    const router = useRouter();
    useEffect(()=>{
        if (session && session?.user) {
          router.push("/feed");
        }
    },[session, session?.user]);
    return <div></div>;
}