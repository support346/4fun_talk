import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import env from 'dotenv';
env.config();

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  
  // Overwrite MONGODB_URI to use the in-memory database
  process.env.MONGODB_URI = uri;

  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany();
  }
});
