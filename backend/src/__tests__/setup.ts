import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let mongoServer: MongoMemoryServer;

// Start in-memory MongoDB before all tests
export async function connect() {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
}

// Clear all collections between tests so each test starts clean
export async function clearDB() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

// Disconnect and stop the server after all tests
export async function disconnect() {
  await mongoose.disconnect();
  await mongoServer.stop();
}
