import { parseAdditionalReferencePhotos, parseAssetPathStrings } from "@/lib/additional-reference-photos";
import {
  getSupportingPhotoConfig,
  groupSupportingPhotosByField,
  parseSupportingPhotos,
} from "@/lib/supporting-photos";
import type { JsonRecord } from "@/lib/types";

export type RequestImageAsset = {
  path: string;
  label: string;
  fileName: string;
  group: "reference" | "supporting";
};

function getFallbackFieldLabel(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getExtension(path: string) {
  const cleanPath = path.split("?")[0] ?? path;
  const fileName = cleanPath.split("/").pop() ?? "";
  const extension = fileName.match(/\.[a-z0-9]+$/i)?.[0];
  return extension?.toLowerCase() ?? ".jpg";
}

function safeFileName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function makeImageAsset({
  path,
  label,
  group,
  index,
}: {
  path: string;
  label: string;
  group: RequestImageAsset["group"];
  index: number;
}): RequestImageAsset {
  const baseName = safeFileName(label) || `${group}-photo`;
  return {
    path,
    label,
    group,
    fileName: `${String(index).padStart(2, "0")}-${baseName}${getExtension(path)}`,
  };
}

export function getRequestImageAssets(formData: JsonRecord): RequestImageAsset[] {
  const assetPathSet = new Set(parseAssetPathStrings(formData.asset_paths));
  const images: RequestImageAsset[] = [];

  const addImage = (path: string, label: string, group: RequestImageAsset["group"]) => {
    if (!path || !assetPathSet.has(path) || images.some((image) => image.path === path)) {
      return;
    }

    images.push(
      makeImageAsset({
        path,
        label,
        group,
        index: images.length + 1,
      }),
    );
  };

  if (typeof formData.young_photo_path === "string") {
    addImage(formData.young_photo_path, "Younger Photo", "reference");
  }

  if (typeof formData.current_photo_path === "string") {
    addImage(formData.current_photo_path, "Current Photo", "reference");
  }

  for (const photo of parseAdditionalReferencePhotos(formData.additional_reference_photos)) {
    addImage(photo.path, `Reference Photo Age ${photo.age}`, "reference");
  }

  for (const [fieldKey, photos] of groupSupportingPhotosByField(
    parseSupportingPhotos(formData.supporting_photos),
  )) {
    const sectionLabel = getSupportingPhotoConfig(fieldKey)?.label ?? getFallbackFieldLabel(fieldKey);
    photos.forEach((photo, index) => {
      addImage(photo.path, `${sectionLabel} ${index + 1}`, "supporting");
    });
  }

  return images;
}
