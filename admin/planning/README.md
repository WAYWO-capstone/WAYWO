# GitHub planning issue importer

[`create_tasks.py`](./create_tasks.py) reads a planning Markdown file and creates
the corresponding GitHub issues for milestones, Epics, User Stories, and Tasks.

The importer supports:

- Existing GitHub milestones
- Epic issues
- Feature issues for User Stories
- Task issues linked as sub-issues of their User Story
- GitHub labels
- Story-point labels based on task estimates
- The `WAYWO` GitHub Project board
- Safe reruns without creating duplicate issues or project items

## Prerequisites

Install and authenticate the GitHub CLI (`gh`):

```powershell
gh auth login
```

The authenticated account needs permission to:

- Create and edit issues
- Create or use labels
- Assign milestones
- Add items to the `WAYWO` project board
- Create sub-issue relationships

The script is normally run from the repository root.

## Basic usage

The default input file is `admin/planning/user_stories.md`:

```powershell
python admin/planning/create_tasks.py --dry-run
```

To use a specific planning file:

```powershell
python admin/planning/create_tasks.py `
  admin/planning/iteration_3.md `
  --repo WAYWO-capstone/WAYWO `
  --dry-run
```

Always run with `--dry-run` first. A dry run does not call GitHub to create or
change anything. It prints the title, issue type, milestone, labels, parent,
project board, and full body that would be sent to GitHub.

To create the issues:

```powershell
python admin/planning/create_tasks.py `
  admin/planning/iteration_3.md `
  --repo WAYWO-capstone/WAYWO
```

To process only selected User Stories:

```powershell
python admin/planning/create_tasks.py `
  admin/planning/iteration_3.md `
  --repo WAYWO-capstone/WAYWO `
  --story 15 `
  --story 18
```

## Supported planning format

### Milestone

The file must declare an existing GitHub milestone:

```markdown
# Milestone
iteration-3
```

The script does not create milestones. The milestone must already exist in the
repository before the importer is run.

### Epics

Use this heading format:

```markdown
# EPIC 1: Project Documentation
```

The script creates an `Epic` issue using the Epic number and title. Any Epic
description and labels in the block are included in the issue creation request.
For example:

```markdown
# EPIC 1: Project Documentation

**Labels:** `documentation`

## Description

Document the project's progress and implementation decisions.
```

If an Epic with the exact title already exists, it is reused instead of
created again.

### User Stories

Use a space between `#` and `US`:

```markdown
# US-15: Add Progress Updates
```

Each User Story should include:

```markdown
**User Story:** As a user, I want to do something so that I can do something else.
 
**Labels:** `feature`

## Acceptance Criteria

- [ ] Some criteria
```

The resulting GitHub `Feature` issue contains:

- The User Story
- Story Details, including story points, priority, and risk
- References
- Unit Tests
- The Acceptance Criteria

The milestone and labels are applied as GitHub issue metadata. Labels are not
copied into the issue body.

### Tasks

Tasks can be written as a Markdown checklist:

```markdown
## Tasks

- [ ] Task 1: Design progress updates
  - Ideal time: 4 hours
  - Labels: `design`, `documentation`, `2SP`
  - Details: Define the form, validation, and error states.
  - Dependencies: None
```

Each task becomes a GitHub `Task` issue with:

- The milestone
- The labels from the task
- A story-point label based on the estimate
- The task description
- Dependencies
- A sub-issue relationship to its User Story Feature
- An item on the `WAYWO` project board

The importer also supports the fixed-width task tables used by earlier
iteration files.

## Story-point labels

Task estimates are mapped to GitHub labels as follows:

| Ideal implementation time | Story points | GitHub label |
| ---: | ---: | --- |
| 2 hours | 1 | `1SP` |
| 4 hours | 2 | `2SP` |
| 6 hours | 3 | `3SP` |
| 10 hours | 5 | `5SP` |
| 16 hours | 8 | `8SP` |

For example, a task estimated at `4 hours` receives the `2SP` label.

## Project board

The default project is:

```text
WAYWO-capstone/projects/1
```

This is the `WAYWO` organization project:

<https://github.com/orgs/WAYWO-capstone/projects/1/views/1>

Epics, Features, and Tasks are added to this project. Existing project items
are detected and are not added again.


## Duplicate protection

The importer is designed to be safely rerun:

- Feature and Epic bodies contain hidden importer markers.
- Task bodies contain hidden importer markers.
- Existing issues are searched before creation.
- Existing Tasks are reused when their parent Feature matches.
- Existing sub-issue relationships are preserved.
- Existing project items are not added again.

If a previous run stopped partway through, rerun the same command. The script
will reuse issues that were already created and continue with the remaining
work.

## Recommended workflow

1. Confirm the milestone already exists in GitHub.
2. Validate the Markdown headings and task sections.
3. Run a dry run:

   ```powershell
   python admin/planning/create_tasks.py `
     admin/planning/iteration_3.md `
     --repo WAYWO-capstone/WAYWO `
     --dry-run
   ```

4. Review issue titles, bodies, labels, milestone, parent, and project output.
5. Run the same command without `--dry-run`.
6. Review the created issues and the `WAYWO` project board.
