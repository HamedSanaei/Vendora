import { http, resolveApiImageUrl } from "./http";

/** Public slideshow metadata; the API orders records by sortOrder and then id. */
export interface SlideshowSlideDto {
  id: string;
  imageUrl: string;
  sortOrder: number;
  durationSeconds: number;
}

/** Loads ordered homepage photos and resolves upload paths; signal cancels an unmounted hero's request. */
export async function getSlideshow(signal?: AbortSignal): Promise<SlideshowSlideDto[]> {
  const { data } = await http.get<SlideshowSlideDto[]>("/slideshow", { signal });
  return data.map((slide) => ({ ...slide, imageUrl: resolveApiImageUrl(slide.imageUrl) }));
}
