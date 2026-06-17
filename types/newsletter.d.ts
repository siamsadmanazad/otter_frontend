import { Document } from 'mongoose';
import type { v4 as uuidv4 } from 'uuid';

export interface NewsLetterDocument extends Document {
  _id: string;
  serial: uuidv4;
  location: string;
  email: string;
}