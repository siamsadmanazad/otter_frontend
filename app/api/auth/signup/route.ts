import { NextRequest } from "next/server";
import { z } from "zod";
import UserSchema from "@/utils/schema/user-schema";
import { runDBOperation } from "@/lib/useDB";
import { signupSchema } from "@/utils/models/signup.model";
import userSchema from "@/utils/schema/user-schema";
import bcrypt from 'bcrypt';

export async function GET(request: Request) {
  return Response.json({
    message: "Hello World",
    status: 200,
    method: request.method,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = signupSchema.parse(body);
    const newUser = await runDBOperation(async () => {
      const user = new UserSchema(validatedData);
      await user.save();
      return user;
    });
    if (newUser) {
      return Response.json({
        message: "Sign-up successful",
        data: validatedData,
        status: 200,
      });
    } else {
      return Response.json({
        message: "error",
        data: "check log",
        status: 500,
      });
    }
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
    console.log(error);
    return Response.json(
      {
        message: "Internal server error",
        status: 500,
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    const hashedPassword = await bcrypt.hash(password, 10);
        await runDBOperation(async () => {
          const updatePassword = await userSchema.findOneAndUpdate(
            { email: email },
            { password: hashedPassword }
          );
          return updatePassword;
        });
        return Response.json({
          message: "Password changed",
          status: 200,
        });
      }
   catch (err) {
    console.log(err);
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
