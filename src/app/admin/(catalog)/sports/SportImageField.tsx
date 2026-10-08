"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { publicImageUrl } from "@/lib/storefront/images";
import { Field } from "../_components/ui";

export type SportImageState = { error?: string; ok?: boolean };

function Save({ label, tone = "gold" }: { label: string; tone?: "gold" | "plain" }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        tone === "gold"
          ? "rounded-sm bg-gold-600 px-4 py-2 text-sm font-semibold text-bronze-ink disabled:opacity-60"
          : "rounded-sm border border-line px-4 py-2 text-sm disabled:opacity-60"
      }
    >
      {pending ? "Working…" : label}
    </button>
  );
}

/**
 * Sport photo for the homepage "Shop by Sport" tile.
 *
 * Upload is a separate form from the main sport form on purpose: the file has
 * to be processed and stored before the sport row can point at it, and mixing
 * it into the text form would make "Save changes" fail for reasons the owner
 * cannot see. It is only offered once the sport exists (uploading needs the id).
 */
export function SportImageField({
  sportId,
  imagePath,
  altText,
  uploadAction,
  removeAction,
}: {
  sportId: string;
  imagePath: string | null;
  altText: string;
  uploadAction: (prev: SportImageState, formData: FormData) => Promise<SportImageState>;
  removeAction: (prev: SportImageState, formData: FormData) => Promise<SportImageState>;
}) {
  const [uploadState, upload] = useActionState(uploadAction, {});
  const [removeState, remove] = useActionState(removeAction, {});
  const fileInput = useRef<HTMLInputElement>(null);

  // Reset the file input after a successful upload so picking the same file
  // again (after editing it) still submits.
  useEffect(() => {
    if (uploadState.ok && fileInput.current) fileInput.current.value = "";
  }, [uploadState]);

  const message = uploadState.error ?? removeState.error;
  const done = uploadState.ok || removeState.ok;

  return (
    <section className="mt-8 max-w-2xl rounded-sm border border-line p-4">
      <h2 className="font-display text-xl font-bold">Tile photo</h2>
      <p className="mt-1 text-sm text-muted">
        Shown in the homepage &ldquo;Shop by sport&rdquo; tiles. Landscape works best. JPEG, PNG,
        WebP or AVIF, up to 10 MB.
      </p>

      {imagePath ? (
        <div className="mt-4 flex flex-wrap items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- pre-made derivative, served directly (see lib/storefront/images.ts) */}
          <img
            src={publicImageUrl(imagePath)}
            alt={altText || ""}
            width={240}
            height={160}
            className="rounded-sm border border-line object-cover"
          />
          <form action={remove}>
            <input type="hidden" name="sport_id" value={sportId} />
            <Save label="Remove photo" tone="plain" />
          </form>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">
          No photo yet — the tile falls back to the sport&rsquo;s name.
        </p>
      )}

      <form action={upload} className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
        <input type="hidden" name="sport_id" value={sportId} />
        <Field label={imagePath ? "Replace photo" : "Upload photo"}>
          <input
            ref={fileInput}
            type="file"
            name="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="text-sm"
          />
        </Field>
        <Field
          label="Image alt text"
          hint="Describes the photo. The homepage tile already shows the sport name, so on tiles this text is not repeated."
        >
          <input
            type="text"
            name="image_alt"
            maxLength={300}
            defaultValue={altText}
            className="rounded-sm border border-line bg-surface px-3 py-2"
          />
        </Field>
        {message && (
          <p role="alert" className="text-sm font-semibold text-red-300">
            {message}
          </p>
        )}
        {done && !message && (
          <p role="status" className="text-sm font-semibold text-emerald-300">
            Saved.
          </p>
        )}
        <div>
          <Save label={imagePath ? "Replace photo" : "Upload photo"} />
        </div>
      </form>
    </section>
  );
}
