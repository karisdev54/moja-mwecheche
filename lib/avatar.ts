// Turns any photo into a square 512 x 512 JPEG, centred automatically (a little higher for portraits, where faces are)
export async function squareAvatar(file: File, size = 512): Promise<File> {
  let source: CanvasImageSource;
  let w: number;
  let h: number;
  let cleanup = () => {};

  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    source = bmp;
    w = bmp.width;
    h = bmp.height;
    cleanup = () => bmp.close();
  } catch {
    // Older browsers: decode through an image element
    const url = URL.createObjectURL(file);
    const img = new Image();
    await new Promise<void>((ok, fail) => {
      img.onload = () => ok();
      img.onerror = () => fail(new Error("decode"));
      img.src = url;
    });
    source = img;
    w = img.naturalWidth;
    h = img.naturalHeight;
    cleanup = () => URL.revokeObjectURL(url);
  }

  try {
    const side = Math.min(w, h);
    const sx = (w - side) / 2;
    const sy = h > w ? (h - side) * 0.35 : 0;

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, sx, sy, side, side, 0, 0, size, size);

    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.88));
    if (!blob) throw new Error("encode");
    return new File([blob], "avatar.jpg", { type: "image/jpeg" });
  } finally {
    cleanup();
  }
}