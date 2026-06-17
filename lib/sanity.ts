import { createClient } from "next-sanity";

import { apiVersion, dataset, projectId } from "../env.local";

export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  token: process.env.NEXT_PUBLIC_SANITY_TOKEN,
  useCdn: true,
});
