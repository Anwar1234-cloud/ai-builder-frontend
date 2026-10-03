import { useEffect, useMemo, useState } from "react";
import Editor from "@monaco-editor/react";

import {
  login,
  register,
  logout,
  isLoggedIn,
  getProjects,
  createProject,
  getProjectFiles,
  getConversations,
  createConversation,
  getMessages,
  sendAiMessage,
  getAgentTasks,
  getBuilds,
  getPreviewUrl,
  updateProjectFile,
  createBuild,
  executeBuild,
  getBuild,
  getAgentRun,
  getVersions,
  restoreVersion,
} from "./api";

import "./index.css";

function App() {
  const [authenticated, setAuthenticated] =
    useState(isLoggedIn());

  const [authMode, setAuthMode] =
    useState("login");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [name, setName] =
    useState("");

  const [authLoading, setAuthLoading] =
    useState(false);

  const [authError, setAuthError] =
    useState("");

  const [projects, setProjects] =
    useState([]);

  const [selectedProject, setSelectedProject] =
    useState(null);

  const [files, setFiles] =
    useState([]);

  const [agentRunId, setAgentRunId] = 
    useState(null);
  const [agentStatus, setAgentStatus] =
    useState(null);
  
  

  const [conversations, setConversations] =
    useState([]);

  const [conversationId, setConversationId] =
    useState(null);

  const [messages, setMessages] =
    useState([]);

  const [tasks, setTasks] =
    useState([]);

  const [builds, setBuilds] =
    useState([]);

  const [message, setMessage] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [loadingProjects, setLoadingProjects] =
    useState(false);

  const [error, setError] =
    useState("");

  const [
    showCreateProject,
    setShowCreateProject,
  ] = useState(false);

  const [projectName, setProjectName] =
    useState("");

  const [
    projectDescription,
    setProjectDescription,
  ] = useState("");

  const [projectType, setProjectType] =
    useState("WEBSITE");


  const [expandedPanel, setExpandedPanel] = useState(null); 

  const [manualBuildLoading, setManualBuildLoading] =
   useState(false);
  const [buildMessage, setBuildMessage] = useState("");

  const [versions, setVersions] =
   useState([]);

  const [restoringVersion, setRestoringVersion] =
   useState(null);

  

  function toggleExpand(panel) {
    setExpandedPanel(current => (current === panel ? null : panel));
  } 

  const latestBuild = useMemo(() => {
    return builds.length
      ? builds[0]
      : null;
  }, [builds]);

    const sleep = (ms) =>
  new Promise(resolve => setTimeout(resolve, ms));

 const pollAgentRun = async (
   projectId,
   runId
  ) => {

    while (true) {

     const run =
       await getAgentRun(
         projectId,
         runId
        );

        setAgentRunId(runId);

     const currentTasks =
      await getAgentTasks(
        projectId,
        runId
      );

     setTasks(currentTasks);

     setAgentStatus(
       run.status
      );

     const currentBuilds =
       await getBuilds(
         projectId
        );

      setBuilds(currentBuilds);

      if (
        run.status === "COMPLETED" ||
        run.status === "FAILED"
      ) {

        const [
          history,
          finalFiles,
          finalBuilds
        ] = await Promise.all([
          getMessages(
            projectId,
            conversationId
          ),
          getProjectFiles(
            projectId
          ),
          getBuilds(
            projectId
          )
        ]);

        setMessages(history);
        setFiles(finalFiles);
        setBuilds(finalBuilds);

        const successfulBuild =
          finalBuilds.find(
            build =>
              build.status === "SUCCESS"
          );

        if (successfulBuild) {



          setPreviewUrl(
            `${getPreviewUrl(
              projectId,
              successfulBuild.id
            )}?t=${Date.now()}`
         );
        }

        break;
      }

      await sleep(1500);
    }
  }; 

  const handleBuild = async () => {
  if (!selectedProject) return;

  try {
    setManualBuildLoading(true);
    setBuildMessage("Saving...");

    // Save current editor changes first
    if (selectedFile) {
      await handleSaveFile();
    }

    setBuildMessage("Creating build...");

    const build = await createBuild(selectedProject.id);

    setBuildMessage("Building...");

    await executeBuild(
      selectedProject.id,
      build.id
    );

    let currentBuild = build;

    while (
      currentBuild.status !== "SUCCESS" &&
      currentBuild.status !== "FAILED"
    ) {
      await new Promise(resolve =>
        setTimeout(resolve, 1500)
      );

      currentBuild = await getBuild(
        selectedProject.id,
        build.id
      );
    }

    setBuilds(prev => [
      currentBuild,
      ...prev.filter(b => b.id !== currentBuild.id)
    ]);

    setBuildMessage(
      currentBuild.status === "SUCCESS"
        ? "Build successful"
        : "Build failed"
    );

  } catch (error) {
    console.error(error);
    setBuildMessage("Build failed");
  } finally {
    setManualBuildLoading(false);
  }
};

const handleSaveFile = async () => {
  if (!selectedFile || !selectedProject) return;

  try {
    setSaving(true);
    setSaveMessage("");

    await updateProjectFile(
      selectedProject.id,
      selectedFile.path,
      editorContent
    );

    setSelectedFile({
      ...selectedFile,
      content: editorContent
    });

    setFiles(prev =>
      prev.map(file =>
        file.id === selectedFile.id
          ? { ...file, content: editorContent }
          : file
      )
    );

    setSaveMessage("Saved");
  } catch (error) {
    console.error(error);
    setSaveMessage("Save failed");
  } finally {
    setSaving(false);
  }
};

  const [selectedFile, setSelectedFile] = useState(null);
  const [editorContent, setEditorContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");  
  

  const handleFileSelect = (file) => {
  setSelectedFile(file);
  setEditorContent(file.content || "");
  };

  const previewUrl =
    selectedProject &&
    latestBuild?.status === "SUCCESS"
      ? getPreviewUrl(
          selectedProject.id,
          latestBuild.id
        )
      : null;

  useEffect(() => {
    if (authenticated) {
      loadProjects();
    }
  }, [authenticated]);

  async function loadProjects() {
    try {
      setLoadingProjects(true);
      setError("");

      const data =
        await getProjects();

      setProjects(data);
    } catch (err) {
      setError(err.message);

      if (
        err.message.includes("401")
      ) {
        handleLogout();
      }
    } finally {
      setLoadingProjects(false);
    }
  }

  async function handleAuthSubmit(
    event
  ) {
    event.preventDefault();

    try {
      setAuthLoading(true);
      setAuthError("");

      if (authMode === "login") {
        await login(
          email,
          password
        );
      } else {
        await register(
          name,
          email,
          password
        );
      }

      setAuthenticated(true);

      setEmail("");
      setPassword("");
      setName("");

    } catch (err) {
      setAuthError(
        err.message
      );
    } finally {
      setAuthLoading(false);
    }
  }

  function handleLogout() {
    logout();

    setAuthenticated(false);
    setSelectedProject(null);
    setProjects([]);
    setMessages([]);
    setTasks([]);
    setFiles([]);
    setBuilds([]);
  }

  async function handleCreateProject(
    event
  ) {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");

      const project =
        await createProject(
          projectName,
          projectDescription,
          projectType
        );

      setProjects(current => [
        project,
        ...current,
      ]);

      setProjectName("");
      setProjectDescription("");
      setProjectType("WEBSITE");

      setShowCreateProject(false);

      await openProject(project);

    } catch (err) {
      setError(
        err.message
      );
    } finally {
      setLoading(false);
    }
  }

  async function openProject(
    project
  ) {
    try {
      setLoading(true);
      setError("");

      setSelectedProject(project);

      const [
        projectFiles,
        projectConversations,
        projectBuilds,
      ] = await Promise.all([
        getProjectFiles(
          project.id
        ),
        getConversations(
          project.id
        ),
        getBuilds(
          project.id
        ),
      ]);

      setFiles(projectFiles);
      setBuilds(projectBuilds);
      setConversations(
        projectConversations
      );

      let conversation =
        projectConversations[0];

      if (!conversation) {
        conversation =
          await createConversation(
            project.id,
            "AI Builder"
          );
      }

      setConversationId(
        conversation.id
      );

      const history =
        await getMessages(
          project.id,
          conversation.id
        );

      setMessages(history);

      setTasks([]);

    } catch (err) {
      setError(
        err.message
      );
    } finally {
      setLoading(false);
    }
  }

  function goBack() {
    setSelectedProject(null);
    setConversationId(null);
    setMessages([]);
    setTasks([]);
    setFiles([]);
    setBuilds([]);
    setError("");
  }

  async function handleSend() {

    const trimmed =
      message.trim();

    if (
      !trimmed ||
      !selectedProject ||
      !conversationId
    ) {
      return;
    }

    try {

      setLoading(true);
      setError("");

      const response =
        await sendAiMessage(
          selectedProject.id,
          conversationId,
          trimmed
        );

      setMessage("");

     // Agent run now starts immediately
      if (response.agentRunId) {

        setAgentRunId(
          response.agentRunId
        );

        setAgentStatus(
          "RUNNING"
        );

        setTasks([]);

        await pollAgentRun(
          selectedProject.id,
          response.agentRunId
       );
      }

    } catch (err) {

      setError(
        err.message
      );

    } finally {

      setLoading(false);
    }
  }

  const getEditorLanguage = (path) => {
  if (path.endsWith(".jsx")) return "javascript";
  if (path.endsWith(".js")) return "javascript";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".md")) return "markdown";

  return "plaintext";
  };

  function handleKeyDown(
    event
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      handleSend();
    }
  }

    const handleRestoreVersion = async (version) => {
    if (!selectedProject) return;

    const confirmed = window.confirm(
      `Restore version ${version.versionNumber}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setRestoringVersion(
        version.versionNumber
      );

      // Restore version in backend
      await restoreVersion(
        selectedProject.id,
        version.versionNumber
      );

      // Reload project files
      const newFiles =
        await getProjectFiles(
          selectedProject.id
        );

      setFiles(newFiles);

      // Clear currently open editor
      setSelectedFile(null);
      setEditorContent("");

      // Reload versions
      const newVersions =
        await getVersions(
          selectedProject.id
        );

      setVersions(newVersions);

      // Build restored project
      const build =
        await createBuild(
          selectedProject.id
        );

      setBuildMessage(
        "Building restored version..."
      );

      await executeBuild(
        selectedProject.id,
        build.id
      );

      let currentBuild = build;

      while (
        currentBuild.status !== "SUCCESS" &&
        currentBuild.status !== "FAILED"
      ) {
        await new Promise(
          resolve =>
            setTimeout(resolve, 1500)
        );

        currentBuild =
          await getBuild(
            selectedProject.id,
            build.id
          );
      }

      setLatestBuild(
        currentBuild
      );

      setBuilds(
        await getBuilds(
          selectedProject.id
        )
      );

      if (
        currentBuild.status === "SUCCESS"
      ) {
        setPreviewUrl(
          `${getPreviewUrl(
            selectedProject.id,
            currentBuild.id
          )}?t=${Date.now()}`
        );

        setBuildMessage(
          `Version ${version.versionNumber} restored successfully`
        );
      } else {
        setBuildMessage(
          "Restored version but build failed"
       );
      }

    } catch (error) {

      console.error(error);

      setBuildMessage(
        "Restore failed"
      );

    } finally {

      setRestoringVersion(null);
    }
  };

  useEffect(() => {
  if (!selectedProject) {
    setVersions([]);
    return;
  }

  const loadVersions = async () => {
    try {
      const data = await getVersions(
        selectedProject.id
      );

      setVersions(data);
    } catch (error) {
      console.error(
        "Failed to load versions:",
        error
      );
    }
  };

  loadVersions();
}, [selectedProject]);

  if (!authenticated) {
    return (
      <div className="auth-page">

        <div className="auth-card">

          <div className="auth-logo">
            AI
          </div>

          <h1>
            AI Builder
          </h1>

          <p className="auth-subtitle">
            Build websites and applications
            with AI.
          </p>

          {authError && (
            <div className="error-banner">
              {authError}
            </div>
          )}

          <form
            onSubmit={
              handleAuthSubmit
            }
          >

            {authMode ===
              "register" && (
              <label>
                Name

                <input
                  value={name}
                  onChange={event =>
                    setName(
                      event.target.value
                    )
                  }
                  placeholder="Your name"
                  required
                />
              </label>
            )}

            <label>
              Email

              <input
                type="email"
                value={email}
                onChange={event =>
                  setEmail(
                    event.target.value
                  )
                }
                placeholder="you@example.com"
                required
              />
            </label>

            <label>
              Password

              <input
                type="password"
                value={password}
                onChange={event =>
                  setPassword(
                    event.target.value
                  )
                }
                placeholder="••••••••"
                required
              />
            </label>

            <button
              className="auth-button"
              disabled={authLoading}
            >
              {authLoading
                ? "Please wait..."
                : authMode ===
                  "login"
                ? "Login"
                : "Create account"}
            </button>

          </form>

          <button
            className="auth-switch"
            onClick={() => {
              setAuthMode(
                authMode ===
                  "login"
                  ? "register"
                  : "login"
              );

              setAuthError("");
            }}
          >
            {authMode ===
            "login"
              ? "Don't have an account? Register"
              : "Already have an account? Login"}
          </button>

        </div>

      </div>
    );
  }

  if (!selectedProject) {
    return (
      <div className="dashboard-page">

        <header className="dashboard-header">

          <div>
            <h1>
              AI Builder
            </h1>

            <p>
              Your projects
            </p>
          </div>

          <div className="dashboard-actions">

            <button
              className="secondary-button"
              onClick={
                loadProjects
              }
            >
              Refresh
            </button>

            <button
              className="primary-button"
              onClick={() =>
                setShowCreateProject(
                  true
                )
              }
            >
              + New Project
            </button>

            <button
              className="logout-button"
              onClick={
                handleLogout
              }
            >
              Logout
            </button>

          </div>

        </header>

        {error && (
          <div className="error-banner">
            {error}
          </div>
        )}

        {showCreateProject && (
          <div className="modal-backdrop">

            <div className="modal">

              <div className="modal-header">
                <h2>
                  New Project
                </h2>

                <button
                  onClick={() =>
                    setShowCreateProject(
                      false
                    )
                  }
                >
                  ×
                </button>
              </div>

              <form
                onSubmit={
                  handleCreateProject
                }
              >

                <label>
                  Project name

                  <input
                    value={projectName}
                    onChange={event =>
                      setProjectName(
                        event.target.value
                      )
                    }
                    placeholder="My AI Website"
                    required
                  />
                </label>

                <label>
                  Description

                  <textarea
                    value={
                      projectDescription
                    }
                    onChange={event =>
                      setProjectDescription(
                        event.target
                          .value
                      )
                    }
                    placeholder="Describe the project"
                    rows={4}
                  />
                </label>

                <label>
                  Project type

                  <select
                    value={projectType}
                    onChange={event =>
                      setProjectType(
                        event.target.value
                      )
                    }
                  >
                    <option value="WEBSITE">
                      Website
                    </option>

                    <option value="WEB_APP">
                      Web App
                    </option>

                    <option value="MOBILE_APP">
                      Mobile App
                    </option>

                    <option value="FULL_STACK_APP">
                      Full Stack App
                    </option>
                  </select>
                </label>

                <button
                  className="auth-button"
                  disabled={
                    loading
                  }
                >
                  {loading
                    ? "Creating..."
                    : "Create Project"}
                </button>

              </form>

            </div>

          </div>
        )}

        <main className="dashboard-content">

          {loadingProjects ? (
            <div className="empty-projects">
              Loading projects...
            </div>
          ) : projects.length === 0 ? (
            <div className="empty-projects">
              <h2>
                Start your first project
              </h2>

              <p>
                Create a project and start
                building with AI.
              </p>

              <button
                className="primary-button"
                onClick={() =>
                  setShowCreateProject(
                    true
                  )
                }
              >
                Create project
              </button>
            </div>
          ) : (
            <div className="project-grid">

              {projects.map(
                project => (
                  <button
                    key={project.id}
                    className="project-card"
                    onClick={() =>
                      openProject(
                        project
                      )
                    }
                  >

                    <div className="project-card-top">

                      <span className="project-type">
                        {project.type}
                      </span>

                      <span>
                        →
                      </span>

                    </div>

                    <h3>
                      {project.name}
                    </h3>

                    <p>
                      {project.description ||
                        "No description"}
                    </p>

                    <span className="open-project">
                      Open Builder
                    </span>

                  </button>
                )
              )}

            </div>
          )}

        </main>
      </div>
    );
  }

  return (
    <div className="builder-page">

      <header className="builder-header">

        <div className="builder-left">

          <button
            className="back-button"
            onClick={goBack}
          >
            ←
          </button>

          <div>
            <div className="builder-title">
              {selectedProject.name}
            </div>

            <div className="builder-subtitle">
              {selectedProject.type}
            </div>
          </div>

        </div>

        <div className="builder-status">
          <span
            className={
              latestBuild?.status ===
              "SUCCESS"
                ? "status success"
                : latestBuild?.status ===
                  "FAILED"
                ? "status failed"
                : "status"
            }
          />

          {latestBuild?.status ||
            "No build"}
        </div>

      </header>

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      <main className={`builder-grid ${expandedPanel ? "has-expanded" : ""}`}>


        {/* FILES */}

        <aside className={`builder-panel files-panel ${expandedPanel && expandedPanel !== "files" ? "panel-hidden" : ""}`}>

            <div className="panel-title">
              <span>Files</span>
              <button
                className="panel-toggle"
                onClick={() => toggleExpand("files")}
              >
                {expandedPanel === "files" ? "⤡" : "⤢"}
              </button>
            </div>

          <div className="file-list">

            {files.map(file => (
          <div
             key={file.id}
             className={`file-row ${
             selectedFile?.path === file.path
             ? "file-row-active"
             : ""
           }`}
            onClick={() => handleFileSelect(file)}
         >
            <span className="file-icon">
             {getFileIcon(file.language)}
            </span>

            <span className="file-path">
             {file.path}
            </span>
          </div>
            ))}

          </div>
        </aside>



      
         {/* CHAT */}

<section className={`builder-panel chat-panel ${expandedPanel && expandedPanel !== "chat" ? "panel-hidden" : ""}`}>
  <div className="panel-title">
    <span>AI Assistant</span>
    <button
      className="panel-toggle"
      onClick={() => toggleExpand("chat")}
    >
      {expandedPanel === "chat" ? "⤡" : "⤢"}
    </button>
  </div>

  <div className="messages">

    {messages.map((item, index) => (
      <div
        key={item.id || index}
        className={
          item.role === "USER"
            ? "chat-message user"
            : "chat-message assistant"
        }
      >
        <div className="message-label">
          {item.role === "USER" ? "You" : "AI"}
        </div>

        <div className="message-body">
          {item.content}
        </div>
      </div>
    ))}

  </div>

  <div className="chat-input">

    <textarea
      value={message}
      onChange={event => setMessage(event.target.value)}
      onKeyDown={handleKeyDown}
      placeholder="Describe what you want to build..."
      rows={4}
      disabled={loading}
    />

    <div className="chat-input-footer">

      <span>
        Enter to send
      </span>

      <button
        className="build-button"
        disabled={loading || !message.trim()}
        onClick={handleSend}
      >
        {loading ? "Building..." : "Build"}
      </button>

    </div>

  </div>

</section>


{/* CODE EDITOR */}

<section className={`builder-panel editor-workspace ${expandedPanel && expandedPanel !== "editor" ? "panel-hidden" : ""}`}>

  <div className="panel-title editor-title">

    <span>
      {selectedFile ? selectedFile.path : "Code Editor"}
    </span>

<div className="editor-actions">

  {saveMessage && (
    <span className="save-message">
      {saveMessage}
    </span>
  )}

  {buildMessage && (
    <span className="save-message">
      {buildMessage}
    </span>
  )}

  <button
    className="save-button"
    disabled={!selectedFile || saving}
    onClick={handleSaveFile}
  >
    {saving ? "Saving..." : "Save"}
  </button>

  <button
    className="build-editor-button"
    disabled={manualBuildLoading}
    onClick={handleBuild}
  >
    {manualBuildLoading ? "Building..." : "Build"}
  </button>

  <button
    className="panel-toggle"
    onClick={() => toggleExpand("editor")}
  >
    {expandedPanel === "editor" ? "⤡" : "⤢"}
  </button>

</div>

  </div>

  <div className="editor-panel">

    {selectedFile ? (
      <Editor
        height="100%"
        theme="vs-dark"
        language={getEditorLanguage(selectedFile.path)}
        value={editorContent}
        onChange={(value) => setEditorContent(value || "")}
        options={{
          automaticLayout: true,
          minimap: {
            enabled: false
          },
          fontSize: 14,
          wordWrap: "on",
          scrollBeyondLastLine: false
        }}
      />
    ) : (
      <div className="editor-empty">
        <h3>Select a file</h3>
        <p>Choose a file from the Files panel to edit it.</p>
      </div>
    )}

  </div>

</section>


{/* PREVIEW */}

<section
  className={`builder-panel preview-panel ${
    expandedPanel && expandedPanel !== "preview"
      ? "panel-hidden"
      : ""
  } ${
    expandedPanel === "preview"
      ? "panel-expanded"
      : ""
  }`}
>
  <div className="panel-title">
    <span>Preview</span>

    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px"
      }}
    >
      {latestBuild && (
        <span
          className={
            latestBuild.status === "SUCCESS"
              ? "build-status success"
              : "build-status"
          }
        >
          {latestBuild.status}
        </span>
      )}

      <button
        className="expand-button"
        onClick={() => toggleExpand("preview")}
      >
        {expandedPanel === "preview"
          ? "⤡"
          : "⤢"}
      </button>
    </div>
  </div>

  <div className="preview-area">

    {previewUrl ? (
      <iframe
        title="Preview"
        src={previewUrl}
        className="preview-frame"
      />
    ) : (
      <div className="preview-empty">

        <h3>
          No successful build
        </h3>

        <p>
          Build your project to see the preview.
        </p>

      </div>
    )}

  </div>

</section>


{/* VERSION HISTORY */}

<div
  className={`version-history ${
    expandedPanel
      ? "panel-hidden"
      : ""
  }`}
>

  <div className="version-history-title">
    Version History
  </div>

  {versions.length === 0 ? (
    <div className="version-empty">
      No versions yet
    </div>
  ) : (
    <div className="version-list">

      {versions.map(version => (
        <div
          key={version.versionNumber}
          className="version-item"
        >

          <div className="version-info">

            <div className="version-number">
              v{version.versionNumber}
            </div>

            <div className="version-message">
              {version.message ||
                "Project version"}
            </div>

            <div className="version-source">
              {version.source ||
                "SYSTEM"}
            </div>

          </div>

          <button
            className="restore-button"
            disabled={
              restoringVersion ===
              version.versionNumber
            }
            onClick={() =>
              handleRestoreVersion(
                version
              )
            }
          >
            {restoringVersion ===
            version.versionNumber
              ? "Restoring..."
              : "Restore"}
          </button>

        </div>
      ))}

    </div>
  )}

</div>

      </main>

      <footer className="task-footer">

        <div className="task-heading">
          Agent Tasks
        </div>

        {agentStatus && (
          <div className="agent-status">
            <span
              className={
                agentStatus === "RUNNING"
                  ? "status-dot running"
                  : agentStatus === "COMPLETED"
                  ? "status-dot completed"
                  : "status-dot failed"
              }
            />

            <span>
              Agent: {agentStatus}
            </span>
          </div>
        )}

        <div className="task-items">

          {tasks.map(
            task => (
              <div
                key={task.id}
                className="task-item"
              >
                <span
                  className={
                    task.status ===
                    "COMPLETED"
                      ? "task-status completed"
                      : task.status ===
                        "RUNNING"
                      ? "task-status running"
                      : task.status ===
                        "FAILED"
                      ? "task-status failed"
                      : "task-status"
                  }
                >
                  {task.status ===
                  "COMPLETED"
                    ? "✓"
                    : task.status ===
                      "RUNNING"
                    ? "…"
                    : task.status ===
                      "FAILED"
                    ? "!"
                    : "○"}
                </span>

                <span>
                  {task.title}
                </span>
              </div>
            )
          )}

        </div>

      </footer>

    </div>
  );
}

function getFileIcon(
  language
) {
  switch (language) {
    case "jsx":
      return "⚛";
    case "javascript":
      return "JS";
    case "typescript":
      return "TS";
    case "css":
      return "#";
    case "html":
      return "</>";
    case "json":
      return "{}";
    case "java":
      return "☕";
    default:
      return "•";
  }
}

export default App;