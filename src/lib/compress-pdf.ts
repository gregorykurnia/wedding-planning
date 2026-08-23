"use client";

import type { jsPDF as JsPDF } from "jspdf";

// Cloudinary's free-plan unsigned upload limit.
export const CLOUDINARY_FREE_PLAN_MAX_BYTES = 10 * 1024 * 1024;

const ATTEMPTS = [
  { scale: 1.5, quality: 0.7 },
  { scale: 1.2, quality: 0.5 },
  { scale: 1, quality: 0.35 },
];

/**
 * Rasterizes each page of a PDF and rebuilds a new, JPEG-backed PDF at
 * decreasing quality until it fits under maxBytes (or the last attempt runs
 * out). Works well for scan/photo-heavy PDFs like price lists; loses text
 * selectability since pages become images.
 */
export async function compressPdf(
  file: File,
  maxBytes: number = CLOUDINARY_FREE_PLAN_MAX_BYTES,
): Promise<File> {
  const [{ jsPDF }, pdfjsLib] = await Promise.all([
    import("jspdf"),
    import("pdfjs-dist"),
  ]);
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const buffer = await file.arrayBuffer();

  let bestBlob: Blob | null = null;

  for (const { scale, quality } of ATTEMPTS) {
    const pdf = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
    let doc: JsPDF | null = null;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const unscaled = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas rendering isn't supported in this browser.");

      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      const dataUrl = canvas.toDataURL("image/jpeg", quality);

      const format: [number, number] = [unscaled.width, unscaled.height];
      if (!doc) {
        doc = new jsPDF({ unit: "pt", format });
      } else {
        doc.addPage(format);
      }
      doc.addImage(dataUrl, "JPEG", 0, 0, unscaled.width, unscaled.height);
    }

    await pdf.destroy();
    if (!doc) break;

    const blob = doc.output("blob");
    bestBlob = blob;
    if (blob.size <= maxBytes) {
      return new File([blob], file.name, { type: "application/pdf" });
    }
  }

  if (bestBlob) {
    return new File([bestBlob], file.name, { type: "application/pdf" });
  }
  return file;
}
