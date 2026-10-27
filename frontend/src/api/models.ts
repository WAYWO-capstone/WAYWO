// Backend API models, taken from the types generated from the OpenAPI schema.
// Regenerate them after changing a backend schema (see README, "API types").
import type { components } from "@/api/schema.gen";

type Schemas = components["schemas"];

// Auth
export type TokenResponse = Schemas["TokenResponse"];
export type UserResponse = Schemas["UserResponse"];
export type RegistrationInput = Schemas["UserCreate"];
export type EmailUpdate = Schemas["EmailChangeRequest"];
export type PasswordUpdate = Schemas["PasswordChangeRequest"];

// Profiles
export type PublicProfile = Schemas["ProfileResponse"];
export type AccountProfile = Schemas["AccountProfileResponse"];
export type ProfileUpdate = Schemas["ProfileUpdate"];

// Follows
export type FollowingStatus = Schemas["FollowingStatusResponse"];
export type CreatorFollow = Schemas["CreatorFollowResponse"];

// Projects
export type ProjectStatus = Schemas["ProjectStatus"];
export type ProjectCategory = Schemas["CategoryRead"];
export type ProjectTag = Schemas["TagRead"];
export type ProjectAuthor = Schemas["ProjectAuthorRead"];
// The project form always sends every field, including those with backend defaults.
export type ProjectInput = Required<Schemas["ProjectCreate"]>;
export type ProjectResult = Schemas["ProjectRead"];
export type ProjectView = Schemas["ProjectDetailRead"];
export type DraftProject = Schemas["ProjectRead"] & { status: "DRAFT" };
export type OwnedProject = Schemas["ProjectRead"];

// Project updates
export type UpdateType = Schemas["UpdateType"];
export type ProjectUpdate = Schemas["UpdateRead"];
export type UpdateHistoryPage = Schemas["UpdateHistoryPage"];
