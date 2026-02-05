import { createUploadthing } from "uploadthing/next";
const f = createUploadthing();

export const ourFileRouter = {
  // Define "mediaUploader" endpoint
  mediaUploader: f({ 
    video: { maxFileSize: "64MB", maxFileCount: 1 },
    pdf: { maxFileSize: "16MB", maxFileCount: 1 }
  })
    .onUploadComplete(async ({ file }) => {
      console.log("Upload complete:", file.url);
    }),
};