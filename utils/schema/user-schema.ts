import { model, models, Schema } from 'mongoose';
import { UserDocument } from '@/types/user.d';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const userSchema = new Schema<UserDocument>(
  {
    serial: {
        type: String,
        required: true,
        unique: true,
        default: uuidv4,
        immutable: true,
    },
    bio: {
      type: String,
      required: false,
      maxlength: [100, 'Bio must be less than 100 characters'],
    },
    location: {
      type: String,
      required: false,
      maxlength: [100, 'Location must be less than 100 characters'],
    },
    socials: {
      type: [{
        platform: { type: String, required: true },
        url: { type: String, required: true },
      }],
      required: false,
      default: [],
    },
    coverImage: {
      type: String,
      required: false,
    },
    profileImage: {
      type: String,
      required: false,
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      minlength: [2, 'Full name must be at least 2 characters'],
      maxlength: [50, 'Full name must be less than 50 characters'],
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      minlength: [5, 'Username must be at least 3 characters'],
      maxlength: [20, 'Username must be less than 20 characters'],
      match: [/^[a-z0-9_.]{6,20}$/, 'Username can only contain lowercase letters, numbers, underscores, and dots, and must be 1–16 characters.'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      email: [true, 'Please enter a valid email address'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
    },
    agreeToTerms: {
      type: Boolean,
      required: [true, 'You must agree to the terms and conditions'],
      default: false,
    },
    active: {
      type: Boolean,
      default: true,
    },
    reputation: {
      type: Number,
      default: 0,
    },
    role: {
      type: String,
      enum: ['USER', 'BUSINESS'],
      default: 'USER',
    }
  },
  {
    timestamps: true,
  }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

export default models.User ?? model<UserDocument>('User', userSchema);
