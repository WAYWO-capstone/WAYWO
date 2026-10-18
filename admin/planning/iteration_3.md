# Milestone
iteration 3

# US-15: Add progress updates

**User Story:** As a maker, I want to add progress updates to my project so that I can document its development over time.

## Story Details

**Story points**
8 SP

**Priority**
High — creating progress updates is the foundation for documenting a project's development and enables several other stories in this iteration.

**Risk**
Depends on the existing project model, database connection, authentication, and project authorization. Required update fields and validation rules must be agreed upon before implementation. US-16, US-17, US-18, US-19, and US-20 depend on this functionality.

## Related Tasks and Estimates

- [ ] Task 1: Design progress updates
  - Ideal time: 4 hours
  - Labels: `design`, `documenting`, `2SP`
  - Details: Define the form, required fields, validation, and success/error states.
  - Dependencies: None
- [ ] Task 2: Implement progress update API
  - Ideal time: 6 hours
  - Labels: `backend`, `documenting`, `3SP`
  - Details: Add the create-update endpoint and schemas; enforce authentication and project ownership.
  - Dependencies: Task 1
- [ ] Task 3: Implement persistence and validation
  - Ideal time: 4 hours
  - Labels: `backend`, `documenting`, `2SP`
  - Details: Store updates and validate required content; return useful validation errors.
  - Dependencies: Update model/API design
- [ ] Task 4: Build progress update UI
  - Ideal time: 6 hours
  - Labels: `frontend`, `documenting`, `3SP`
  - Details: Implement the form, submission, validation feedback, and status states.
  - Dependencies: Task 1
- [ ] Task 5: Integrate progress updates
  - Ideal time: 4 hours
  - Labels: `integration`, `documenting`, `2SP`
  - Details: Connect the UI and API; verify the update appears under the correct project.
  - Dependencies: API, persistence, and UI

## References

- Related stories: US-16, US-17, US-18, US-19, US-20

## Unit Tests

- Verify that an authenticated project owner can create an update with valid required content.
- Verify that missing or invalid required fields produce validation errors.
- Verify that unauthenticated users cannot create updates.
- Verify that a user cannot create an update for a project they do not own or cannot access.
- Verify that the created update is persisted and associated with the specified project.
- Verify that the API/UI handles successful submission and failed submission correctly.

# Acceptance Criteria

- [ ] Project owner can create a new update.
- [ ] Update contains the required content.
- [ ] Update is associated with the correct project.
- [ ] New update appears in the project's history.

**Labels:** `documenting`

---

# US-16: Attach Media

**User Story:** As a maker, I want to attach images and other media to an update so that I can visually document my progress.

## Story Details

**Story points**
8 SP

**Priority**
High — media attachments make progress documentation more useful and depend on the update creation workflow.

**Risk**
Depends on US-15 and the update model/API. Supported media types, maximum file size, storage location, and media access rules must be defined. File validation and upload failures must be handled safely.

## Related Tasks and Estimates

- [ ] Task 1: Design media attachment flow
  - Ideal time: 4 hours
  - Labels: `design`, `documenting`, `2SP`
  - Details: Define file selection, supported-file guidance, upload progress, and error states.
  - Dependencies: US-15 design
- [ ] Task 2: Implement media upload API
  - Ideal time: 6 hours
  - Labels: `backend`, `documenting`, `3SP`
  - Details: Upload supported media, associate it with an update, and validate file type and size.
  - Dependencies: US-15 API/model
- [ ] Task 3: Build media attachment UI
  - Ideal time: 6 hours
  - Labels: `frontend`, `documenting`, `3SP`
  - Details: Add file selection, upload feedback, and media display.
  - Dependencies: Media design
- [ ] Task 4: Integrate media uploads
  - Ideal time: 4 hours
  - Labels: `integration`, `documenting`, `2SP`
  - Details: Connect the UI and endpoint; verify association and error handling.
  - Dependencies: Upload API and UI

## References

- Related story: US-15

## Unit Tests

- Verify that supported media types within the size limit can be uploaded.
- Verify that unsupported file types and oversized files are rejected with useful errors.
- Verify that uploaded media is associated with the correct update.
- Verify that users cannot attach media to updates they are not authorized to modify.
- Verify that media metadata is persisted and media can be retrieved for display.
- Verify that the UI displays upload progress, success, and failure states.

# Acceptance Criteria

- [ ] Maker can attach supported media types to an update.
- [ ] Uploaded media is associated with the correct update.
- [ ] Media can be viewed when viewing the update.
- [ ] Unsupported files are rejected with an appropriate message.

**Labels:** `documenting`

---

# US-17: Edit or Delete Updates

**User Story:** As a maker, I want to edit or delete my updates so that I can correct or update information.

## Story Details

**Story points**
8 SP

**Priority**
High — makers need to maintain accurate project documentation after an update has been created.

**Risk**
Depends on the update model and API from US-15. Authorization must be enforced server-side so users cannot modify or delete another user's updates. Deletion confirmation should prevent accidental removal.

## Related Tasks and Estimates

- [ ] Task 1: Design edit/delete interactions
  - Ideal time: 4 hours
  - Labels: `design`, `documenting`, `2SP`
  - Details: Define edit mode, delete confirmation, cancellation, and feedback.
  - Dependencies: US-15 UI
- [ ] Task 2: Implement edit/delete API
  - Ideal time: 6 hours
  - Labels: `backend`, `documenting`, `3SP`
  - Details: Add edit/delete endpoints with authentication and ownership checks.
  - Dependencies: US-15 API/model
- [ ] Task 3: Build edit/delete UI
  - Ideal time: 6 hours
  - Labels: `frontend`, `documenting`, `3SP`
  - Details: Let owners edit content and confirm deletion.
  - Dependencies: Design interactions
- [ ] Task 4: Integrate edit/delete workflow
  - Ideal time: 4 hours
  - Labels: `integration`, `documenting`, `2SP`
  - Details: Verify saved changes, deletion, and permission errors end to end.
  - Dependencies: API and UI

## References

- Related story: US-15

## Unit Tests

- Verify that the owner can update an existing update and that changes persist.
- Verify that the owner can delete an update.
- Verify that non-owners and unauthenticated users cannot edit or delete the update.
- Verify that requests for nonexistent updates return an appropriate error.
- Verify that the UI asks for confirmation before deletion and supports cancellation.
- Verify that the project history reflects edits and deletions after successful operations.

# Acceptance Criteria

- [ ] Update owner can edit an existing update.
- [ ] Changes are saved and displayed correctly.
- [ ] Update owner can delete an update.
- [ ] System requests confirmation before deletion.
- [ ] Other users cannot modify or delete the update.

**Labels:** `documenting`

---

# US-18: Associate Updates with Projects

**User Story:** As a maker, I want my updates to remain associated with my project so that the project's development history is preserved.

## Story Details

**Story points**
5 SP

**Priority**
High — a reliable project-update relationship is necessary for project history and for later documentation features.

**Risk**
Depends on the update model and creation API in US-15. Project access checks must prevent updates from being linked to projects without authorization. This story may overlap with association work already completed as part of US-15, so implementation should avoid duplication.

## Related Tasks and Estimates

- [ ] Task 1: Implement project-update association
  - Ideal time: 4 hours
  - Labels: `backend`, `documenting`, `2SP`
  - Details: Enforce the update-to-project relationship and validate access to the target project.
  - Dependencies: US-15 model/API
- [ ] Task 2: Display updates on project page
  - Ideal time: 4 hours
  - Labels: `frontend`, `documenting`, `2SP`
  - Details: Fetch and render updates belonging to the selected project.
  - Dependencies: Association API
- [ ] Task 3: Integrate project history association
  - Ideal time: 4 hours
  - Labels: `integration`, `documenting`, `2SP`
  - Details: Verify project-specific retrieval, authorization, and correct project display.
  - Dependencies: API and project UI

## References

- Related story: US-15

## Unit Tests

- Verify that each update is associated with exactly one project.
- Verify that retrieving a project's history returns only updates associated with that project.
- Verify that an update cannot be reassigned to another project without authorization.
- Verify that inaccessible or nonexistent project identifiers are handled appropriately.
- Verify that the project page displays the updates returned by the project-specific API.

# Acceptance Criteria

- [ ] Every update is associated with one project.
- [ ] Update remains accessible from its project.
- [ ] Project history displays its associated updates.
- [ ] Update cannot be associated with another project without authorization.

**Labels:** `documenting`

---

# US-19: Document Problems and Solutions

**User Story:** As a maker, I want to document problems and solutions encountered during my project so that others can learn from my experience.

## Story Details

**Story points**
8 SP

**Priority**
Medium — problem/solution details strengthen the project's reusable documentation after the core update workflow is available.

**Risk**
Depends on US-15 and the project-update relationship. The team must decide whether problem and solution fields are optional or required for every update; this plan assumes they are available as fields when relevant. Existing updates and API schemas may require a compatible migration.

## Related Tasks and Estimates

- [ ] Task 1: Design problem/solution fields
  - Ideal time: 4 hours
  - Labels: `design`, `documenting`, `2SP`
  - Details: Define how makers record a problem and resolution, including field requirements.
  - Dependencies: US-15 design
- [ ] Task 2: Implement problem/solution data and API
  - Ideal time: 6 hours
  - Labels: `backend`, `documenting`, `3SP`
  - Details: Add fields and validation; persist problem/solution details with the relevant update/project.
  - Dependencies: US-15 model/API
- [ ] Task 3: Build problem/solution UI
  - Ideal time: 6 hours
  - Labels: `frontend`, `documenting`, `3SP`
  - Details: Add fields to record a problem and its resolution and display saved details.
  - Dependencies: Design fields
- [ ] Task 4: Integrate problem/solution documentation
  - Ideal time: 4 hours
  - Labels: `integration`, `documenting`, `2SP`
  - Details: Verify persistence, project association, display, and permissions.
  - Dependencies: Backend and frontend

## References

- Related stories: US-15, US-18

## Unit Tests

- Verify that problem and solution details can be submitted and persisted.
- Verify validation behavior for missing or invalid values according to the agreed field requirements.
- Verify that saved details remain associated with the correct update and project.
- Verify that the project documentation view displays problem/solution details.
- Verify that users without permission cannot modify another maker's documentation.

# Acceptance Criteria

- [ ] Maker can identify a documented problem within an update.
- [ ] Maker can describe the solution or resolution.
- [ ] Problem and solution remain associated with the relevant project.
- [ ] Information is visible when viewing the project's documentation.

**Labels:** `documenting`

---

# US-20: Chronological Updates

**User Story:** As a user, I want to view a project's updates in chronological order so that I can follow how the project evolved.

## Story Details

**Story points**
5 SP

**Priority**
Medium — chronological ordering makes the project history understandable and relies on project-associated updates and timestamps.

**Risk**
Depends on US-18 and consistent creation timestamps. The team should choose whether the history is oldest-first or newest-first; this plan assumes a consistent chronological order with dates and times visible. Edits should not unintentionally change an update's creation order.

## Related Tasks and Estimates

- [ ] Task 1: Implement chronological ordering
  - Ideal time: 4 hours
  - Labels: `backend`, `documenting`, `2SP`
  - Details: Return project updates in a consistent date/time order and store timestamps consistently.
  - Dependencies: US-18 association
- [ ] Task 2: Build chronological history UI
  - Ideal time: 4 hours
  - Labels: `frontend`, `documenting`, `2SP`
  - Details: Display timestamps in an easy-to-follow timeline or ordered list.
  - Dependencies: Ordering behavior
- [ ] Task 3: Integrate chronological history
  - Ideal time: 4 hours
  - Labels: `integration`, `documenting`, `2SP`
  - Details: Verify ordering for old and new updates, including after edits.
  - Dependencies: Backend ordering and UI

## References

- Related story: US-18

## Unit Tests

- Verify that updates are returned in the agreed chronological order.
- Verify that each update includes a valid creation date/time.
- Verify that updates created at different times retain a consistent order after additional updates are added.
- Verify that editing an update does not incorrectly alter its creation timestamp or ordering.
- Verify that the UI displays timestamps and orders updates consistently.

# Acceptance Criteria

- [ ] Project updates are displayed in chronological order.
- [ ] Each update displays its date and time.
- [ ] User can distinguish older and newer updates.
- [ ] Ordering remains consistent when new updates are added.

**Labels:** `documenting`

---

# US-21: Preview Project

**User Story:** As a maker, I want to preview my project before publishing it so that I can verify that its information and resources are presented correctly.

## Story Details

**Story points**
8 SP

**Priority**
Medium — previewing helps makers review the complete project presentation before publication, once the project view and relevant documentation data are available.

**Risk**
Depends on the existing project view and the data available from US-15, US-16, and US-18. Preview must respect draft visibility and authorization, and previewing must not publish or otherwise modify the project.

## Related Tasks and Estimates

- [ ] Task 1: Design project preview
  - Ideal time: 4 hours
  - Labels: `design`, `documenting`, `2SP`
  - Details: Define the preview layout and actions to return to editing or proceed to publishing.
  - Dependencies: Existing project view
- [ ] Task 2: Implement preview data/API
  - Ideal time: 4 hours
  - Labels: `backend`, `documenting`, `2SP`
  - Details: Provide project details, updates, media, and resources while respecting draft visibility and permissions.
  - Dependencies: US-15, US-16, US-18
- [ ] Task 3: Build project preview UI
  - Ideal time: 6 hours
  - Labels: `frontend`, `documenting`, `3SP`
  - Details: Render a presentation similar to the published view and provide a return-to-editing action.
  - Dependencies: Preview design
- [ ] Task 4: Integrate project preview
  - Ideal time: 4 hours
  - Labels: `integration`, `documenting`, `2SP`
  - Details: Verify current content/media, return-to-editing, and that previewing does not publish.
  - Dependencies: API and UI

## References

- Related stories: US-15, US-16, US-18

## Unit Tests

- Verify that authorized makers can open a preview of their project.
- Verify that the preview reflects the current project text, updates, media, and resources.
- Verify that unauthorized users cannot preview private or draft projects.
- Verify that returning to editing leaves the project editable and does not publish it.
- Verify that previewing does not change the project's publication status or persist unintended changes.

# Acceptance Criteria

- [ ] Maker can preview a project before publishing.
- [ ] Preview reflects how the published project will appear.
- [ ] Preview includes relevant text, media, and resources.
- [ ] Maker can return to editing without publishing.

**Labels:** `documenting`

---

## Cross-Story Dependencies

- **US-15** is the foundation for creating and storing updates.
- **US-16** depends on updates existing so media can be attached to the correct update.
- **US-17** depends on the update model and API from US-15.
- **US-18** defines and verifies the project-update relationship and project-specific retrieval.
- **US-19** extends update documentation with problem/solution details.
- **US-20** depends on project-associated updates and timestamps.
- **US-21** combines project details, updates, and media in a preview.

## Planning Notes

- Estimates are ideal task hours, not elapsed calendar time.
- Task labels include the work type, `documenting`, and a story-point label. The point labels correspond to the team's scale: 1 SP = 2 hours, 2 SP = 4 hours, 3 SP = 6 hours, 5 SP = 10 hours, and 8 SP = 16 hours. Task estimates are kept to the available 2-, 4-, 6-, 10-, or 16-hour increments.
- Apply `documenting` alongside each task-type label so issues can be filtered by epic and work type.
- Create acceptance-test issues for each user story using the repository's existing automation and naming convention.
- This file does not assign GitHub issue numbers; let GitHub assign them when the issues are created.
