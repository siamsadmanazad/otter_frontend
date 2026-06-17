import { runDBOperation } from "@/lib/useDB";
import { NextRequest } from "next/server";
import UserSchema from '@/utils/schema/user-schema';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken';
import { loginSchema } from "@/utils/models/signin.model";

export async function GET(request: Request) {
    return Response.json({
        message: "Hello World",
        status: 200,
        method: request.method,
    })
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const body = await request.json();
    const validatedData = loginSchema.parse(body);

    const targetUser = await runDBOperation(async () => {
      const user = await UserSchema.findOne({ email: validatedData.email }).select("serial email password active");

      if (!user) {
        return Response.json(
          {
            message: "User not found",
            status: 404,
          },
          { status: 404 }
        );
      }

      if (!user.active) {
        return Response.json(
          {
            message: "Account is inactive",
            status: 403,
          },
          { status: 403 }
        );
      }

      const checkPassword = await bcrypt.compare(validatedData.password, user.password);

      if (!checkPassword) {
        return Response.json(
          {
            message: "Invalid password",
            status: 400,
          },
          { status: 400 }
        );
      }

      const token = jwt.sign(
        { serial: user.serial, email: user.email },
        process.env.JWT_SECRET as string,
        { expiresIn: '24h' }
      );

      cookieStore.set({
        name: 'auth_token',
        value: token,
        httpOnly: true,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24,
      });

      return Response.json({
        message: "Sign-in successful",
        data: { email: validatedData.email, token },
        status: 200,
      });
    });
    
    return targetUser;

  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        {
          message: "Validation failed",
          errors: error.errors,
          status: 400,
        },
        { status: 400 }
      );
    }

    console.error('Login error:', error);
    return Response.json(
      {
        message: "Internal server error",
        status: 500,
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS(request: Request) {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
}
