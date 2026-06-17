import { model, models, Schema } from 'mongoose';

export const verificationSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: function (v: string) {
          return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v);
        },
        message: 'Please enter a valid email address',
      },
    },
    token: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: ['USED', 'EXPIRED', 'PENDING'],
        message: '{VALUE} is not a valid verification status',
      },
    },
  },
  {
    timestamps: true,
  },
);

verificationSchema.index({ email: 1 });
export default models.Verifications ??
  model("Verifications", verificationSchema);
