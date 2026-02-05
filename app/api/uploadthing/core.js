import { createUploadthing } from "uploadthing/next";

const f = createUploadthing();

export const ourFileRouter = {
  mediaUploader: f({ 
    video: { maxFileSize: "64MB", maxFileCount: 1 },
    // ✅ CHANGED: Increased from 16MB to 32MB for high-res phone scans
    pdf: { maxFileSize: "32MB", maxFileCount: 1 } 
  })
    .onUploadComplete(async ({ file }) => {
      console.log("Upload complete:", file.url);
    }),
};