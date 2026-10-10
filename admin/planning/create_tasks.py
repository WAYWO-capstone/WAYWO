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


def run_gh(
    args: Sequence[str], *, repo: str | None = None, include_repo: bool = True
) -> str:
    command = ["gh", *args]
    if repo and include_repo:
        command.extend(["--repo", repo])
    try:
        result = subprocess.run(
            command, check=True, capture_output=True, text=True
        )
    except FileNotFoundError as error:
        raise RuntimeError("GitHub CLI (gh) is not installed or not on PATH.") from error
    except subprocess.CalledProcessError as error:
        detail = error.stderr.strip() or error.stdout.strip()
        raise RuntimeError(f"GitHub CLI failed: {' '.join(command)}\n{detail}") from error
    return result.stdout.strip()


def create_issue(repo: str | None, title: str, body: str, issue_type: str) -> dict:
    output = run_gh(
        [
            "issue",
            "create",
            "--title",
            title,
            "--body",
            body,
            "--type",
            issue_type,
        ],
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
        if marker in issue_body or (
            planning_number and f"Planning task: #{planning_number}" in issue_body
        ) or (
            parent_title and f"Parent feature: {parent_title}" in issue_body
        ) or marker.startswith("<!-- waywo-import:feature:"):
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
    args = parser.parse_args()

    try:
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