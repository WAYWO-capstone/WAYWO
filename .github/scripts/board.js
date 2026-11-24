// Project board automation for WAYWO.
// Used by .github/workflows/board-sync.yml and .github/workflows/board-pr.yml.
//
//   Task flow:            Backlog -> Ready -> In progress -> In review -> Done
//   User story flow:      Backlog -> Ready -> In progress -> In review -> Done
//   Acceptance test flow: Backlog -> Ready -> Acceptance Tests -> Done
//
// Rules:
//   1. A sub-task moves to In progress (or later)     -> its user story moves to In progress.
//   2. All sub-tasks of a user story are closed       -> the user story moves to In review.
//   3. A user story is Done (column or closed)        -> its acceptance tests move to Acceptance Tests.
//   4. New issue opened                               -> added to the board in Backlog.
//   5. PR opened                                      -> PR in In progress; the issues it closes go to In review.
//      Review requested / review submitted            -> PR in In review.
//      PR merged                                      -> PR and the issues it closes go to Done; those issues are closed.
//
// "The issues it closes" are read from the PR description ("Closes #12", "Fixes #12", "Resolves #12"), not from
// GitHub's own linking: GitHub only honours those keywords on PRs into the default branch, and our PRs go into
// iteration-* branches. Closing issues needs the ADMIN_TOKEN secret to have write access to issues.
// GitHub's built-in "Item closed" -> Done project workflow still covers issues closed by hand.
//
// Status only ever moves forward through the column order (except a reopened PR),
// so the automation never drags a card backwards that someone moved by hand.

const CONFIG = {
  // The board URL looks like github.com/users/<owner>/projects/<number> or github.com/orgs/<owner>/projects/<number>.
  projectOwner: process.env.PROJECT_OWNER, // defaults to the repository owner
  projectNumber: Number(process.env.PROJECT_NUMBER),
  statusField: 'Status',

  // Column names exactly as they appear on the board, in workflow order.
  columns: {
    backlog: 'Backlog',
    ready: 'Ready',
    inProgress: 'In progress',
    inReview: 'In review',
    acceptance: 'Acceptance Tests',
    done: 'Done',
  },

  // A user story: an issue of type "Feature". Its story number comes from the title: "US 19: ..." is story 19
  // (an epic prefix is ignored, so "US 3.19" is also story 19).
  storyType: 'Feature',
  storyTitle: /\bUS[-\s]?(?:\d+\.)?(\d+)\b/i,

  // An acceptance test: an issue of type "Acceptance Test", or with the "acceptance-test" label.
  // Titles look like "AT 3.19: Document Problems and Solutions" (epic 3, story 19).
  // ATs aren't linked to their story. The story is found from the AT itself, in this order:
  //   1. the "Link to user story:" line in the description: "[#143](.../issues/143) - US 19: ..." -> issue #143
  //   2. the AT title: "AT 3.19: ..." -> story US 19 (epic 3 is ignored); "AT 19" and "AT US 19" also work
  //   3. the "As a ... so that ..." sentence in the description, matched against each story's description
  //   4. the first "US 19", "#143" or ".../issues/143" anywhere in the description
  atType: 'Acceptance Test',
  atLabel: 'acceptance-test',
  atStoryNumber: /\b(?:AT|US)[-\s]?(?:US[-\s]?)?(?:\d+\.)?(\d+)\b/i,
};

module.exports = ({ github, context, core }) => {
  const C = CONFIG.columns;
  const ORDER = [C.backlog, C.ready, C.inProgress, C.inReview, C.acceptance, C.done].map((s) => s.toLowerCase());
  const rank = (status) => (status ? ORDER.indexOf(status.toLowerCase()) : -1);

  const gql = (query, vars = {}) =>
    github.graphql(query, { ...vars, headers: { 'GraphQL-Features': 'sub_issues,issue_types' } });

  const labelsOf = (i) => (i.labels?.nodes ?? []).map((l) => l.name.toLowerCase());
  const typeOf = (i) => (i.issueType?.name ?? '').toLowerCase();
  const isAT = (i) => typeOf(i) === CONFIG.atType.toLowerCase() || labelsOf(i).includes(CONFIG.atLabel);
  const isStory = (i) => !isAT(i) && typeOf(i) === CONFIG.storyType.toLowerCase();
  const storyNumber = (i) => {
    const m = i.title.match(CONFIG.storyTitle);
    return m ? Number(m[1]) : null;
  };
  const closedAsDone = (i) => i.state === 'CLOSED' && !['NOT_PLANNED', 'DUPLICATE'].includes(i.stateReason);
  const describe = (c) => `#${c.number} ${c.title}`;

  // ---------- project access ----------

  let project;
  async function loadProject() {
    if (project) return project;
    const owner = CONFIG.projectOwner || context.repo.owner;
    if (!CONFIG.projectNumber) {
      throw new Error('Set the PROJECT_NUMBER repository variable (Settings → Secrets and variables → Actions → Variables).');
    }
    let p;
    try {
      const res = await gql(
        `query($login: String!, $number: Int!, $field: String!) {
          repositoryOwner(login: $login) {
            ... on Organization { projectV2(number: $number) { ...P } }
            ... on User { projectV2(number: $number) { ...P } }
          }
        }
        fragment P on ProjectV2 {
          id title
          field(name: $field) { ... on ProjectV2SingleSelectField { id options { id name } } }
        }`,
        { login: owner, number: CONFIG.projectNumber, field: CONFIG.statusField },
      );
      p = res.repositoryOwner?.projectV2;
    } catch (err) {
      throw new Error(
        `Could not open project #${CONFIG.projectNumber} owned by ${owner}. ` +
          `Check PROJECT_OWNER / PROJECT_NUMBER and that the ADMIN_TOKEN secret has Projects read and write access. (${err.message})`,
      );
    }
    if (!p) throw new Error(`Project #${CONFIG.projectNumber} not found for ${owner}.`);
    if (!p.field) throw new Error(`Project "${p.title}" has no single-select field named "${CONFIG.statusField}".`);

    const options = new Map(p.field.options.map((o) => [o.name.toLowerCase(), o]));
    for (const name of Object.values(C)) {
      if (!options.has(name.toLowerCase())) {
        core.warning(
          `Column "${name}" is not on the board, so rules that use it are skipped. ` +
            `Board columns: ${p.field.options.map((o) => o.name).join(', ')}. Edit CONFIG.columns in .github/scripts/board.js.`,
        );
      }
    }
    project = { id: p.id, fieldId: p.field.id, options };
    return project;
  }

  // Adds the issue/PR to the board if it isn't there yet (no-op if it is) and returns its item.
  async function ensureItem(content) {
    const p = await loadProject();
    const res = await gql(
      `mutation($project: ID!, $content: ID!, $field: String!) {
        addProjectV2ItemById(input: { projectId: $project, contentId: $content }) {
          item { id status: fieldValueByName(name: $field) { ... on ProjectV2ItemFieldSingleSelectValue { name } } }
        }
      }`,
      { project: p.id, content: content.id, field: CONFIG.statusField },
    );
    const item = res.addProjectV2ItemById.item;
    return { id: item.id, status: item.status?.name ?? null, content };
  }

  async function setStatus(rec, target, { force = false, why = '' } = {}) {
    const p = await loadProject();
    const option = p.options.get(target.toLowerCase());
    if (!option) return false;
    if (rec.status && rec.status.toLowerCase() === target.toLowerCase()) return false;
    if (!force && rank(rec.status) >= rank(target)) return false;

    await gql(
      `mutation($project: ID!, $item: ID!, $field: ID!, $option: String!) {
        updateProjectV2ItemFieldValue(input: {
          projectId: $project, itemId: $item, fieldId: $field, value: { singleSelectOptionId: $option }
        }) { projectV2Item { id } }
      }`,
      { project: p.id, item: rec.id, field: p.fieldId, option: option.id },
    );
    core.info(`${describe(rec.content)}: ${rec.status ?? '(no status)'} → ${option.name}${why ? `   [${why}]` : ''}`);
    rec.status = option.name;
    return true;
  }

  async function fetchIssueItems() {
    const p = await loadProject();
    const items = [];
    let after = null;
    do {
      const res = await gql(
        `query($id: ID!, $after: String, $field: String!) {
          node(id: $id) { ... on ProjectV2 {
            items(first: 100, after: $after) {
              pageInfo { hasNextPage endCursor }
              nodes {
                id
                status: fieldValueByName(name: $field) { ... on ProjectV2ItemFieldSingleSelectValue { name } }
                content { ... on Issue {
                  __typename id number title body state stateReason issueType { name }
                  labels(first: 10) { nodes { name } }
                  parent { id number title }
                  subIssues(first: 50) { nodes {
                    id number title state stateReason issueType { name } labels(first: 10) { nodes { name } }
                  } }
                } }
              }
            }
          } }
        }`,
        { id: p.id, after, field: CONFIG.statusField },
      );
      const page = res.node.items;
      for (const n of page.nodes) {
        if (n.content?.__typename === 'Issue') items.push({ id: n.id, status: n.status?.name ?? null, content: n.content });
      }
      after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    } while (after);
    return items;
  }

  // ---------- which story an acceptance test belongs to ----------

  const normalize = (t) => (t ?? '').toLowerCase().replace(/[*_`>#]/g, ' ').replace(/\s+/g, ' ').trim();
  const userStorySentence = (body) => {
    const m = normalize(body).match(/\bas an? .+? so that .+?(?:\.|$)/);
    return m ? m[0].replace(/\.$/, '') : null;
  };

  function findStoryFor(at, stories) {
    const byStoryNumber = (n) => stories.find((s) => storyNumber(s.content) === n);
    const byIssueNumber = (n) => stories.find((s) => s.content.number === n);
    const body = at.body ?? '';

    // 1. The "Link to user story:" line, e.g. "[#143](https://github.com/.../issues/143) - US 19: ...".
    const link = body.match(/link to (?:the )?user story[^\n]*\n?\s*[^\n]*?(?:#|\/issues\/)(\d+)/i);
    if (link && byIssueNumber(Number(link[1]))) return byIssueNumber(Number(link[1]));

    // 2. The AT title: "AT 3.19" (epic 3, story 19), "AT 19", "AT US 19", "#143".
    const titleIssue = at.title.match(/#(\d+)/);
    if (titleIssue && byIssueNumber(Number(titleIssue[1]))) return byIssueNumber(Number(titleIssue[1]));
    const titleStory = at.title.match(CONFIG.atStoryNumber);
    if (titleStory && byStoryNumber(Number(titleStory[1]))) return byStoryNumber(Number(titleStory[1]));

    // 3. The user story sentence copied into the description.
    const sentence = userStorySentence(body);
    if (sentence) {
      const found = stories.find((s) => userStorySentence(s.content.body) === sentence);
      if (found) return found;
    }

    // 4. The first story reference anywhere in the description.
    const ref = body.match(/\bUS[-\s]?(?:\d+\.)?(\d+)\b|(?:#|\/issues\/)(\d+)\b/i);
    if (ref) {
      const found = ref[1] ? byStoryNumber(Number(ref[1])) : byIssueNumber(Number(ref[2]));
      if (found) return found;
    }
    return null;
  }

  // ---------- rules 1–3: full board sync ----------

  async function sync() {
    const items = await fetchIssueItems();
    const byContent = new Map(items.map((r) => [r.content.id, r]));
    const recordFor = async (content) => {
      let rec = byContent.get(content.id);
      if (!rec) {
        rec = await ensureItem(content);
        byContent.set(content.id, rec);
        core.info(`Added ${describe(content)} to the board`);
      }
      return rec;
    };
    let changes = 0;

    // Rule 1: sub-task started -> parent In Progress.
    for (const child of items) {
      const parent = child.content.parent;
      if (!parent || isAT(child.content)) continue;
      if (rank(child.status) < rank(C.inProgress)) continue;
      const rec = await recordFor(parent);
      if (await setStatus(rec, C.inProgress, { why: `sub-task #${child.content.number} is ${child.status}` })) changes++;
    }

    // Rule 2: every sub-task closed -> story In Review.
    // (Closed as "not planned" or duplicate counts as finished here too; AT sub-issues are ignored.)
    for (const story of items) {
      const c = story.content;
      if (!isStory(c)) continue;
      const tasks = c.subIssues.nodes.filter((t) => !isAT(t));
      if (tasks.length && tasks.every((t) => t.state === 'CLOSED')) {
        if (await setStatus(story, C.inReview, { why: 'all sub-tasks closed' })) changes++;
      }
    }

    // Rule 3: story Done -> its acceptance tests to Acceptance Test.
    const stories = items.filter((r) => isStory(r.content));
    for (const at of items) {
      const c = at.content;
      if (!isAT(c) || c.state === 'CLOSED') continue;
      const story = findStoryFor(c, stories);
      if (!story) {
        core.info(`Could not tell which user story ${describe(c)} belongs to; skipped.`);
        continue;
      }
      const storyDone = rank(story.status) >= rank(C.done) || closedAsDone(story.content);
      if (storyDone && (await setStatus(at, C.acceptance, { why: `story ${describe(story.content)} is done` }))) changes++;
    }

    core.info(`Board sync finished: ${changes} change(s) across ${items.length} issue(s).`);
  }

  // ---------- rule 4: new issues ----------

  async function addNewIssue(issue) {
    const rec = await ensureItem({ id: issue.node_id, number: issue.number, title: issue.title });
    await setStatus(rec, C.backlog, { why: 'new issue' });
  }

  // One-time catch-up: put every open issue of this repo on the board (Backlog if it has no column yet).
  async function addAllOpenIssues() {
    let after = null;
    let added = 0;
    do {
      const res = await gql(
        `query($owner: String!, $name: String!, $after: String) {
          repository(owner: $owner, name: $name) {
            issues(first: 100, after: $after, states: OPEN) {
              pageInfo { hasNextPage endCursor }
              nodes { id number title }
            }
          }
        }`,
        { owner: context.repo.owner, name: context.repo.repo, after },
      );
      const page = res.repository.issues;
      for (const issue of page.nodes) {
        const rec = await ensureItem(issue);
        if (!rec.status && (await setStatus(rec, C.backlog, { why: 'added by catch-up run' }))) added++;
      }
      after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    } while (after);
    core.info(`Catch-up finished: ${added} issue(s) newly placed in ${C.backlog}.`);
  }

  // ---------- rule 5: pull requests ----------

  // "Closes #12", "fixes: #12", "Resolved owner/repo#12". Same keywords as .github/workflows/pr-links-issue.yml.
  const CLOSING = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?):?\s+(?:([\w.-]+)\/([\w.-]+))?#(\d+)/gi;

  // Issues (not PRs) in this repo that the PR description says it closes.
  async function linkedIssues(pr) {
    const { owner, repo } = context.repo;
    const numbers = new Set();
    for (const m of (pr.body ?? '').matchAll(CLOSING)) {
      const sameRepo = !m[1] || (m[1].toLowerCase() === owner.toLowerCase() && m[2].toLowerCase() === repo.toLowerCase());
      if (sameRepo) numbers.add(Number(m[3]));
    }
    const issues = [];
    for (const number of numbers) {
      try {
        const { data } = await github.rest.issues.get({ owner, repo, issue_number: number });
        if (data.pull_request) continue; // "#N" pointed at a PR, not an issue
        issues.push({ id: data.node_id, number: data.number, title: data.title, state: data.state });
      } catch (err) {
        core.warning(`PR #${pr.number} says it closes #${number}, but that issue couldn't be loaded; skipped. (${err.message})`);
      }
    }
    return issues;
  }

  async function handlePullRequest() {
    const { eventName, payload } = context;
    const pr = payload.pull_request;
    const action = payload.action;
    const rec = await ensureItem({ id: pr.node_id, number: pr.number, title: `(PR) ${pr.title}` });

    if (eventName === 'pull_request_review') {
      if (action !== 'submitted') return;
      if (payload.review.user.login === pr.user.login) return; // author replying to comments isn't a review
      await setStatus(rec, C.inReview, { why: `${payload.review.user.login} left a review (${payload.review.state})` });
      return;
    }

    // Merged: the PR and the issues it closes go to Done, and those issues are closed.
    // (A PR closed without merging is left where it is.)
    if (action === 'closed') {
      if (!pr.merged) return;
      await setStatus(rec, C.done, { why: `PR merged into ${pr.base.ref}` });
      const failed = [];
      for (const issue of await linkedIssues(pr)) {
        const issueRec = await ensureItem(issue);
        await setStatus(issueRec, C.done, { why: `PR #${pr.number} merged` });
        if (issue.state !== 'open') continue;
        try {
          await github.rest.issues.update({
            ...context.repo,
            issue_number: issue.number,
            state: 'closed',
            state_reason: 'completed',
          });
          core.info(`Closed #${issue.number} (PR #${pr.number} merged)`);
        } catch (err) {
          failed.push(`#${issue.number} (${err.message})`);
        }
      }
      if (failed.length) {
        core.setFailed(
          `Could not close ${failed.join(', ')}. The ADMIN_TOKEN secret needs write access to issues in this repository ` +
            `(classic token: "repo" scope; fine-grained token: Issues → Read and write).`,
        );
      }
      return;
    }

    if (action === 'reopened') await setStatus(rec, C.inProgress, { force: true, why: 'PR reopened' });
    if (action === 'opened' || action === 'ready_for_review') await setStatus(rec, C.inProgress, { why: 'PR opened' });
    if (action === 'review_requested') await setStatus(rec, C.inReview, { why: 'review requested' });

    // Issues this PR will close ("Closes #12") go to In review. Rule 1 then moves their story to In progress.
    if (['opened', 'reopened', 'ready_for_review', 'edited'].includes(action)) {
      for (const issue of await linkedIssues(pr)) {
        const issueRec = await ensureItem(issue);
        await setStatus(issueRec, C.inReview, { why: `PR #${pr.number} closes it` });
      }
    }
  }

  return { sync, addNewIssue, addAllOpenIssues, handlePullRequest, _config: CONFIG };
};