# Milestone
iteration 5

# US-26: Upload Project Files

**User Story:** As a maker, I want to upload project files so that I can share resources needed to understand or reproduce my project.

## Story Details

**Story points**
8 SP

**Priority**
High — uploading files is the foundation for project resources and enables the other stories in this iteration.

**Risk**
Depends on the existing project model, authentication, and project authorization. Supported file types, maximum file size, and storage location must be agreed upon before implementation. Storage and validation should reuse the upload approach from US-16 where possible to avoid duplicate work. US-28, US-29, and US-30 depend on this functionality.

## Related Tasks and Estimates

- [ ] Task 1: Design file upload flow
  - Ideal time: 4 hours
  - Labels: `design`, `resources`, `2SP`
  - Details: Define file selection, supported-file guidance, upload progress, the project resources list, and success/error states.
  - Dependencies: None
- [ ] Task 2: Implement file upload API
  - Ideal time: 6 hours
  - Labels: `backend`, `resources`, `3SP`
  - Details: Add the upload endpoint and schemas; enforce authentication and project ownership.
  - Dependencies: Task 1
- [ ] Task 3: Implement persistence and validation
  - Ideal time: 4 hours
  - Labels: `backend`, `resources`, `2SP`
  - Details: Store files and metadata linked to the project; validate file type and size and return useful errors.
  - Dependencies: Resource model/API design
- [ ] Task 4: Build file upload UI
  - Ideal time: 6 hours
  - Labels: `frontend`, `resources`, `3SP`
  - Details: Implement file selection, upload feedback, and the project resources list.
  - Dependencies: Task 1
- [ ] Task 5: Integrate file uploads
  - Ideal time: 4 hours
  - Labels: `integration`, `resources`, `2SP`
  - Details: Connect the UI and API; verify the file appears in the correct project's resources.
  - Dependencies: API, persistence, and UI

## References

- Related stories: US-16, US-28, US-29, US-30
- Merged story: US-27 (criteria now included below)

## Unit Tests

- Verify that an authenticated project owner can upload a supported file within the size limit.
- Verify that unsupported, oversized, or invalid files are rejected with useful errors.
- Verify that unauthenticated users cannot upload files.
- Verify that a user cannot upload a file to a project they do not own.
- Verify that the uploaded file and its metadata are persisted and associated with the specified project.
- Verify that the file appears in the project's resources list and can be identified by users viewing the project.

# Acceptance Criteria

- [ ] Maker can upload supported file types.
- [ ] File is associated with the correct project.
- [ ] System rejects unsupported or invalid files.
- [ ] Uploaded file is accessible from the project.
- [ ] File appears in the project's resources, and users viewing the project can identify it.
- [ ] File cannot be associated with a project without authorization.

**Labels:** `resources`

---

# US-28: Download Project Resources

**User Story:** As a user, I want to download project resources so that I can use them when working on my own project.

## Story Details

**Story points**
5 SP

**Priority**
High — downloading is how other users benefit from shared resources and depends on the upload workflow.

**Risk**
Depends on US-26 and the resource storage model. Access rules must be enforced server-side so private or draft project resources cannot be downloaded through direct links. Downloaded files must match the stored originals.

## Related Tasks and Estimates

- [ ] Task 1: Implement download API
  - Ideal time: 4 hours
  - Labels: `backend`, `resources`, `2SP`
  - Details: Serve stored files with the correct name and type; enforce project visibility and access rules.
  - Dependencies: US-26 API/model
- [ ] Task 2: Build download UI
  - Ideal time: 4 hours
  - Labels: `frontend`, `resources`, `2SP`
  - Details: Add download actions to the resources list and show feedback when a download fails.
  - Dependencies: US-26 UI
- [ ] Task 3: Integrate resource downloads
  - Ideal time: 4 hours
  - Labels: `integration`, `resources`, `2SP`
  - Details: Verify file integrity, access restrictions, and failure feedback end to end.
  - Dependencies: API and UI

## References

- Related story: US-26

## Unit Tests

- Verify that users can download resources from publicly accessible projects.
- Verify that the downloaded file matches the uploaded file.
- Verify that resources from private or draft projects cannot be downloaded by unauthorized users.
- Verify that requests for nonexistent resources return an appropriate error.
- Verify that the UI displays appropriate feedback when a download fails.

# Acceptance Criteria

- [ ] User can download publicly accessible resources.
- [ ] Downloaded file matches the uploaded file.
- [ ] Unauthorized or private resources cannot be downloaded.
- [ ] System provides appropriate feedback if a download fails.

**Labels:** `resources`

---

# US-29: Describe Resources

**User Story:** As a maker, I want to provide descriptions for uploaded resources so that other users understand what each file is used for.

## Story Details

**Story points**
5 SP

**Priority**
Medium — descriptions make resources easier to understand once the upload workflow is available.

**Risk**
Depends on US-26 and the resource model. The team must decide whether a description is optional or required and set a maximum length; this plan assumes it is optional. Existing resources may require a compatible migration.

## Related Tasks and Estimates

- [ ] Task 1: Implement description data and API
  - Ideal time: 4 hours
  - Labels: `backend`, `resources`, `2SP`
  - Details: Add the description field and validation; support setting it on upload and editing it later with ownership checks.
  - Dependencies: US-26 API/model
- [ ] Task 2: Build description UI
  - Ideal time: 4 hours
  - Labels: `frontend`, `resources`, `2SP`
  - Details: Add the description field to the upload form, display it alongside the resource, and allow editing.
  - Dependencies: US-26 UI
- [ ] Task 3: Integrate resource descriptions
  - Ideal time: 4 hours
  - Labels: `integration`, `resources`, `2SP`
  - Details: Verify persistence, display, editing, and permissions end to end.
  - Dependencies: API and UI

## References

- Related story: US-26

## Unit Tests

- Verify that a description can be submitted with an upload and is persisted.
- Verify validation behavior for invalid or overly long descriptions according to the agreed field requirements.
- Verify that the owner can edit a description and changes persist.
- Verify that non-owners cannot edit a resource's description.
- Verify that the description remains associated with the correct resource and is displayed alongside it.

# Acceptance Criteria

- [ ] Maker can provide a description when uploading a resource.
- [ ] Description is displayed alongside the resource.
- [ ] Maker can edit the description.
- [ ] Description remains associated with the correct resource.

**Labels:** `resources`

---

# US-30: Remove or Replace Resources

**User Story:** As a maker, I want to remove or replace a resource so that outdated files are not misleading to other users.

## Story Details

**Story points**
8 SP

**Priority**
Medium — makers need to keep project resources accurate after files have been uploaded.

**Risk**
Depends on US-26 and the resource storage model. Authorization must be enforced server-side so users cannot remove or replace another user's resources. Removal confirmation should prevent accidental deletion. The team must decide whether a replaced file keeps its description (US-29) and whether old files are deleted from storage.

## Related Tasks and Estimates

- [ ] Task 1: Design remove/replace interactions
  - Ideal time: 4 hours
  - Labels: `design`, `resources`, `2SP`
  - Details: Define the replace flow, remove confirmation, cancellation, and feedback.
  - Dependencies: US-26 UI
- [ ] Task 2: Implement remove/replace API
  - Ideal time: 6 hours
  - Labels: `backend`, `resources`, `3SP`
  - Details: Add remove and replace endpoints with authentication, ownership checks, and file validation; clean up replaced or removed files in storage.
  - Dependencies: US-26 API/model
- [ ] Task 3: Build remove/replace UI
  - Ideal time: 6 hours
  - Labels: `frontend`, `resources`, `3SP`
  - Details: Let owners replace a file and confirm removal from the resources list.
  - Dependencies: Design interactions
- [ ] Task 4: Integrate remove/replace workflow
  - Ideal time: 4 hours
  - Labels: `integration`, `resources`, `2SP`
  - Details: Verify replaced files display correctly, removals take effect, and permission errors are handled end to end.
  - Dependencies: API and UI

## References

- Related stories: US-26, US-28, US-29

## Unit Tests

- Verify that the owner can remove a resource and it no longer appears in the project's resources.
- Verify that the owner can replace a resource and the new file is displayed and downloadable.
- Verify that replacement files go through the same type and size validation as uploads.
- Verify that non-owners and unauthenticated users cannot remove or replace resources.
- Verify that requests for nonexistent resources return an appropriate error.
- Verify that the UI asks for confirmation before removal and supports cancellation.

# Acceptance Criteria

- [ ] Resource owner can remove a resource.
- [ ] Resource owner can replace an existing resource.
- [ ] Updated resource is displayed to users after replacement.
- [ ] Unauthorized users cannot modify or remove resources.

**Labels:** `resources`
