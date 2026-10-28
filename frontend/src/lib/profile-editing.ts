import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  updatePassword,
  updateEmail,
  updateProfile,
  uploadProfilePicture,
} from "@/lib/api";

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateProfile,
    onSuccess: async (saved) => {
      // reload the full account profile so the email is kept
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["current-profile"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["public-profile", saved.username.toLowerCase()],
        }),
      ]);
    },
  });
}

export function useUpdateProfilePicture() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadProfilePicture,
    onSuccess: async (saved) => {
      // refresh the header and profile pictures after uploading
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["current-profile"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["public-profile", saved.username.toLowerCase()],
        }),
      ]);
    },
  });
}

export function useUpdateEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateEmail,
    onSuccess: async () => {
      // reload the account profile after the email changes
      await queryClient.invalidateQueries({
        queryKey: ["current-profile"],
      });
    },
  });
}


export function useUpdatePassword() {
  return useMutation({
    mutationFn: updatePassword,
  });
}
