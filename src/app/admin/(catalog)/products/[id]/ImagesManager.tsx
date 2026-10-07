"use client";

import { useActionState, useRef, useState } from "react";
import { FormError } from "../../_components/ui";
import { CropEditor } from "./CropEditor";

export type ImageRow = {
  id: string;
  storage_path: string;
  alt_text: string | null;
  is_primary: boolean;
  sort_order: number;
  variant_id: string | null;
};

export type UploadState = { error?: string; ok?: boolean };

const MAX_FILE_MB = 10;

/** Image upload + list. Uploads go to the hardened server route (magic-byte + sharp). */
export function ImagesManager({
  productId,
  images,
  uploadAction,
  setPrimaryAction,
  deleteAction,
  publicUrl,
}: {
  productId: string;
  images: ImageRow[];
  uploadAction: (prev: UploadState, formData: FormData) => Promise<UploadState>;
  setPrimaryAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
  publicUrl: (path: string) => string;
}) {
  const [state, formAction, pending] = useActionState(uploadAction, {});
  const [clientError, setClientError] = useState<string | undefined>();
  const [croppingId, setCroppingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-4">
      <form
        action={formAction}
        className="flex flex-wrap items-end gap-3 rounded-md border border-line bg-card p-4"
        onSubmit={(e) => {
          const file = fileRef.current?.files?.[0];
          if (!file) {
            e.preventDefault();
            setClientError("Choose an image file first.");
            return;
          }
          if (file.size > MAX_FILE_MB * 1024 * 1024) {
            e.preventDefault();
            setClientError(`File is too large (max ${MAX_FILE_MB} MB).`);
            return;
          }
          setClientError(undefined);
        }}
      >
        <input type="hidden" name="product_id" value={productId} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Upload photo</span>
          <input
            ref={fileRef}
            type="file"
            name="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            required
            className="text-sm"
          />
          <span className="text-xs text-muted">JPEG, PNG, WebP or AVIF · max {MAX_FILE_MB} MB · checked + re-encoded on the server.</span>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Alt text</span>
          <input
            type="text"
            name="alt_text"
            maxLength={300}
            placeholder="Describe the photo"
            className="rounded-sm border border-line bg-surface px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-sm border border-line px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {pending ? "Uploading…" : "Upload"}
        </button>
      </form>
      <FormError message={clientError ?? state.error} />
      {state.ok && !state.error && (
        <p className="text-sm text-muted">Uploaded. It appears below.</p>
      )}

      {images.length === 0 ? (
        <p className="text-sm text-muted">
          No photos yet — the storefront shows a neutral “no photo yet” block (D19) until one is added.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-3">
          {images.map((img) => (
            <li key={img.id} className="overflow-hidden rounded-md border border-line bg-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={publicUrl(img.storage_path)}
                alt={img.alt_text ?? ""}
                className="aspect-square w-full object-cover"
                loading="lazy"
              />
              <div className="flex flex-col gap-2 p-3 text-sm">
                <span className="truncate text-xs text-muted">{img.alt_text || "No alt text"}</span>
                <span className="flex flex-wrap gap-2">
                  {img.is_primary ? (
                    <span className="rounded-sm border border-gold-600 bg-gold-600 px-2 py-1 text-xs font-semibold text-bronze-ink">
                      Primary
                    </span>
                  ) : (
                    <form action={setPrimaryAction}>
                      <input type="hidden" name="id" value={img.id} />
                      <input type="hidden" name="product_id" value={productId} />
                      <button type="submit" className="rounded-sm border border-line px-2 py-1 text-xs">
                        Set primary
                      </button>
                    </form>
                  )}
                  <button
                    type="button"
                    onClick={() => setCroppingId(croppingId === img.id ? null : img.id)}
                    aria-expanded={croppingId === img.id}
                    className="rounded-sm border border-line px-2 py-1 text-xs"
                  >
                    {croppingId === img.id ? "Hide crop" : "Crop"}
                  </button>
                  <form action={deleteAction}>
                    <input type="hidden" name="id" value={img.id} />
                    <input type="hidden" name="product_id" value={productId} />
                    <button type="submit" className="rounded-sm border border-red-900 px-2 py-1 text-xs text-red-300">
                      Delete
                    </button>
                  </form>
                </span>
                {croppingId === img.id && (
                  <span className="mt-2 block">
                    <CropEditor imageId={img.id} src={publicUrl(img.storage_path)} alt={img.alt_text ?? ""} />
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
