const API_BASE = "/api";

function getToken() {
  return localStorage.getItem("token");
}

function saveToken(token) {
  localStorage.setItem("token", token);
}

function clearToken() {
  localStorage.removeItem("token");
}

async function request(url, options = {}) {
  const token = getToken();

  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let body = options.body;

  if (
    body &&
    typeof body !== "string"
  ) {
    headers["Content-Type"] =
      "application/json";

    body = JSON.stringify(body);
  }

  const response = await fetch(
    `${API_BASE}${url}`,
    {
      ...options,
      headers,
      body,
    }
  );

  const contentType =
    response.headers.get("content-type") || "";

  const data =
    contentType.includes("application/json")
      ? await response.json()
      : await response.text();

  if (response.status === 401) {
    clearToken();
  }

  if (!response.ok) {
    throw new Error(
      typeof data === "string"
        ? data
        : data?.message ||
          `Request failed with ${response.status}`
    );
  }

  return data;
}



export async function login(
  email,
  password
) {
  const data = await request(
    "/auth/login",
    {
      method: "POST",
      body: {
        email,
        password,
      },
    }
  );

  const token =
    data.token ||
    data.jwt ||
    data.accessToken;

  if (!token) {
    throw new Error(
      "Login succeeded but no JWT token was returned."
    );
  }

  saveToken(token);

  return data;
}

export async function register(
  name,
  email,
  password
) {
  const data = await request(
    "/auth/register",
    {
      method: "POST",
      body: {
        name,
        email,
        password,
      },
    }
  );

  const token =
    data.token ||
    data.jwt ||
    data.accessToken;

  if (!token) {
    throw new Error(
      "Registration succeeded but no JWT token was returned."
    );
  }

  saveToken(token);

  return data;
}

export function logout() {
  clearToken();
}

export function isLoggedIn() {
  return Boolean(getToken());
}



export function getProjects() {
  return request("/projects");
}

export function createProject(
  name,
  description,
  type
) {
  return request("/projects", {
    method: "POST",
    body: {
      name,
      description,
      type,
    },
  });
}



export function getProjectFiles(
  projectId
) {
  return request(
    `/projects/${projectId}/files`
  );
}



export function getConversations(
  projectId
) {
  return request(
    `/projects/${projectId}/conversations`
  );
}

export function createConversation(
  projectId,
  title
) {
  return request(
    `/projects/${projectId}/conversations`,
    {
      method: "POST",
      body: {
        title,
      },
    }
  );
}

export function getMessages(
  projectId,
  conversationId
) {
  return request(
    `/projects/${projectId}/conversations/${conversationId}/messages`
  );
}

export function sendAiMessage(
  projectId,
  conversationId,
  message
) {
  return request(
    `/projects/${projectId}/conversations/${conversationId}/ai/chat`,
    {
      method: "POST",
      body: {
        message,
      },
    }
  );
}



export function getAgentTasks(
  projectId,
  runId
) {
  return request(
    `/projects/${projectId}/agent-runs/${runId}/tasks`
  );
}



export function getBuilds(
  projectId
) {
  return request(
    `/projects/${projectId}/builds`
  );
}

export function getPreviewUrl(
  projectId,
  buildId
) {
  return `/api/projects/${projectId}/previews/${buildId}`;
}

export async function updateProjectFile(projectId, path, content) {
  return request(
    `/projects/${projectId}/files/content?path=${encodeURIComponent(path)}`,
    {
      method: "PUT",
      body: {
        path,
        content
      }
    }
  );
}

export async function createBuild(projectId) {
  return request(
    `/projects/${projectId}/builds?command=${encodeURIComponent("npm run build")}`,
    {
      method: "POST"
    }
  );
}

export async function executeBuild(projectId, buildId) {
  return request(
    `/projects/${projectId}/builds/${buildId}/execute`,
    {
      method: "POST"
    }
  );
}

export async function getBuild(projectId, buildId) {
  return request(
    `/projects/${projectId}/builds/${buildId}`,
    {
      method: "GET"
    }
  );
}

export async function getAgentRun(projectId, runId) {
  return request(
    `/projects/${projectId}/agent-runs/${runId}`,
    {
      method: "GET"
    }
  );
}

export async function getVersions(projectId) {
  return request(
    `/projects/${projectId}/versions`,
    {
      method: "GET"
    }
  )
}

export async function restoreVersion(projectId, versionNumber) {
  return request(
    `/projects/${projectId}/versions/${versionNumber}/restore`,
    {
      method: "POST"
    }
  )
}

// ==================== DEPLOYMENTS ====================

export async function deployProject(projectId) {
  return request(
    `/projects/${projectId}/deployments`,
    {
      method: "POST"
    }
  );
}

export async function getLatestDeployment(projectId) {
  return request(
    `/projects/${projectId}/deployments/latest`,
    {
      method: "GET"
    }
  );
}

export async function getDeployments(projectId) {
  return request(
    `/projects/${projectId}/deployments`,
    {
      method: "GET"
    }
  );
}