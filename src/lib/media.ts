"use client";

// Photos et images : compression côté iPhone, envoi dans le stockage privé
// Supabase (bucket "media") et lecture via des liens signés temporaires.
//
// Dossiers (voir les règles d'accès du stockage dans la migration) :
//   couple/…    réservé aux parents (messages, photos éphémères, dessins)
//   capsules/…  capsules temporelles (lisibles après la date d'ouverture)
//   family/…    toute la famille (enfants, sorties, listes)

import { useEffect, useState } from "react";
import { supabase } from "./supabase/client";

export type MediaFolder = "couple" | "capsules" | "family";

/** Réduit une image (max 1600 px) et la convertit en JPEG. */
export async function compressImage(file: Blob, maxSize = 1600, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", quality));
}

/** Envoie un fichier et renvoie son chemin dans le bucket. */
export async function uploadMedia(folder: MediaFolder, blob: Blob, ext = "jpg", subfolder?: string): Promise<string> {
  const path = `${folder}/${subfolder ? subfolder + "/" : ""}${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase()
    .storage.from("media")
    .upload(path, blob, { contentType: blob.type || (ext === "png" ? "image/png" : "image/jpeg"), upsert: false });
  if (error) throw error;
  return path;
}

/** Compresse puis envoie une photo choisie par l'utilisateur. */
export async function uploadPhoto(folder: MediaFolder, file: File, subfolder?: string): Promise<string> {
  const blob = await compressImage(file);
  return uploadMedia(folder, blob, "jpg", subfolder);
}

export async function deleteMedia(path: string) {
  await supabase().storage.from("media").remove([path]);
}

const urlCache = new Map<string, { url: string; exp: number }>();

/** Lien signé (valable 1 h) vers un fichier privé. */
export async function signedUrl(path: string): Promise<string | null> {
  const cached = urlCache.get(path);
  if (cached && cached.exp > Date.now()) return cached.url;
  const { data } = await supabase().storage.from("media").createSignedUrl(path, 3600);
  if (!data?.signedUrl) return null;
  urlCache.set(path, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}

/** Hook : const url = useSignedUrl(message.media_path) */
export function useSignedUrl(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(path ? (urlCache.get(path)?.url ?? null) : null);
  useEffect(() => {
    let alive = true;
    if (!path) {
      setUrl(null);
      return;
    }
    signedUrl(path).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [path]);
  return url;
}
