import { TYPES, tier } from "./catalog";

// All sticker art, resolved to hashed URLs by Vite. Files live in
// frontend/images as 00.jpeg .. NN.jpeg (sorted by name).
const modules = import.meta.glob("../../images/*.{jpg,jpeg,png}", {
  eager: true,
  query: "?url",
  import: "default",
});
const urls = Object.keys(modules)
  .sort()
  .map((k) => modules[k] as string);

// Map images to types, giving the rarer slots a unique face first. With fewer
// images than the 20 types, only the lowest commons reuse a face.
const rank = (t: number) => (tier(t) === "Legendary" ? 2 : tier(t) === "Rare" ? 1 : 0);
const order = [...TYPES].sort((a, b) => rank(b) - rank(a) || a - b);
const byType: Record<number, string> = {};
order.forEach((t, i) => {
  byType[t] = urls.length ? urls[i % urls.length] : "";
});

export const HAS_ART = urls.length > 0;

export function stickerImage(typeId: number): string {
  return byType[typeId] ?? "";
}
