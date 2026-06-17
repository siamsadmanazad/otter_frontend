import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import userSchema from '@/utils/schema/user-schema';
import bcrypt from 'bcrypt';
import { runDBOperation } from '@/lib/useDB';
import NextAuth, { type AuthOptions } from "next-auth";
import { v4 } from "uuid";

// Extend NextAuth types
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      serial: string;
      username: string;
      name: string;
      email: string;
      image: string | null;
    }
  }

  interface User {
    id: string;
    serial: string;
    username: string;
    fullName: string;
    email: string;
    image?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    serial?: string;
    username?: string;
  }
}

export const authOptions: AuthOptions = {
  providers: [
    Google({
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
      clientId: process.env.AUTH_GOOGLE_ID as string ?? "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET as string ?? ""
    }),
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }
        
        const user = await runDBOperation(async () => (
          await userSchema.findOne({ email: credentials.email })
        ));
        
        if (!user) {
          throw new Error("No user found with that email.");
        }
        
        const isValid = await bcrypt.compare(credentials.password as string, user.password);
        
        if (!isValid) {
          throw new Error("Incorrect password.");
        }
        
        return {
          id: user._id.toString(),
          serial: user.serial,
          email: user.email,
          fullName: user.fullName,
          username: user.username,
          image: user.image || null,
        };
      }
    })
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === "google") {
        const userExists = await runDBOperation(async () => {
          const user = await userSchema.findOne({ email: profile?.email });
          return !!user;
        });
        
        if (!userExists) {
          await runDBOperation(async () => {
            const username = profile?.email?.split("@")[0]?.replace(/[._]/g, '').toLowerCase();
            const userData = new userSchema({
              email: profile?.email,
              fullName: profile?.name,
              username,
              agreeToTerms: true,
              profileImage: profile?.image,
              password: v4(),
            });
            await userData.save();
          });
        }
        return true;
      }
      return true;
    },
    
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.serial = user.serial;
        token.username = user.username;
        token.name = user.fullName;
        token.email = user.email;
        token.picture = user.image;
      }
      return token;
    },
    
    async session({ session, token }) {
      const userExists = await runDBOperation(async () => 
        await userSchema.findOne({ email: session?.user?.email })
      );
      
      if (!userExists || !userExists.active) {
        return { ...session, user: undefined };
      }
      
      if (session.user) {
        session.user.id = userExists._id.toString();
        session.user.serial = userExists.serial;
        session.user.username = userExists.username;
        session.user.name = userExists.fullName;
        session.user.email = userExists.email;
        session.user.image = userExists.image || null;
      }
      
      return session;
    }
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  secret: process.env.AUTH_SECRET,
}

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions);