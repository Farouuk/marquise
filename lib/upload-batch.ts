export type UploadItem = {
  id: string;
  file: File;
  courseId: string;
  courseName: string;
  status: "waiting" | "uploading" | "saved" | "duplicate" | "error";
  message?: string;
};

// A serial queue keeps extraction memory bounded and prevents revision conflicts
// between files in the same batch. Individual failures do not cancel later files.
export async function runUploadBatch(
  items: UploadItem[],
  uploadOne: (item: UploadItem) => Promise<{ duplicate?: boolean }>,
  onUpdate: (items: UploadItem[]) => void,
): Promise<UploadItem[]> {
  const result = items.map((item) => ({ ...item }));
  for (let i = 0; i < result.length; i++) {
    if (!["waiting", "error"].includes(result[i].status)) continue;
    result[i] = { ...result[i], status: "uploading", message: undefined };
    onUpdate([...result]);
    try {
      const uploaded = await uploadOne(result[i]);
      result[i] = {
        ...result[i],
        status: uploaded.duplicate ? "duplicate" : "saved",
      };
    } catch (error) {
      result[i] = {
        ...result[i],
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Envoi impossible. Réessaie.",
      };
    }
    onUpdate([...result]);
  }
  return result;
}
