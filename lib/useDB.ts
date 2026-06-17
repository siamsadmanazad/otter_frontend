import { connectToDatabase } from './mongo';
import connectToDatabase_low from './dbConnect';
import mongoose from 'mongoose';

/**
 * A utility to wrap any MongoDB operation with a database connection.
 * @param operation - A function that takes a Mongoose model and returns a promise with the result.
 * @returns The result of the operation or throws an error.
 */
export async function runDBOperation<T>(
  operation: () => Promise<T>
): Promise<T> {
  try {
    await connectToDatabase();

    return await operation();
  } catch (error) {
    console.error('Database operation failed:', JSON.stringify(error));
    throw new Error('Database operation failed');
  }
}

export async function runDBOperationWithTransaction<T>(operation: (session: mongoose.ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const result = await operation(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
