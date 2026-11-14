import { useQuery } from "@tanstack/react-query";
import { getUploadConfig } from "@/api/uploads";

// Upload rules only change with a backend deploy, so they never go stale.
export function useUploadConfig() {
  return useQuery({
    queryKey: ["upload-config"],
    queryFn: getUploadConfig,
    staleTime: Infinity,
  });
}
