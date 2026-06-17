import mongoose from "mongoose";

const LocationSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
    },
    division_id: {
      type: String,
      required: true,
    },
    division_name: {
      type: String,
      required: true,
    },
    district_name: {
      type: String,
      required: true,
    },
    Location: {
      type: String,
      required: true,
    },
    lat: {
      type: String,
      required: true,
    },
    lng: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Location = mongoose.models.Location || mongoose.model("Location", LocationSchema);

export default Location;
