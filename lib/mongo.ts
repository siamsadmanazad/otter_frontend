"use server";
import mongoose from "mongoose";

declare global {
  var mongoose: {
    promise: Promise<mongoose.Mongoose> | null;
    conn: mongoose.Connection | null;
  };
}

if (!global.mongoose) {
  global.mongoose = { conn: null, promise: null };
}

const RETRY_INTERVAL_MS = 3000;
const MAX_CONNECTION_ATTEMPTS = 5;

export const connectToDatabase = async () => {
  if (global.mongoose.conn && global.mongoose.conn.readyState === 1) {
    console.log("Using existing database connection.");
    return global.mongoose.conn;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error("Please define the MONGODB_URI environment variable");
  }

  const options = {
    bufferCommands: false,
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 30000,
    maxPoolSize: 400,
    minPoolSize: 20,
    maxIdleTimeMS: 30000,
    waitQueueTimeoutMS: 10000,
    heartbeatFrequencyMS: 10000,
    retryWrites: true,
    retryReads: true,
    compressors: "zlib",
  };

  let isConnected = false;
  let connectionAttempts = 0;

  while (!isConnected && connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
    connectionAttempts++;
    console.log(
      `Attempting to connect to MongoDB (Attempt ${connectionAttempts}/${MAX_CONNECTION_ATTEMPTS})...`
    );

    try {
      if (global.mongoose.conn && global.mongoose.conn.readyState === 0) {
        global.mongoose.conn = null;
        global.mongoose.promise = null;
      }

      if (global.mongoose.promise) {
        await global.mongoose.promise;
      }

      global.mongoose.promise = mongoose.connect(
        process.env.MONGODB_URI!,
        options
      );

      const mongooseInstance = await global.mongoose.promise;
      global.mongoose.conn = mongooseInstance.connection;

      // Set up connection event listeners
      global.mongoose.conn.on("connected", () => {
        console.log("MongoDB connected successfully");
      });

      global.mongoose.conn.on("error", (err) => {
        console.error("MongoDB connection error:", err);
        // Reset connection on error
        global.mongoose.conn = null;
        global.mongoose.promise = null;
      });

      global.mongoose.conn.on("disconnected", () => {
        console.log("MongoDB disconnected");
        global.mongoose.conn = null;
        global.mongoose.promise = null;
      });

      // Verify connection is actually ready
      if (global.mongoose.conn.readyState === 1) {
        isConnected = true;
        console.log("Successfully connected to MongoDB!");
        return global.mongoose.conn;
      } else {
        throw new Error("Connection established but not ready");
      }
    } catch (error) {
      const errResponse = error as unknown as { message: string; code: number };
      console.error(
        `MongoDB connection failed: ${errResponse.message}. ${
          connectionAttempts < MAX_CONNECTION_ATTEMPTS
            ? `Retrying in ${RETRY_INTERVAL_MS / 1000} seconds...`
            : "Max attempts reached."
        }`
      );

      // Reset connection state
      global.mongoose.promise = null;
      global.mongoose.conn = null;

      // If we haven't reached max attempts, wait before retrying
      if (connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL_MS));
      }
    }
  }

  // If we've exhausted all attempts, throw an error
  if (!isConnected) {
    throw new Error(
      `Failed to connect to MongoDB after ${MAX_CONNECTION_ATTEMPTS} attempts`
    );
  }
};

// Handle graceful shutdown
if (typeof process !== "undefined") {
  process.on("SIGINT", async () => {
    if (global.mongoose.conn) {
      await global.mongoose.conn.close();
      console.log("MongoDB connection closed due to app termination");
    }
    process.exit(0);
  });
}

// Example usage (uncomment to test)
// (async () => {
//   try {
//     const dbConnection = await connectToDatabase();
//     console.log('Application is now using the database connection:', dbConnection.host);
//   } catch (err) {
//     console.error('Failed to connect to the database after multiple retries:', err);
//   }
// })();
