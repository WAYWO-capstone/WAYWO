# Milestone
iteration 7

# US-31: Search Projects

**User Story:** As a user, I want to search for projects by keywords so that I can find projects relevant to my interests.

## Story Details

**Story points**
8 SP

**Priority**
High — keyword search is the main way users find projects and is the foundation for later discovery stories such as US-37 (Search Saved Projects).

**Risk**
Depends on the existing project model and draft/visibility rules. The team must agree on which fields are searched (for example title, description, and category) and how results are ranked. Search must never return draft or private projects to users who cannot view them. US-37 should be built as a filter on this search, so the API should be designed with that in mind.

## Related Tasks and Estimates

- [ ] Task 1: Design project search
  - Ideal time: 4 hours
  - Labels: `design`, `discovery`, `2SP`
  - Details: Define the search field, searchable fields, results layout, loading state, and no-results feedback.
  - Dependencies: None
- [ ] Task 2: Implement search API
  - Ideal time: 6 hours
  - Labels: `backend`, `discovery`, `3SP`
  - Details: Add the search endpoint and schemas; match keywords against the agreed fields, rank results, and exclude projects the user cannot view.
  - Dependencies: Task 1
- [ ] Task 3: Build search UI
  - Ideal time: 4 hours
  - Labels: `frontend`, `discovery`, `2SP`
  - Details: Implement the search field, results list with key project information, and no-results feedback.
  - Dependencies: Task 1
- [ ] Task 4: Integrate project search
  - Ideal time: 2 hours
  - Labels: `integration`, `discovery`, `1SP`
  - Details: Connect the UI and API; verify relevant results, visibility rules, and no-results feedback end to end.
  - Dependencies: API and UI

## References

- Related stories: US-32, US-33, US-37

## Unit Tests

- Verify that searching with keywords returns projects that match the agreed searchable fields.
- Verify that results are ranked consistently according to the agreed relevance rules.
- Verify that draft and private projects are excluded for users who cannot view them.
- Verify that empty or whitespace-only searches are handled appropriately.
- Verify that the UI displays relevant project information for each result.
- Verify that the UI displays appropriate feedback when no projects match.

# Acceptance Criteria

- [ ] User can enter keywords into a search field.
- [ ] System returns projects relevant to the search terms.
- [ ] Search results display relevant project information.
- [ ] System provides appropriate feedback when no matching projects are found.

**Labels:** `discovery`
