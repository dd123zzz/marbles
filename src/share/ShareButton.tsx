import { useEffect, useRef, useState } from 'react';
import { useToast } from '../components/Toast.tsx';
import { renderShareBlob, shareOrDownload, shareSignature, type ShareSpec } from './shareImage';
import './share.css';

interface ShareButtonProps {
  spec: ShareSpec;
  /** accessible name, e.g. "Share day image" */
  label: string;
  /** file name without extension */
  filename: string;
  /** title handed to the share sheet */
  title: string;
  /** milliseconds to wait after the data changes before re-rendering the image */
  debounceMs?: number;
}

const DEBOUNCE_MS = 300;

function ShareIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 15V4M8 8l4-4 4 4M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
    </svg>
  );
}

/** Builds the PNG ahead of the tap so the click can call navigator.share synchronously. */
export default function ShareButton({
  spec,
  label,
  filename,
  title,
  debounceMs = DEBOUNCE_MS,
}: ShareButtonProps) {
  const toast = useToast();
  const signature = shareSignature(spec);
  const specRef = useRef(spec);
  useEffect(() => {
    specRef.current = spec;
  });
  const [built, setBuilt] = useState<{ signature: string; file: File } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      renderShareBlob(specRef.current)
        .then((blob) => {
          if (!cancelled && blob) {
            setBuilt({
              signature,
              file: new File([blob], `${filename}.png`, { type: 'image/png' }),
            });
          }
        })
        .catch(() => {});
    }, debounceMs);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [signature, filename, debounceMs]);

  const file = built && built.signature === signature ? built.file : null;

  const onClick = () => {
    if (!file) return;
    shareOrDownload(file, title).catch((e: unknown) => {
      toast.error(`Could not share the image: ${e instanceof Error ? e.message : String(e)}`);
    });
  };

  return (
    <button
      type="button"
      className="icon-btn share-btn"
      aria-label={label}
      title={label}
      disabled={!file}
      onClick={onClick}
    >
      <ShareIcon />
    </button>
  );
}
