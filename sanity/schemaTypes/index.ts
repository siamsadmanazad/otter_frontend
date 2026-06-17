import { type SchemaTypeDefinition } from "sanity";

import { blockContentType } from "./blockContentType";
import { imageType } from "./images";
import { videoType } from "./videos";

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [blockContentType, imageType, videoType],
};
