import type { Document } from "mongoose";

export interface ISanityVideoAsset {
  _type: string;
  video: {
    _type: string;
    asset: {
      _type: string;
      _ref: string;
    };
    alt: string;
  };
}

export interface ISanityImageAsset {
  _type: string;
  mainImage: {
    _type: string;
    asset: {
      _type: string;
      _ref: string;
    };
    alt: string;
  };
}

export interface MediaDocument extends Document {
  serial: string;
  mediaType: string;
  documentId: string;
  assetId: string;
}
