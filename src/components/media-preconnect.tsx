"use client";

import { preconnect } from "react-dom";
import { mediaOrigin } from "@/lib/media";

// Videos and posters load from the external media host; open that connection
// early. Resource hints must be issued from a Client Component.
export function MediaPreconnect() {
  if (mediaOrigin) preconnect(mediaOrigin);
  return null;
}
