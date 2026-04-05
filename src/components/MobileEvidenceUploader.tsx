"use client";

import { useRef, useState } from "react";
import { loadEvidenceByStage, uploadEvidenceMobileSafe } from "../lib/evidenceUpload";

type Props = {
  orderId: string;
  stageKey: string;
  userId: string;
  bucketName?: string;
  tableName?: string;
  onUploaded?: (rows: any[]) => void | Promise<void>;
  buttonLabel?: string;
};

export default function MobileEvidenceUploader({
  orderId,
  stageKey,
  userId,
  bucketName = "evidencias",
  tableName = "evidencias_produccion",
  onUploaded,
  buttonLabel = "Subir evidencia",
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = async (file: File | null) => {
    if (!file) return;

    setUploading(true);
    setErrorMsg("");
    try {
      await uploadEvidenceMobileSafe({
        bucketName,
        file,
        orderId,
        stageKey,
        userId,
        tableName,
      });

      const rows = await loadEvidenceByStage(orderId, stageKey, tableName);
      if (onUploaded) {
        await onUploaded(rows);
      }

      alert("Evidencia cargada correctamente.");
    } catch (error) {
      console.error("Error subiendo evidencia:", error);
      setErrorMsg(error instanceof Error ? error.message : "No se pudo subir la evidencia.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="grid gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
        className="block w-full text-sm"
      />

      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="px-4 py-3 rounded-xl bg-black text-white disabled:opacity-50"
      >
        {uploading ? "Subiendo..." : buttonLabel}
      </button>

      {errorMsg ? (
        <div className="border border-red-300 bg-red-50 text-red-700 rounded-xl p-3 text-sm">
          <b>Error:</b> {errorMsg}
        </div>
      ) : null}
    </div>
  );
}
