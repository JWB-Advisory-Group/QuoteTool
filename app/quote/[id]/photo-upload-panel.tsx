"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useId, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import type { EstimateConfidence } from "@/lib/types";
import {
  type ClientPhoto,
  type PhotoReadResult,
  clientPhotosToAttachments,
  readPhoto,
} from "@/app/quote/photo-pipeline";

type UploadStatus = "idle" | "processing" | "uploading" | "success" | "error";

export function PhotoUploadPanel({
  quoteId,
  existingPhotoCount,
  requiredPhotos,
  estimateConfidence,
  surveyRequired,
}: {
  quoteId: string;
  existingPhotoCount: number;
  requiredPhotos: string[];
  estimateConfidence: EstimateConfidence;
  surveyRequired: boolean;
}) {
  const inputId = useId();
  const [photos, setPhotos] = useState<ClientPhoto[]>([]);
  const [photoCount, setPhotoCount] = useState(existingPhotoCount);
  const [confidence, setConfidence] =
    useState<EstimateConfidence>(estimateConfidence);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [message, setMessage] = useState("");
  const photosRef = useRef<ClientPhoto[]>([]);
  const photoSelectionLimit = Math.max(0, 6 - photoCount);
  const remainingSlots = Math.max(0, photoSelectionLimit - photos.length);
  const maxAddNow = Math.min(4, remainingSlots);
  const hasAttachedPhotos = photoCount > 0;
  const checklist = requiredPhotos.length
    ? requiredPhotos.slice(0, 4)
    : ["Front of property", "side access", "worst staining", "any obstacles"];

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    return () => {
      for (const photo of photosRef.current) {
        URL.revokeObjectURL(photo.previewUrl);
      }
    };
  }, []);

  async function handlePhotos(files: FileList | null) {
    setMessage("");
    if (!files || files.length === 0) return;
    if (remainingSlots <= 0) {
      setStatus("error");
      setMessage("Photo limit reached. Dante already has enough shots.");
      return;
    }

    const nextFiles = Array.from(files).slice(0, maxAddNow);
    setStatus("processing");
    setMessage(
      `Processing ${nextFiles.length} photo${nextFiles.length === 1 ? "" : "s"}...`,
    );

    const results = await Promise.all(nextFiles.map(readPhoto));
    const accepted = results
      .filter(
        (result): result is Extract<PhotoReadResult, { kind: "ok" }> =>
          result.kind === "ok",
      )
      .map((result) => result.photo);
    const rejected = results.filter(
      (result): result is Extract<PhotoReadResult, { kind: "error" }> =>
        result.kind === "error",
    );

    if (accepted.length > 0) {
      setPhotos((current) => [...current, ...accepted].slice(0, photoSelectionLimit));
    }

    const skippedForLimit =
      files.length > nextFiles.length
        ? ` Photo upload is capped at ${maxAddNow} more right now.`
        : "";
    if (rejected.length > 0) {
      setStatus(accepted.length > 0 ? "idle" : "error");
      setMessage(
        `${accepted.length > 0 ? `Added ${accepted.length}. ` : ""}${rejected
          .slice(0, 2)
          .map((item) => `${item.name}: ${item.reason}`)
          .join(" ")}${skippedForLimit}`,
      );
      return;
    }

    setStatus("idle");
    setMessage(
      `Added ${accepted.length} photo${accepted.length === 1 ? "" : "s"} for review.${skippedForLimit}`,
    );
  }

  function removePhoto(id: string) {
    setPhotos((current) => {
      const removed = current.find((photo) => photo.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((photo) => photo.id !== id);
    });
    setStatus("idle");
    setMessage("");
  }

  async function uploadPhotos() {
    if (photos.length === 0) {
      setStatus("error");
      setMessage("Add at least one photo first, or skip this step.");
      return;
    }

    setStatus("uploading");
    setMessage("");
    try {
      const photoAttachments = await clientPhotosToAttachments(photos);
      const response = await fetch(`/api/quotes/${quoteId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoAttachments }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Could not upload photos.");
      }

      for (const photo of photos) {
        URL.revokeObjectURL(photo.previewUrl);
      }
      setPhotos([]);
      setPhotoCount(Number(json.photoCount ?? photoCount + photoAttachments.length));
      if (json.estimate?.estimateConfidence) {
        setConfidence(json.estimate.estimateConfidence);
      }
      setStatus("success");
      setMessage(
        surveyRequired
          ? "Photos uploaded. Dante can use these to prepare the scope review."
          : "Photos uploaded. Dante can now turn this from an estimate into an actual quote.",
      );
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not upload photos. You can still skip this and Dante will follow up.",
      );
    }
  }

  return (
    <div className="rounded-lg border border-[#d8d4c7] bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#eef6e3] text-[#3a6c2c]">
          <Camera size={17} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#62685f]">
            Optional photos
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">
            Upload photos for an actual quote
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#62685f]">
            {surveyRequired
              ? "Photos are optional, but they help Dante prepare the scope review. This service may still need a short walk-through before the actual quote."
              : "Photos are optional. Upload 2-4 clear shots if you want Dante to turn this estimate into an actual quote. Skip them if you prefer an estimated quote and quick follow-up."}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-md border border-[#e4e0d5] bg-[#fbfaf7] px-3 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck size={15} />
          {hasAttachedPhotos
            ? `${photoCount} photo${photoCount === 1 ? "" : "s"} attached`
            : "No photos attached yet"}
        </div>
        <p className="mt-1 text-xs leading-5 text-[#62685f]">
          {`Current estimate confidence: ${confidence}.`}
        </p>
      </div>

      <div className="mt-4">
        <div className="text-sm font-semibold">Most useful shots</div>
        <div className="mt-2 grid gap-2">
          {checklist.map((item) => (
            <div
              key={item}
              className="rounded-md border border-[#e4e0d5] bg-[#fbfaf7] px-3 py-2 text-xs font-semibold text-[#62685f]"
            >
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label
          htmlFor={inputId}
          className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition ${
            remainingSlots > 0
              ? "cursor-pointer border border-[#cbc7bb] bg-white hover:border-[#1d211c]"
              : "cursor-not-allowed border border-[#e4e0d5] bg-[#f1efe6] text-[#8a877d]"
          }`}
        >
          <Upload size={15} />
          Add photos
          <input
            id={inputId}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="sr-only"
            disabled={remainingSlots <= 0 || status === "processing" || status === "uploading"}
            onChange={(event) => handlePhotos(event.target.files)}
          />
        </label>
        <button
          type="button"
          onClick={uploadPhotos}
          disabled={photos.length === 0 || status === "uploading" || status === "processing"}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-[#1d211c] px-4 text-sm font-semibold text-white transition hover:bg-[#30372e] disabled:cursor-not-allowed disabled:bg-[#9a978e]"
        >
          {status === "uploading" ? <Loader2 size={15} className="animate-spin" /> : null}
          Upload for actual quote
        </button>
      </div>

      {message ? (
        <p
          role={status === "error" ? "alert" : "status"}
          className={`mt-3 rounded-md px-3 py-2 text-xs font-semibold ${
            status === "error"
              ? "bg-[#fff5f5] text-[#b42318]"
              : status === "success"
                ? "bg-[#eef6e3] text-[#3a6c2c]"
                : "bg-[#f1efe6] text-[#62685f]"
          }`}
        >
          {message}
        </p>
      ) : null}

      {photos.length > 0 ? (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="group relative aspect-square overflow-hidden rounded-md border border-[#d8d4c7] bg-white"
            >
              <img
                src={photo.previewUrl}
                alt={photo.name}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removePhoto(photo.id)}
                className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-[#1d211c] shadow-sm"
                aria-label={`Remove ${photo.name}`}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {status === "success" ? (
        <div className="mt-4 flex items-start gap-2 text-sm font-semibold text-[#315b22]">
          <CheckCircle2 size={16} className="mt-0.5" />
          Your photos are attached to this quote.
        </div>
      ) : null}
    </div>
  );
}
