import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateProfile, type PublicProfile } from "@/lib/api";

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateProfile,
    onSuccess: async (saved) => {
      // keep private account details out of the public profile cache
      queryClient.setQueryData<PublicProfile>(
        ["public-profile", saved.username.toLowerCase()],
        {
          username: saved.username,
          bio: saved.bio,
          profile_picture_link: saved.profile_picture_link,
        },
      );

      // reload the full account profile so its email is kept
      await queryClient.invalidateQueries({
        queryKey: ["current-profile"],
      });
    },
  });
}