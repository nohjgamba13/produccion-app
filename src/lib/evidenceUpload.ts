import { supabase } from "./supabaseClient";

export type UploadEvidenceParams = {
  bucketName: string;
  file: File;
  orderId: string;
  stageKey: string;
  userId: string;
  tableName?: string;
};

export type UploadEvidenceResult = {
  filePath: string;
  publicUrl: string;
  fileName: string;
  contentType: string;
};

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function inferContentType(file: File, ext: string) {
  if (file.type) return file.type;
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "heic") return "image/heic";
  if (ext === "heif") return "image/heif";
  return "image/jpeg";
}

export async function uploadEvidenceMobileSafe({
  bucketName,
  file,
  orderId,
  stageKey,
  userId,
  tableName = "evidencias_produccion",
}: UploadEvidenceParams): Promise<UploadEvidenceResult> {
  if (!file) {
    throw new Error("No se seleccionó ningún archivo.");
  }

  const originalName = file.name || "evidencia.jpg";
  const safeName = sanitizeFileName(originalName);
  const extFromName = safeName.includes(".")
    ? safeName.split(".").pop()?.toLowerCase() ?? ""
    : "";

  let ext = extFromName || "jpg";
  let contentType = inferContentType(file, ext);

  if (contentType.includes("heic") || contentType.includes("heif")) {
    ext = contentType.includes("heif") ? "heif" : "heic";
  }

  const filePath = `orders/${orderId}/${stageKey}/${Date.now()}-${safeName}`;

  const uploadRes = await supabase.storage
    .from(bucketName)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType,
    });

  if (uploadRes.error) {
    throw uploadRes.error;
  }

  const publicRes = supabase.storage.from(bucketName).getPublicUrl(filePath);
  const publicUrl = publicRes.data?.publicUrl;

  if (!publicUrl) {
    await supabase.storage.from(bucketName).remove([filePath]);
    throw new Error("No se pudo obtener la URL pública de la evidencia.");
  }

  const insertRes = await supabase.from(tableName).insert({
    order_id: orderId,
    stage_key: stageKey,
    file_path: filePath,
    file_url: publicUrl,
    file_name: safeName,
    content_type: contentType,
    uploaded_by: userId,
  });

  if (insertRes.error) {
    await supabase.storage.from(bucketName).remove([filePath]);
    throw insertRes.error;
  }

  return {
    filePath,
    publicUrl,
    fileName: safeName,
    contentType,
  };
}

export async function loadEvidenceByStage(
  orderId: string,
  stageKey: string,
  tableName = "evidencias_produccion"
) {
  const res = await supabase
    .from(tableName)
    .select("id, file_path, file_url, file_name, content_type, created_at, uploaded_by")
    .eq("order_id", orderId)
    .eq("stage_key", stageKey)
    .order("created_at", { ascending: false });

  if (res.error) throw res.error;
  return res.data ?? [];
}
