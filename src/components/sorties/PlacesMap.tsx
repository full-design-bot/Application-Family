"use client";

import dynamic from "next/dynamic";
import { Spinner } from "@/components/ui";

export type { MapPlace } from "./PlacesMapInner";

/** Carte des lieux (Leaflet chargé sans rendu serveur). */
export const PlacesMap = dynamic(() => import("./PlacesMapInner"), {
  ssr: false,
  loading: () => (
    <div className="flex size-full items-center justify-center bg-card-2">
      <Spinner />
    </div>
  ),
});
