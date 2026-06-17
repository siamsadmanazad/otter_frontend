import { runDBOperation } from "@/lib/useDB";

export async function GET(request: Request) {
  const database = await runDBOperation(async () =>
    'database hit'
  );
  return Response.json({
    message: `App running and ${database}`,
    status: 200,
    method: request.method,
  });
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
