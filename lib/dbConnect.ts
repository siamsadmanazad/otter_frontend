"use server";
import mongoose from "mongoose";

declare global {
  var mongoose: {
    promise: Promise<mongoose.Mongoose> | null;
    conn: mongoose.Connection | null;
  };
}

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable");
}

if (!global.mongoose) {
  global.mongoose = { conn: null, promise: null };
}

const connectToDatabase_low = async () => {
  if (global.mongoose.conn) {
    // Add a ping to keep connection alive
    try {
      await global.mongoose.conn.db.admin().ping();
    } catch (err) {
      console.log("Ping failed, reconnecting...");
      global.mongoose.conn = null;
      global.mongoose.promise = null;
      return connectToDatabase();
    }
    return global.mongoose.conn;
  }

  if (!global.mongoose.promise) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false, // Disable mongoose buffering
      serverSelectionTimeoutMS: 5000, // Faster server selection
      socketTimeoutMS: 30000, // Close sockets after 30s of inactivity
      connectTimeoutMS: 10000, // Give up initial connection after 10s
      maxPoolSize: 5, // Match M0 cluster limits (max 500 connections)
      minPoolSize: 1, // Maintain one connection always
      maxIdleTimeMS: 20000, // Close idle connections after 20s
      waitQueueTimeoutMS: 5000, // Return error if no connection available after 5s
      heartbeatFrequencyMS: 10000, // Send pings every 10s
      retryWrites: true,
      retryReads: true,
    };

    global.mongoose.promise = mongoose
      .connect(MONGODB_URI, opts)
      .then((mongoose) => {
        console.log("MongoDB connection established");
        return mongoose.connection;
      })
      .catch((err) => {
        console.error("MongoDB connection error:", err);
        global.mongoose.promise = null;
        throw err;
      });

    // Set up event listeners for better debugging
    mongoose.connection.on("connected", () =>
      console.log("Mongoose default connection open")
    );
    mongoose.connection.on("error", (err) =>
      console.error("Mongoose default connection error:", err)
    );
    mongoose.connection.on("disconnected", () =>
      console.warn("Mongoose default connection disconnected")
    );
  }

  try {
    global.mongoose.conn = await global.mongoose.promise;
  } catch (err) {
    global.mongoose.promise = null;
    throw err;
  }

  return global.mongoose.conn;
};

// Add a keep-alive ping every 15 seconds
if (typeof window === "undefined") {
  setInterval(async () => {
    if (global.mongoose.conn) {
      try {
        await global.mongoose.conn.db.admin().ping();
      } catch (err) {
        console.log("Keep-alive ping failed:", err.message);
      }
    }
  }, 15000);
}

export default connectToDatabase_low;
