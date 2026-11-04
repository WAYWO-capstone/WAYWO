# Milestone
iteration 8

# US-32: Browse by Category

**User Story:** As a user, I want to browse projects by category so that I can discover projects related to a particular type of making.

## Story Details

**Story points**
5 SP

**Priority**
High — category browsing gives users a way to discover projects without knowing what to search for.

**Risk**
Depends on the project category field from US-08 and the visibility rules used by US-31. The list of categories must be agreed upon and kept consistent with the categories makers can select. Browsing must never show draft or private projects to users who cannot view them.

## Related Tasks and Estimates

- [ ] Task 1: Implement category browse API
  - Ideal time: 4 hours
  - Labels: `backend`, `discovery`, `2SP`
  - Details: Add endpoints to list categories and return the projects in a category, excluding projects the user cannot view.
  - Dependencies: US-08 category field
- [ ] Task 2: Build category browse UI
  - Ideal time: 4 hours
  - Labels: `frontend`, `discovery`, `2SP`
  - Details: Display the available categories, the projects in the selected category, and navigation between categories.
  - Dependencies: Task 1
- [ ] Task 3: Integrate category browsing
  - Ideal time: 2 hours
  - Labels: `integration`, `discovery`, `1SP`
  - Details: Connect the UI and API; verify category filtering, navigation, and visibility rules end to end.
  - Dependencies: API and UI

## References

- Related stories: US-08, US-31, US-33

## Unit Tests

- Verify that the API returns the list of available categories.
- Verify that selecting a category returns only projects in that category.
- Verify that draft and private projects are excluded for users who cannot view them.
- Verify that an empty or nonexistent category is handled appropriately.
- Verify that the UI lets users navigate between categories and updates the displayed projects.

# Acceptance Criteria

- [ ] User can select a project category.
- [ ] System displays projects belonging to that category.
- [ ] User can navigate between available categories.
- [ ] Only projects the user has permission to view are displayed.

**Labels:** `discovery`

---

# US-33: View Project Preview

**User Story:** As a user, I want to view project information before opening the full project so that I can decide whether it interests me.

## Story Details

**Story points**
5 SP

**Priority**
Medium — preview cards make search and browse results easier to scan once US-31 and US-32 are in place.

**Risk**
Depends on the results from US-31 and US-32. The preview must only expose public project information. This is the preview card in search and browse results, not the maker's pre-publish preview from US-21, so the two should not be confused during implementation.

## Related Tasks and Estimates

- [ ] Task 1: Design project preview card
  - Ideal time: 2 hours
  - Labels: `design`, `discovery`, `1SP`
  - Details: Define the card layout with title, creator, category, and a short description, and how it links to the full project.
  - Dependencies: None
- [ ] Task 2: Implement preview data
  - Ideal time: 2 hours
  - Labels: `backend`, `discovery`, `1SP`
  - Details: Return only the public preview fields in search and browse results.
  - Dependencies: US-31 and US-32 APIs
- [ ] Task 3: Build project preview card UI
  - Ideal time: 4 hours
  - Labels: `frontend`, `discovery`, `2SP`
  - Details: Implement a reusable preview card for search and browse results that opens the full project page.
  - Dependencies: Task 1
- [ ] Task 4: Integrate project previews
  - Ideal time: 2 hours
  - Labels: `integration`, `discovery`, `1SP`
  - Details: Verify cards appear in search and browse results, link to the correct project, and show no private information.
  - Dependencies: Preview data and UI

## References

- Related stories: US-21, US-31, US-32

## Unit Tests

- Verify that search and browse results include the preview fields (title, creator, category, and description).
- Verify that preview data does not include private project information.
- Verify that long descriptions are shortened consistently in the preview.
- Verify that selecting a preview card opens the correct full project page.
- Verify that the same preview card renders correctly in both search and browse results.

# Acceptance Criteria

- [ ] Search and browse results display a project preview.
- [ ] Preview includes relevant information such as title, creator, category, and description.
- [ ] User can select a project to view its full page.
- [ ] Preview does not expose private project information.

**Labels:** `discovery`

---

# US-22: Comment on Project Updates

**User Story:** As a user, I want to comment on a project update so that I can ask questions or contribute knowledge.

## Story Details

**Story points**
8 SP

**Priority**
High — comments are the foundation for discussions on WAYWO and are required by US-23.

**Risk**
Depends on the update model from US-15 and authentication. Required comment content, maximum length, and validation rules must be agreed upon before implementation. Comments must only be visible to users who can access the update. US-23 depends on this functionality.

## Related Tasks and Estimates

- [ ] Task 1: Design comments
  - Ideal time: 4 hours
  - Labels: `design`, `community`, `2SP`
  - Details: Define the comment form, discussion layout in the context of a project or update, the author's own-comment indicator, and success/error states.
  - Dependencies: None
- [ ] Task 2: Implement comment API and persistence
  - Ideal time: 6 hours
  - Labels: `backend`, `community`, `3SP`
  - Details: Add the create and list comment endpoints; store comments linked to the update and its project; enforce authentication, access rules, and validation.
  - Dependencies: Task 1, US-15 model
- [ ] Task 3: Build comment UI
  - Ideal time: 4 hours
  - Labels: `frontend`, `community`, `2SP`
  - Details: Implement the comment form, discussion list, own-comment indicator, and validation feedback.
  - Dependencies: Task 1
- [ ] Task 4: Integrate comments
  - Ideal time: 2 hours
  - Labels: `integration`, `community`, `1SP`
  - Details: Connect the UI and API; verify comments appear under the correct update and project end to end.
  - Dependencies: API and UI

## References

- Related stories: US-15, US-23
- Merged story: US-24 (criteria now included below)

## Unit Tests

- Verify that an authenticated user can comment on an update with valid content.
- Verify that missing or invalid comment content produces validation errors.
- Verify that guests and unauthenticated users cannot comment.
- Verify that the comment is persisted and associated with the correct update and project.
- Verify that comments are only returned to users who can access the update.
- Verify that the UI shows the discussion in context and marks the user's own comments.

# Acceptance Criteria

- [ ] Authenticated user can comment on an update.
- [ ] Comment is associated with the correct update.
- [ ] Comment is displayed to users who can access the update.
- [ ] Comment author can identify their own comment.
- [ ] User can access the discussion associated with a project or an update, shown in its relevant context.
- [ ] Discussion content remains associated with its project.

**Labels:** `community`

---

# US-23: Respond to Comments

**User Story:** As a maker, I want to respond to comments on my project so that I can discuss questions and feedback with other users.

## Story Details

**Story points**
5 SP

**Priority**
Medium — responses turn comments into discussions once US-22 is available.

**Risk**
Depends on the comment model and API from US-22. The team must decide whether only the project owner can respond or whether any user can reply; this plan follows the story and allows the project owner to respond. Responses should be one level deep unless the team agrees on threaded replies.

## Related Tasks and Estimates

- [ ] Task 1: Implement response API
  - Ideal time: 4 hours
  - Labels: `backend`, `community`, `2SP`
  - Details: Add the respond endpoint; link each response to its original comment and enforce project ownership and access rules.
  - Dependencies: US-22 API/model
- [ ] Task 2: Build response UI
  - Ideal time: 4 hours
  - Labels: `frontend`, `community`, `2SP`
  - Details: Add a respond action for the project owner and display responses with their original comments, visually distinct from them.
  - Dependencies: US-22 UI
- [ ] Task 3: Integrate responses
  - Ideal time: 2 hours
  - Labels: `integration`, `community`, `1SP`
  - Details: Verify responses are linked to the correct comment, displayed together, and visible to the right users end to end.
  - Dependencies: API and UI

## References

- Related story: US-22
- Merged story: US-24 (criterion now included below)

## Unit Tests

- Verify that the project owner can respond to a comment on their project.
- Verify that users other than the project owner cannot respond.
- Verify that the response is persisted and associated with the original comment.
- Verify that responses are only returned to users who can access the discussion.
- Verify that the UI displays comments and their responses together and distinguishes responses from original comments.

# Acceptance Criteria

- [ ] Project owner can respond to comments.
- [ ] Response is associated with the original comment.
- [ ] Users can distinguish responses from original comments.
- [ ] Response is visible to users who can access the discussion.
- [ ] Comments and responses are displayed together.

**Labels:** `community`
