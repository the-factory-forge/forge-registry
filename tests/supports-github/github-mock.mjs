export function githubMock() {
  let nextId = 1000;
  const repository = {
    id: 40,
    installationId: 50,
    botUserId: 60,
    owner: "sample",
    name: "website",
  };
  const bot = { id: 60, login: "support-bridge[bot]" };
  const human = { id: 70, login: "maintainer" };
  const issues = [],
    comments = new Map(),
    fields = new Map(),
    events = new Map(),
    calls = [];
  const settings = {
    private: true,
    denied: false,
    fail: /** @type {"create" | "comment" | "priority" | null} */ (null),
    lose: /** @type {"create" | "comment" | "priority" | "type" | null} */ (null),
    omitTypeOnCreate: false,
    hideIssueReceipts: false,
    moved: false,
  };
  const timestamp = () => new Date().toISOString();
  function externalComment(number, body, user = human) {
    const item = { id: ++nextId, body, user, created_at: timestamp() };
    comments.get(number).push(item);
    return item;
  }
  function setStatus(number, status, user = human) {
    const issue = issues.find((item) => item.number === number);
    Object.assign(issue, { ...status, updated_at: timestamp() });
    const event = {
      id: ++nextId,
      event: issue.state === "open" ? "reopened" : "closed",
      actor: user,
      created_at: timestamp(),
    };
    events.get(number).push(event);
    return event;
  }
  async function request(url, init = {}) {
    const parsed = new URL(url);
    const path = parsed.pathname;
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ path, method, body, headers: init.headers });
    if (settings.denied) return Response.json({}, { status: 403 });
    if (path === `/repositories/${repository.id}`)
      return Response.json({
        id: repository.id,
        private: settings.private,
        visibility: settings.private ? "private" : "public",
        full_name: "sample/website",
        archived: false,
        has_issues: true,
      });
    const number = Number(path.split("/")[5]);
    if (settings.moved && number) return Response.json({}, { status: 404 });
    const page = (rows) => {
      const offset = (Number(parsed.searchParams.get("page") ?? 1) - 1) * 100;
      return Response.json(rows.slice(offset, offset + 100));
    };
    const base = "/repos/sample/website/issues";
    if (path === base && method === "GET")
      return page(settings.hideIssueReceipts ? [] : issues.slice().reverse());
    if (path === base && method === "POST") {
      if (settings.fail === "create") return Response.json({}, { status: 422 });
      if (body.type && !["Defect", "Feature", "Question"].includes(body.type))
        return Response.json({}, { status: 422 });
      const issue = {
        id: ++nextId,
        number: issues.length + 1,
        ...body,
        type: body.type && !settings.omitTypeOnCreate ? { name: body.type } : null,
        state: "open",
        state_reason: null,
        user: bot,
        created_at: timestamp(),
        updated_at: timestamp(),
      };
      issues.push(issue);
      fields.set(issue.number, [
        { issue_field_id: 12, data_type: "text", value: "Keep this field" },
      ]);
      comments.set(issue.number, []);
      events.set(issue.number, []);
      if (settings.lose === "create") {
        settings.lose = null;
        return Response.json({}, { status: 503 });
      }
      return Response.json(issue, { status: 201 });
    }
    const fieldRoute = `${base}/${number}/issue-field-values`;
    if (path === fieldRoute || path.startsWith(fieldRoute + "/")) {
      const values = fields.get(number);
      if (!values) return Response.json({}, { status: 404 });
      if (method === "GET") return page(values);
      if (settings.fail === "priority") return Response.json({}, { status: 503 });
      if (method === "DELETE" && path === fieldRoute + "/83") {
        const index = values.findIndex((field) => field.issue_field_id === 83);
        if (index === -1) return Response.json({}, { status: 404 });
        values.splice(index, 1);
        return new Response(null, { status: 204 });
      }
      const [field] = body?.issue_field_values ?? [];
      if (
        method !== "POST" ||
        field?.field_id !== 83 ||
        !["Urgent", "High", "Medium", "Low"].includes(field.value)
      )
        return Response.json({}, { status: 422 });
      fields.set(number, [
        ...values.filter((entry) => entry.issue_field_id !== field.field_id),
        {
          issue_field_id: field.field_id,
          data_type: "single_select",
          single_select_option: { name: field.value },
        },
      ]);
      if (settings.lose === "priority") {
        settings.lose = null;
        return Response.json({}, { status: 503 });
      }
      return Response.json(fields.get(number));
    }
    if (path.endsWith("/comments")) {
      if (method === "GET") return page(comments.get(number) ?? []);
      if (settings.fail === "comment") return Response.json({}, { status: 422 });
      const comment = externalComment(number, body.body, bot);
      if (settings.lose === "comment") {
        settings.lose = null;
        return Response.json({}, { status: 503 });
      }
      return Response.json(comment, { status: 201 });
    }
    if (path.endsWith("/events")) return page(events.get(number) ?? []);
    const issue = issues.find((item) => item.number === number);
    if (!issue) return Response.json({}, { status: 404 });
    if (method === "PATCH" && "type" in body) {
      if (!["Defect", "Feature", "Question"].includes(body.type))
        return Response.json({}, { status: 422 });
      issue.type = { name: body.type };
      if (settings.lose === "type") {
        settings.lose = null;
        return Response.json({}, { status: 503 });
      }
    }
    if (method === "PATCH" && body.state && issue.state !== body.state)
      setStatus(number, body, bot);
    return Response.json(issue);
  }
  return {
    repository,
    bot,
    human,
    issues,
    comments,
    fields,
    events,
    calls,
    settings,
    request,
    externalComment,
    setStatus,
  };
}
