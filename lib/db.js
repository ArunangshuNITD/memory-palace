import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially.
 */
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  // 1. Return cached connection if available
  if (cached.conn) {
    return cached.conn;
  }

  // 2. If no promise exists, create a new connection promise
  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    // Use .then() to store the connection or catch to reset the promise
    cached.promise = mongoose.connect(MONGODB_URI, opts)
      .then((mongooseInstance) => {
        console.log("✅ New MongoDB Connection Established");
        return mongooseInstance;
      })
      .catch((error) => {
        console.error("❌ MongoDB Connection Error:", error);
        cached.promise = null; // Reset promise so next attempt can try again
        throw error;
      });
  }

  // 3. Wait for the promise to resolve and cache the connection
  cached.conn = await cached.promise;
  
  return cached.conn;
}

export default connectDB;