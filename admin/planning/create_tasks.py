"""Create GitHub Feature and Task issues from the user-stories markdown file.

Requirements:
    - GitHub CLI (``gh``) installed and authenticated.
    - Repository inferred from the current git checkout, or supplied with
      ``--repo OWNER/REPOSITORY``.

Use ``--dry-run`` to inspect the issues before creating anything.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Sequence


STORY_HEADING = re.compile(r"^##\s+US\s+(\d+)\s+[—-]\s+(.+?)\s*$")
ITERATION_STORY_HEADING = re.compile(
    r"^#\s+US-(\d+)\s*:\s*(.+?)\s*$", re.IGNORECASE
)
EPIC_HEADING = re.compile(
    r"^#\s+EPIC\s+(\d+)\s*:\s*(.+?)\s*$", re.IGNORECASE
)
TASK_LINE = re.compile(
    r"^- \[[ xX]\]\s+(?:#(\d+)\s+[—-]\s+)?(.+?)\s*$"
)
ESTIMATE_LINE = re.compile(r"^\s*-\s+Ideal time:\s*(.+?)\s*$", re.IGNORECASE)
SECTION_HEADING = re.compile(r"^(#{1,6})\s+(.+?)\s*$")
BOLD_FIELD = re.compile(r"^\*\*(.+?)\*\*\s*$")


@dataclass
class Task:
    title: str
    estimate: str
    planning_number: str | None = None
    description: str = ""
    labels: list[str] = field(default_factory=list)
    dependencies: str = ""


@dataclass
class UserStory:
    number: int
    title: str
    story: str
    details: dict[str, str]
    tasks: list[Task] = field(default_factory=list)
    references: list[str] = field(default_factory=list)
    unit_tests: list[str] = field(default_factory=list)
    acceptance_criteria: list[str] = field(default_factory=list)
    additional_context: str = ""
    label: str = ""


@dataclass
class Epic:
    number: int
    title: str
    description: str
    labels: list[str] = field(default_factory=list)


@dataclass
class IterationPlan:
    milestone: str
    epics: list[Epic] = field(default_factory=list)
    stories: list[UserStory] = field(default_factory=list)


def _section_text(
    lines: Sequence[str], heading: str, *, stop_at_nested: bool = False
) -> str:
    """Return the text between a named Markdown heading and its next peer."""
    for index, line in enumerate(lines):
        match = SECTION_HEADING.match(line)
        if match and match.group(2).strip().lower() == heading.lower():
            level = len(match.group(1))
            end = len(lines)
            for next_index in range(index + 1, len(lines)):
                next_heading = SECTION_HEADING.match(lines[next_index])
                if next_heading and (
                    stop_at_nested or len(next_heading.group(1)) <= level
                ):
                    end = next_index
                    break
            return "\n".join(lines[index + 1 : end]).strip()
    return ""


def _list_items(text: str) -> list[str]:
    return [
        match.group(0).strip()[2:].strip()
        for line in text.splitlines()
        if (match := re.match(r"^\s*-\s+(?!\[)[^\s].*$", line))
        for _ in [match]
    ]


def _parse_details(text: str) -> dict[str, str]:
    fields: dict[str, str] = {}
    current: str | None = None
    values: list[str] = []
    for line in text.splitlines():
        field_match = BOLD_FIELD.match(line.strip())
        if field_match:
            if current is not None:
                fields[current] = " ".join(values).strip()
            current = field_match.group(1).strip().lower()
            values = []
        elif current is not None and line.strip():
            values.append(line.strip())
    if current is not None:
        fields[current] = " ".join(values).strip()
    return fields


def _parse_tasks(text: str) -> list[Task]:
    tasks: list[Task] = []
    lines = text.splitlines()
    for index, line in enumerate(lines):
        match = TASK_LINE.match(line.strip())
        if not match:
            continue
        estimate = ""
        if index + 1 < len(lines):
            estimate_match = ESTIMATE_LINE.match(lines[index + 1])
            if estimate_match:
                estimate = estimate_match.group(1)
        tasks.append(
            Task(
                title=match.group(2),
                estimate=estimate,
                planning_number=match.group(1),
            )
        )
    return tasks


def parse_user_stories(path: Path) -> list[UserStory]:
    lines = path.read_text(encoding="utf-8").splitlines()
    starts = [
        (index, match)
        for index, line in enumerate(lines)
        if (match := STORY_HEADING.match(line))
    ]
    if not starts:
        raise ValueError(f"No '## US <number> — <title>' headings found in {path}")

    stories: list[UserStory] = []
    for position, (start, match) in enumerate(starts):
        end = starts[position + 1][0] if position + 1 < len(starts) else len(lines)
        block = lines[start:end]
        block_text = "\n".join(block)
        story_text = _section_text(block, "User Story", stop_at_nested=True)
        if not story_text:
            raise ValueError(f"US {match.group(1)} is missing a User Story section")
        details = _parse_details(_section_text(block, "Story Details"))
        stories.append(
            UserStory(
                number=int(match.group(1)),
                title=match.group(2),
                story=story_text,
                details=details,
                tasks=_parse_tasks(
                    _section_text(block, "Related Tasks and Estimates")
                ),
                references=_list_items(_section_text(block, "References")),
                unit_tests=_list_items(_section_text(block, "Unit Tests")),
                acceptance_criteria=_list_items(
                    _section_text(block, "Acceptance Criteria")
                ),
                additional_context=_section_text(block, "Additional context"),
            )
        )
    return stories


def _clean_inline(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("`", "")).strip()


def _parse_label_line(text: str) -> list[str]:
    return [
        label.strip()
        for label in re.split(r"[, ]+", text.replace("`", ""))
        if label.strip()
    ]


def _parse_checkbox_list(text: str) -> list[str]:
    return [
        re.sub(r"^\s*-\s*\[[ xX]\]\s*", "", line).strip()
        for line in text.splitlines()
        if re.match(r"^\s*-\s*\[[ xX]\]", line)
    ]


def _parse_fixed_width_tasks(lines: Sequence[str]) -> list[Task]:
    candidates = [
        (index, list(re.finditer(r"-{3,}", line)))
        for index, line in enumerate(lines)
    ]
    separator_index, separator_matches = max(
        candidates, key=lambda item: len(item[1]), default=(None, [])
    )
    if separator_index is None or len(separator_matches) < 4:
        return []
    separator = lines[separator_index]
    spans = [(match.start(), match.end()) for match in separator_matches[:5]]
    table_lines: list[str] = []
    started_rows = False
    for line in lines[separator_index + 1 :]:
        first_cell = line[spans[0][0] : spans[1][0] if len(spans) > 1 else len(line)]
        if re.search(r"-{3,}", line) and not first_cell.strip():
            if started_rows:
                break
            continue
        if line.strip():
            table_lines.append(line)
            started_rows = True

    rows: list[list[list[str]]] = []
    for line in table_lines:
        padded = line.ljust(spans[-1][1])
        row = [
            padded[start : spans[index + 1][0] if index + 1 < len(spans) else len(padded)]
            for index, (start, _) in enumerate(spans)
        ]
        is_separator = bool(re.fullmatch(r"-+", row[0].strip()))
        starts_new_task = (
            row[0].strip()
            and not is_separator
            and bool(re.search(r"\d+(?:\.\d+)?\s*h\b", row[3], re.I))
        )
        if is_separator:
            break
        if starts_new_task:
            rows.append([[value.strip()] for value in row])
        elif rows:
            for index, value in enumerate(row):
                if value.strip():
                    rows[-1][index].append(value.strip())

    tasks: list[Task] = []
    for values in rows:
        if not values or not values[0]:
            continue
        title = _clean_inline(" ".join(values[0]))
        description = _clean_inline(" ".join(values[1]))
        labels = _parse_label_line(" ".join(values[2]))
        estimate_match = re.search(
            r"(\d+(?:\.\d+)?)\s*h(?:ours?)?\b", " ".join(values[3]), re.I
        )
        estimate = f"{estimate_match.group(1)} h" if estimate_match else ""
        dependencies = _clean_inline(" ".join(values[4]))
        tasks.append(
            Task(
                title=title,
                estimate=estimate,
                description=description,
                labels=labels,
                dependencies=dependencies,
            )
        )
    return tasks


def _parse_bulleted_tasks(text: str) -> list[Task]:
    tasks: list[Task] = []
    current: Task | None = None
    for line in text.splitlines():
        task_match = re.match(r"^\s*-\s*\[[ xX]\]\s*(?:Task\s+\d+\s*:\s*)?(.+?)\s*$", line)
        if task_match:
            if current:
                tasks.append(current)
            current = Task(title=task_match.group(1), estimate="")
            continue
        if not current:
            continue
        field_match = re.match(r"^\s*-\s*(Ideal time|Labels|Details|Dependencies)\s*:\s*(.+)$", line, re.I)
        if not field_match:
            continue
        field, value = field_match.groups()
        if field.lower() == "ideal time":
            current.estimate = value.strip()
        elif field.lower() == "labels":
            current.labels = _parse_label_line(value)
        elif field.lower() == "details":
            current.description = value.strip()
        else:
            current.dependencies = value.strip()
    if current:
        tasks.append(current)
    return tasks


def parse_iteration_plan(path: Path) -> IterationPlan:
    """Parse the milestone/epic/user-story format used by iteration plans."""
    lines = path.read_text(encoding="utf-8").splitlines()
    milestone_index = next(
        (index for index, line in enumerate(lines) if line.strip().lower() == "# milestone"),
        None,
    )
    if milestone_index is None:
        raise ValueError(f"No '# Milestone' declaration found in {path}")
    milestone = next(
        (line.strip() for line in lines[milestone_index + 1 :] if line.strip()),
        "",
    )
    if not milestone:
        raise ValueError("The milestone declaration has no value")

    starts = [
        (index, "epic", match)
        for index, line in enumerate(lines)
        if (match := EPIC_HEADING.match(line))
    ] + [
        (index, "story", match)
        for index, line in enumerate(lines)
        if (match := ITERATION_STORY_HEADING.match(line))
    ]
    starts.sort(key=lambda item: item[0])
    if not starts:
        raise ValueError("No EPIC or US declarations found")

    epics: list[Epic] = []
    stories: list[UserStory] = []
    for position, (start, kind, match) in enumerate(starts):
        end = starts[position + 1][0] if position + 1 < len(starts) else len(lines)
        block = lines[start:end]
        block_text = "\n".join(block)
        if kind == "epic":
            description = _section_text(block, "Description", stop_at_nested=True)
            if not description:
                description = "\n".join(
                    line for line in block[1:] if line.strip()
                ).strip()
            labels_match = re.search(r"^\*\*Labels?\*\*:\s*(.+)$", block_text, re.I | re.M)
            epics.append(
                Epic(
                    number=int(match.group(1)),
                    title=match.group(2).strip(),
                    description=description,
                    labels=_parse_label_line(labels_match.group(1)) if labels_match else [],
                )
            )
            continue

        story_match = re.search(r"^\*\*User Story:\*\*\s*(.+)$", block_text, re.I | re.M)
        label_match = re.search(r"^\*\*Labels?:\*\*\s*(.+)$", block_text, re.I | re.M)
        criteria_text = _section_text(block, "Acceptance Criteria", stop_at_nested=True)
        tasks_text = _section_text(block, "Tasks", stop_at_nested=True)
        if not tasks_text:
            tasks_text = _section_text(
                block, "Related Tasks and Estimates", stop_at_nested=True
            )
        tasks = (
            _parse_bulleted_tasks(tasks_text)
            if re.search(r"^\s*-\s*\[[ xX]\]", tasks_text, re.M)
            else _parse_fixed_width_tasks(tasks_text.splitlines())
        )
        details = _parse_details(_section_text(block, "Story Details"))
        stories.append(
            UserStory(
                number=int(match.group(1)),
                title=match.group(2).strip(),
                story=_clean_inline(story_match.group(1)) if story_match else "",
                details=details,
                tasks=tasks,
                references=_list_items(
                    _section_text(block, "References", stop_at_nested=True)
                ),
                unit_tests=_list_items(
                    _section_text(block, "Unit Tests", stop_at_nested=True)
                ),
                acceptance_criteria=_parse_checkbox_list(criteria_text),
                label=_clean_inline(label_match.group(1)) if label_match else "",
            )
        )
    return IterationPlan(milestone=milestone, epics=epics, stories=stories)


def _bullets(items: Sequence[str]) -> str:
    return "\n".join(f"- {item}" for item in items) or "N/A"


def feature_body(story: UserStory) -> str:
    details = story.details
    task_lines = []
    for task in story.tasks:
        planning_id = f" (planning #{task.planning_number})" if task.planning_number else ""
        task_lines.append(
            f"- [ ] {task.title}{planning_id}\n"
            f"  - Ideal time: {task.estimate or 'Not specified'}"
        )
    related_tasks = "\n".join(task_lines) or "No related tasks listed."
    return f"""<!-- waywo-import:feature:{story.number} -->
# User Story

{story.story}

## Story Details

**Story points**
{details.get("story points", "Not specified")}

**Priority**
{details.get("priority", "Not specified")}

**Risk**
{details.get("risk", "Not specified")}

## Related Tasks and Estimates

{related_tasks}

## References

{_bullets(story.references)}

## Unit Tests

{_bullets(story.unit_tests)}

# Acceptance Criteria

{_bullets(story.acceptance_criteria)}

**Additional context**
{story.additional_context or "N/A"}
"""


def task_body(story: UserStory, task: Task, feature_title: str) -> str:
    task_key = task.planning_number or task.title
    planning_id = (
        f"Planning task: #{task.planning_number}\n\n"
        if task.planning_number
        else ""
    )
    return (
        f"<!-- waywo-import:task:{story.number}:{task_key} -->\n"
        f"Parent feature: {feature_title}\n\n"
        f"{planning_id}"
        f"**Ideal time:** {task.estimate or 'Not specified'}\n\n"
    )


STORY_POINTS_BY_HOURS = {
    "2": "1SP",
    "4": "2SP",
    "6": "3SP",
    "10": "5SP",
    "16": "8SP",
}


def iteration_feature_body(story: UserStory) -> str:
    return f"""<!-- waywo-import:feature:{story.number} -->
# User Story

{story.story}

## Story Details

**Story points**
{story.details.get("story points", "Not specified")}

**Priority**
{story.details.get("priority", "Not specified")}

**Risk**
{story.details.get("risk", "Not specified")}

## References

{_bullets(story.references)}

## Unit Tests

{_bullets(story.unit_tests)}

## Acceptance Criteria

{_bullets(story.acceptance_criteria)}
"""


def iteration_task_body(story: UserStory, task: Task, feature_title: str) -> str:
    return f"""<!-- waywo-import:task:{story.number}:{task.title} -->
Parent feature: {feature_title}

## Description

{task.description or "No description provided."}

**Dependencies:** {task.dependencies or "None"}
**Estimate:** {task.estimate or "Not specified"}
"""


def _hours_from_estimate(estimate: str) -> str | None:
    match = re.search(r"(\d+(?:\.\d+)?)\s*h(?:ours?)?\b", estimate, re.I)
    if not match:
        return None
    hours = match.group(1).removesuffix(".0")
    return hours


def _print_issue_preview(
    *,
    issue_type: str,
    title: str,
    body: str,
    labels: Sequence[str],
    milestone: str,
    parent: str | None = None,
    project: str | None = None,
) -> None:
    print(f"\n--- DRY RUN: {issue_type} ---")
    print(f"Title: {title}")
    print(f"Milestone: {milestone}")
    print(f"Labels: {', '.join(labels) or '(none)'}")
    if parent:
        print(f"Parent: {parent}")
    if project:
        print(f"Project: WAYWO (WAYWO-capstone/projects/{project})")
    print("Body:")
    print(body.rstrip())
    print(f"--- END {issue_type} ---")


def run_gh(
    args: Sequence[str], *, repo: str | None = None, include_repo: bool = True
) -> str:
    command = ["gh", *args]
    if repo and include_repo:
        command.extend(["--repo", repo])
    try:
        result = subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
    except FileNotFoundError as error:
        raise RuntimeError("GitHub CLI (gh) is not installed or not on PATH.") from error
    except subprocess.CalledProcessError as error:
        detail = (error.stderr or error.stdout or "").strip()
        raise RuntimeError(f"GitHub CLI failed: {' '.join(command)}\n{detail}") from error
    return (result.stdout or "").strip()


def ensure_milestone(repo: str | None, title: str) -> str:
    if not repo:
        raise ValueError("--repo is required when using milestones")
    output = run_gh(
        ["api", f"repos/{repo}/milestones", "--paginate", "--jq", ".[].title"],
        include_repo=False,
    )
    if title in output.splitlines():
        return title
    run_gh(
        ["api", f"repos/{repo}/milestones", "-f", f"title={title}"],
        include_repo=False,
    )
    return title


def add_to_project(
    repo: str | None, issue_url: str, project_number: str, project_owner: str
) -> None:
    run_gh(
        [
            "project",
            "item-add",
            project_number,
            "--owner",
            project_owner,
            "--url",
            issue_url,
        ],
        repo=repo,
        include_repo=False,
    )


def project_contains_issue(
    repo: str | None, issue_url: str, project_number: str, project_owner: str
) -> bool:
    output = run_gh(
        [
            "project",
            "item-list",
            project_number,
            "--owner",
            project_owner,
            "--format",
            "json",
            "--limit",
            "1000",
        ],
        repo=repo,
        include_repo=False,
    )
    items = json.loads(output or "{}").get("items", [])
    return any(item.get("content", {}).get("url") == issue_url for item in items)


def ensure_issue_on_project(
    repo: str | None,
    issue: dict,
    project_number: str | None,
    project_owner: str | None,
    issue_type: str,
) -> None:
    if not project_number:
        return
    if not project_owner:
        raise ValueError("--project-owner is required when --project is provided")
    if project_contains_issue(repo, issue["url"], project_number, project_owner):
        print(
            f"  {issue_type} #{issue['number']} is already on project "
            f"{project_number}"
        )
        return
    add_to_project(repo, issue["url"], project_number, project_owner)
    print(f"  Added {issue_type.lower()} #{issue['number']} to project {project_number}")


def create_issue(
    repo: str | None,
    title: str,
    body: str,
    issue_type: str,
    *,
    labels: Sequence[str] = (),
    milestone: str | None = None,
) -> dict:
    issue_args = [
        "issue",
        "create",
        "--title",
        title,
        "--body",
        body,
        "--type",
        issue_type,
    ]
    for label in labels:
        issue_args.extend(["--label", label])
    if milestone:
        issue_args.extend(["--milestone", milestone])
    output = run_gh(
        issue_args,
        repo=repo,
    )
    issue_url = output.splitlines()[-1].strip()
    issue_number = issue_url.rstrip("/").rsplit("/", 1)[-1]
    if not issue_number.isdigit():
        raise RuntimeError(
            f"GitHub CLI did not return an issue URL after creating {title!r}: {output}"
        )
    return json.loads(
        run_gh(
            [
                "issue",
                "view",
                issue_number,
                "--json",
                "number,title,url,id",
            ],
            repo=repo,
        )
    )


def find_existing_issue(
    repo: str | None,
    *,
    title: str,
    marker: str,
    planning_number: str | None = None,
    parent_title: str | None = None,
    match_title_without_marker: bool = False,
) -> dict | None:
    """Find an imported issue, including issues created before markers existed."""
    output = run_gh(
        [
            "issue",
            "list",
            "--state",
            "all",
            "--limit",
            "100",
            "--search",
            f'in:title "{title}"',
            "--json",
            "number,title,body",
        ],
        repo=repo,
    )
    for issue in json.loads(output or "[]"):
        if issue["title"] != title:
            continue
        issue_body = issue.get("body") or ""
        if (
            marker in issue_body
            or (
                planning_number
                and f"Planning task: #{planning_number}" in issue_body
            )
            or (
                parent_title
                and f"Parent feature: {parent_title}" in issue_body
            )
            or marker.startswith("<!-- waywo-import:feature:")
            or match_title_without_marker
        ):
            return json.loads(
                run_gh(
                    [
                        "issue",
                        "view",
                        str(issue["number"]),
                        "--json",
                        "number,title,url,id",
                    ],
                    repo=repo,
                )
            )
    return None


def add_sub_issue(repo: str | None, parent_id: str, child_id: str) -> None:
    query = """
mutation($parent: ID!, $child: ID!) {
  addSubIssue(input: {issueId: $parent, subIssueId: $child}) {
    subIssue { number }
  }
}
"""
    run_gh(
        [
            "api",
            "graphql",
            "-f",
            f"query={query}",
            "-f",
            f"parent={parent_id}",
            "-f",
            f"child={child_id}",
        ],
        repo=repo,
        include_repo=False,
    )


def is_sub_issue(repo: str | None, parent_id: str, child_id: str) -> bool:
    query = """
query($parent: ID!) {
  node(id: $parent) {
    ... on Issue {
      subIssues(first: 100) {
        nodes { id }
      }
    }
  }
}
"""
    output = run_gh(
        [
            "api",
            "graphql",
            "-f",
            f"query={query}",
            "-f",
            f"parent={parent_id}",
        ],
        repo=repo,
        include_repo=False,
    )
    sub_issues = json.loads(output).get("data", {}).get("node", {}).get("subIssues", {})
    return any(node.get("id") == child_id for node in sub_issues.get("nodes", []))


def process_iteration_plan(
    plan: IterationPlan,
    repo: str | None,
    *,
    project_number: str | None,
    project_owner: str | None,
    dry_run: bool,
) -> None:
    milestone = plan.milestone
    repo_owner = repo.split("/", 1)[0] if repo and "/" in repo else None
    project_owner = project_owner or repo_owner

    for epic in plan.epics:
        title = f"EPIC {epic.number}: {epic.title}"
        body = f"<!-- waywo-import:epic:{epic.number} -->\n# Epic\n\n{epic.description}\n"
        if dry_run:
            _print_issue_preview(
                issue_type="Epic",
                title=title,
                body=body,
                labels=epic.labels,
                milestone=milestone,
                project=project_number,
            )
            continue
        existing = find_existing_issue(
            repo,
            title=title,
            marker=f"<!-- waywo-import:epic:{epic.number} -->",
            match_title_without_marker=True,
        )
        epic_issue = existing or create_issue(
            repo, title, body, "Epic", labels=epic.labels, milestone=milestone
        )
        print(
            f"{'Reusing' if existing else 'Created'} epic "
            f"#{epic_issue['number']}: {epic_issue['title']}"
        )
        ensure_issue_on_project(
            repo, epic_issue, project_number, project_owner, "Epic"
        )

    for story in plan.stories:
        title = f"US {story.number}: {story.title}"
        body = iteration_feature_body(story)
        task_labels = sorted(
            {
                label
                for task in story.tasks
                for label in task.labels
                if label
            }
        )
        if dry_run:
            _print_issue_preview(
                issue_type="Feature",
                title=title,
                body=body,
                labels=[story.label] if story.label else [],
                milestone=milestone,
                project=project_number,
            )
            for task in story.tasks:
                sp_label = STORY_POINTS_BY_HOURS.get(_hours_from_estimate(task.estimate) or "")
                labels = list(
                    dict.fromkeys(task.labels + ([sp_label] if sp_label else []))
                )
                _print_issue_preview(
                    issue_type="Task",
                    title=task.title,
                    body=iteration_task_body(story, task, title),
                    labels=labels,
                    milestone=milestone,
                    parent=title,
                    project=project_number,
                )
            continue
        labels = [story.label] if story.label else []
        feature = find_existing_issue(
            repo, title=title, marker=f"<!-- waywo-import:feature:{story.number} -->"
        ) or create_issue(repo, title, body, "Feature", labels=labels, milestone=milestone)
        print(f"Processed feature #{feature['number']}: {feature['title']}")
        ensure_issue_on_project(
            repo, feature, project_number, project_owner, "Feature"
        )
        for task in story.tasks:
            sp_label = STORY_POINTS_BY_HOURS.get(_hours_from_estimate(task.estimate) or "")
            labels = list(dict.fromkeys(task.labels + ([sp_label] if sp_label else [])))
            task_body_text = iteration_task_body(story, task, title)
            task_issue = find_existing_issue(
                repo,
                title=task.title,
                marker=f"<!-- waywo-import:task:{story.number}:{task.title} -->",
                parent_title=title,
            ) or create_issue(
                repo,
                task.title,
                task_body_text,
                "Task",
                labels=labels,
                milestone=milestone,
            )
            if not is_sub_issue(repo, feature["id"], task_issue["id"]):
                add_sub_issue(repo, feature["id"], task_issue["id"])
            ensure_issue_on_project(
                repo, task_issue, project_number, project_owner, "Task"
            )
            print(f"  Processed task #{task_issue['number']}: {task_issue['title']}")


def process(stories: Sequence[UserStory], repo: str | None, dry_run: bool) -> None:
    for story in stories:
        feature_title = f"US {story.number}: {story.title}"
        body = feature_body(story)
        if dry_run:
            print(f"\nFEATURE: {feature_title}\n{body}")
            for task in story.tasks:
                print(f"\nTASK: {task.title}\n{task_body(story, task, feature_title)}")
            continue

        feature = find_existing_issue(
            repo,
            title=feature_title,
            marker=f"<!-- waywo-import:feature:{story.number} -->",
        )
        if feature:
            print(f"Reusing existing feature #{feature['number']}: {feature['title']}")
        else:
            feature = create_issue(repo, feature_title, body, "Feature")
            print(f"Created feature #{feature['number']}: {feature['title']}")
        for task in story.tasks:
            task_marker = (
                f"<!-- waywo-import:task:{story.number}:"
                f"{task.planning_number or task.title} -->"
            )
            created = find_existing_issue(
                repo,
                title=task.title,
                marker=task_marker,
                planning_number=task.planning_number,
                parent_title=feature_title,
            )
            if created:
                print(f"  Reusing existing task #{created['number']}: {created['title']}")
            else:
                created = create_issue(
                    repo,
                    task.title,
                    task_body(story, task, feature_title),
                    "Task",
                )
                print(f"  Created task #{created['number']}: {created['title']}")
            if not is_sub_issue(repo, feature["id"], created["id"]):
                add_sub_issue(repo, feature["id"], created["id"])
                print(f"  Linked task #{created['number']} to feature #{feature['number']}")
            else:
                print(f"  Task #{created['number']} is already linked")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Create GitHub Feature and Task issues from a user-stories markdown file."
    )
    parser.add_argument(
        "markdown",
        nargs="?",
        type=Path,
        default=Path(__file__).with_name("user_stories.md"),
        help="Path to the user-stories markdown file.",
    )
    parser.add_argument(
        "--repo",
        help="GitHub repository in OWNER/REPOSITORY form. Defaults to gh's current repository.",
    )
    parser.add_argument(
        "--story",
        type=int,
        action="append",
        help="Only import this US number. Repeat to import multiple stories.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the issues without calling GitHub.",
    )
    parser.add_argument(
        "--project",
        default="1",
        help="GitHub project number for EPIC issues. Defaults to the WAYWO project (1).",
    )
    parser.add_argument(
        "--project-owner",
        default="WAYWO-capstone",
        help="GitHub user or organization that owns --project. Defaults to WAYWO-capstone.",
    )
    args = parser.parse_args()

    try:
        if re.search(r"^#\s+Milestone\b", args.markdown.read_text(encoding="utf-8"), re.I | re.M):
            plan = parse_iteration_plan(args.markdown)
            if args.story:
                plan.stories = [
                    story for story in plan.stories if story.number in args.story
                ]
                if not plan.stories:
                    raise ValueError(f"No requested story found: {args.story}")
            process_iteration_plan(
                plan,
                args.repo,
                project_number=args.project,
                project_owner=args.project_owner,
                dry_run=args.dry_run,
            )
        else:
            stories = parse_user_stories(args.markdown)
            if args.story:
                stories = [story for story in stories if story.number in args.story]
                if not stories:
                    raise ValueError(f"No requested story found: {args.story}")
            process(stories, args.repo, args.dry_run)
    except (OSError, RuntimeError, ValueError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())