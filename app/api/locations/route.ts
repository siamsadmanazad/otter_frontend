import { runDBOperation } from "@/lib/useDB";
import Location from "@/utils/schema/location-schema";
import { NextRequest } from "next/server";
// import locationsData from "@/data/bangladesh-geojson/bd-locations.json";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const locationName = searchParams.get("location");

  if (locationName !== null && locationName.trim() === "") {
    return Response.json({
      message: "Empty location parameter provided",
      status: 200,
      data: [],
    });
  }

  try {
    const data = await runDBOperation(async () => {
      let query = {};
      if (locationName) {
        query = { Location: { $regex: locationName, $options: "i" } };
      }
      const locations = await Location.find(query);
      return locations;
    });

    return Response.json({
      message: locationName
        ? `Found location(s) for "${locationName}"`
        : "Got all locations",
      status: 200,
      data,
    });
  } catch (error) {
    console.error("Error in GET /api/locations:", error);
    return Response.json(
      {
        message: "Failed to retrieve location(s)",
        status: 500,
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const postBody = await request.json();

    const data = await runDBOperation(async () => {
      const newLocation = new Location(postBody);
      const savedLocation = await newLocation.save();
      return savedLocation;
    });

    return Response.json(
      {
        message: "Location created successfully",
        status: 201, // 201 Created for successful resource creation
        data,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in POST /api/locations:", error);
    return Response.json(
      {
        message: "Failed to create location",
        status: 500,
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

// export async function PATCH(request: NextRequest) {
//   try {
//     const syncResult = await runDBOperation(async () => {
//       const operations = locationsData.map((loc: any) => ({
//         updateOne: {
//           filter: { id: loc.id },
//           update: {
//             $set: {
//               division_id: loc.division_id,
//               division_name: loc.division_name,
//               district_name: loc.district_name,
//               Location: loc.place,
//               place: loc.place,
//               lat: loc.lat,
//               lng: loc.lng,
//             },
//           },
//           upsert: true,
//         },
//       }));

//       const result = await Location.bulkWrite(operations);
//       return result;
//     });

//     return Response.json({
//       message: "Database synced with JSON data successfully",
//       status: 200,
//       data: syncResult,
//     });
//   } catch (error) {
//     console.error("Error in PATCH /api/locations:", error);
//     return Response.json(
//       {
//         message: "Failed to sync database with JSON data",
//         status: 500,
//         error: (error as Error).message,
//       },
//       { status: 500 }
//     );
//   }
// }

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}
