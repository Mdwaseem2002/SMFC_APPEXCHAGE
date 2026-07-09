// src/lib/mongodb.ts
import mongoose from 'mongoose';

// Ensure MONGODB_URI is defined at runtime
const MONGODB_URI = process.env.MONGODB_URI;

interface CachedMongoose {
  conn: mongoose.Connection | null;
  promise: Promise<typeof mongoose> | null;
}

// Use a type assertion to ensure global is treated correctly
const globalWithMongoose = global as typeof global & {
  mongoose?: CachedMongoose;
};

// Initialize cached connection
const cached: CachedMongoose = globalWithMongoose.mongoose || { conn: null, promise: null };

// Store in global to persist across serverless function invocations
if (!globalWithMongoose.mongoose) {
  globalWithMongoose.mongoose = cached;
}

async function connectMongoDB(): Promise<mongoose.Connection> {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined. Running in SFMC-only mode.');
  }

  // Type assertion to ensure MONGODB_URI is a string
  const mongoUri = MONGODB_URI as string;

  // If connection exists, return it
  if (cached.conn) {
    return cached.conn;
  }

  // Create connection if no existing promise
  if (!cached.promise) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
      // Increased timeouts for Vercel serverless environment
      socketTimeoutMS: 60000, // Increased from 30000
      connectTimeoutMS: 60000, // Added explicit connect timeout
      // Add serverSelectionTimeoutMS
      serverSelectionTimeoutMS: 10000,
      // Keep the connection alive
      maxPoolSize: 10,
      retryWrites: true,
    };

    // Use type assertion to ensure string type
    cached.promise = mongoose.connect(mongoUri, opts)
      .then((mongooseInstance) => {
        console.log('MongoDB connected successfully');
        return mongooseInstance;
      })
      .catch((error) => {
        console.error('MongoDB connection error:', error);
        // Reset promise on error so we can retry next time
        cached.promise = null;
        throw error;
      });
  }

  try {
    let mongooseInstance = await cached.promise;
    
    // Check if connection is disconnected or has errored out
    if (mongooseInstance && mongooseInstance.connection.readyState !== 1 && mongooseInstance.connection.readyState !== 2) {
      console.log('MongoDB connection was lost. Reconnecting...');
      cached.promise = null;
      cached.conn = null;
      return connectMongoDB(); // recursive retry
    }
    
    cached.conn = mongooseInstance.connection;
    return cached.conn;
  } catch (e) {
    cached.promise = null;
    cached.conn = null;
    throw e;
  }
}

export default connectMongoDB;