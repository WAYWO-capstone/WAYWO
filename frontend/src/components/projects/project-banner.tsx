import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { Pencil } from "lucide-react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { UploadDropzone } from "@/components/uploads/upload-dropzone";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";

export type ProjectBannerProps = {
  canManage?: boolean;
};

export default function ProjectBanner(props: ProjectBannerProps) {
  const [isHoveringBanner, setIsHoveringBanner] = useState(false);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!bannerUrl) return;
    return () => URL.revokeObjectURL(bannerUrl);
  }, [bannerUrl]);

  return (
    <div
      className="relative flex h-36 items-center justify-center bg-[#f8ede1] text-sm text-brand-mahogany/80 sm:h-44"
      onMouseEnter={() => setIsHoveringBanner(true)}
      onMouseLeave={() => setIsHoveringBanner(false)}
    >
      {bannerUrl ? (
        <img
          src={bannerUrl}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <span>[project banner image]</span>
      )}
      {props.canManage && (
        <BannerEditor
          isVisible={isHoveringBanner}
          onConfirm={(image) => setBannerUrl(URL.createObjectURL(image))}
        />
      )}
    </div>
  );
}

function BannerEditor({
  isVisible,
  onConfirm,
}: {
  isVisible: boolean;
  onConfirm: (image: Blob) => void;
}) {
  const DEFAULT_ASPECT_RATIO = 15 / 2;
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [cropError, setCropError] = useState<string | null>(null);

  useEffect(() => {
    if (!imageUrl) return;
    return () => URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  function handleFiles(files: File[]) {
    const file = files[0];
    if (!file || !file.type.startsWith("image/")) {
      setFileError("Choose an image file.");
      return;
    }

    setFileError(null);
    setImageUrl(URL.createObjectURL(file));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setCropError(null);
  }

  async function handleConfirm() {
    if (!imageUrl || !croppedAreaPixels) return;

    setIsConfirming(true);
    setCropError(null);
    try {
      const croppedImage = await cropImage(imageUrl, croppedAreaPixels);
      onConfirm(croppedImage);
      setIsOpen(false);
    } catch (error) {
      setCropError(
        error instanceof Error ? error.message : "Could not crop the image.",
      );
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger>
        <Button
          variant="secondary"
          className={`absolute top-3 right-4 drop-shadow-sm transition-opacity ${
            isVisible
              ? "opacity-100"
              : "pointer-events-none opacity-0 focus-visible:pointer-events-auto focus-visible:opacity-100"
          }`}
        >
          <Pencil /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[600px] max-w-full">
        <DialogHeader>
          <DialogTitle>Edit project banner</DialogTitle>
        </DialogHeader>
        <div className="relative h-56 w-full overflow-hidden rounded-md bg-muted sm:h-72">
          {imageUrl ? (
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={DEFAULT_ASPECT_RATIO}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              showGrid={false}
              onCropComplete={(_area, pixels) => setCroppedAreaPixels(pixels)}
            />
          ) : (
            <p className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
              Upload an image to preview and crop your banner.
            </p>
          )}
        </div>

        <UploadDropzone
          onFiles={handleFiles}
          label={imageUrl ? "Change banner" : "Upload banner"}
          accept="image/*"
          multiple={false}
          errors={fileError ? [fileError] : []}
        />
        {cropError && (
          <p role="alert" className="text-sm text-destructive">
            {cropError}
          </p>
        )}
        <div className="flex justify-end">
          <Button
            type="button"
            size={"lg"}
            className={"w-full"}
            disabled={!imageUrl || !croppedAreaPixels || isConfirming}
            onClick={() => void handleConfirm()}
          >
            {isConfirming ? "Preparing..." : "Confirm"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

async function cropImage(imageUrl: string, crop: Area): Promise<Blob> {
  const image = new Image();
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () =>
      reject(new Error("Could not load the selected image."));
  });
  image.src = imageUrl;
  await loaded;

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = Math.round(crop.width);
  outputCanvas.height = Math.round(crop.height);
  const outputContext = outputCanvas.getContext("2d");
  if (!outputContext) throw new Error("Could not prepare the cropped image.");
  outputContext.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    outputCanvas.width,
    outputCanvas.height,
  );

  return new Promise<Blob>((resolve, reject) => {
    outputCanvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not create the cropped image."));
      },
      "image/jpeg",
      0.92,
    );
  });
}
