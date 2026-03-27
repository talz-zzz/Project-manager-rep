import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ClipboardList, Home as HomeIcon, StickyNote, Wand2 } from "lucide-react";

const STORAGE_KEY = "taskflow-suite-v4";

const priorityOptions = ["Low", "Medium", "High"] as const;
const statusOptions = ["Open", "In Progress", "Done"] as const;

type Priority = (typeof priorityOptions)[number];
type Status = (typeof statusOptions)[number];

type Task = {
  id: string;
  task: string;
  owner: string;
  priority: Priority;
  due_date: string;
  status: Status;
  source: "meeting" | "manual";
  created_at: string;
  meetingId?: string;
  meetingProjectName?: string;
  meetingDate?: string;
};

type MeetingTaskCandidate = {
  id: string;
  text: string;
  selected: boolean;
  owner: string;
  priority: Priority;
  due_date: string;
};

type MeetingRecord = {
  id: string;
  meetingDate: string;
  projectName: string;
  notes: string;
  created_at: string;
  tasks: Task[];
};

type StoredState = {
  tasks: Task[];
  meetings: MeetingRecord[];
};

function loadState(): StoredState {
  if (typeof window === "undefined") return { tasks: [], meetings: [] };
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return { tasks: [], meetings: [] };

  try {
    const parsed = JSON.parse(raw);
    return {
      tasks: Array.isArray(parsed?.tasks) ? parsed.tasks : [],
      meetings: Array.isArray(parsed?.meetings) ? parsed.meetings : [],
    };
  } catch {
    return { tasks: [], meetings: [] };
  }
}

function priorityClass(priority: Priority) {
  if (priority === "High") return "badge badge-high";
  if (priority === "Medium") return "badge badge-medium";
  return "badge";
}

function extractTaskCandidates(notes: string): MeetingTaskCandidate[] {
  const lines = notes
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const candidates = lines
    .map((line) => {
      const cleaned = line
        .replace(/^[-*•]\s*/, "")
        .replace(/^\d+[.)]\s*/, "")
        .replace(/^(todo|action item|action|follow-up|next step)[:\-]?\s*/i, "")
        .trim();

      const looksActionable =
        /^[-*•]/.test(line) ||
        /^\d+[.)]/.test(line) ||
        /^(todo|action item|action|follow-up|next step)[:\-]?/i.test(line) ||
        /\b(send|update|review|prepare|create|share|finalize|follow up|schedule|align|confirm|build|draft|check)\b/i.test(cleaned);

      if (!looksActionable || cleaned.length < 4) return null;

      return {
        id: crypto.randomUUID(),
        text: cleaned,
        selected: true,
        owner: "",
        priority: "Medium" as Priority,
        due_date: "",
      };
    })
    .filter(Boolean) as MeetingTaskCandidate[];

  const unique: MeetingTaskCandidate[] = [];
  const seen = new Set<string>();

  for (const item of candidates) {
    const key = item.text.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }

  return unique;
}

function HomePage({
  onNavigate,
  taskCount,
  meetingCount,
}: {
  onNavigate: (page: "home" | "taskflow" | "meetings") => void;
  taskCount: number;
  meetingCount: number;
}) {
  return (
    <div className="grid-two">
      <div className="card">
        <div className="card-header">
          <div className="icon-box">
            <ClipboardList size={24} />
          </div>
          <h2 className="card-title">TaskFlow</h2>
          <p className="card-description">
            Track all tasks in one place, including tasks created from meetings.
          </p>
        </div>
        <div className="card-content">
          <div className="small-text">Current tasks: {taskCount}</div>
          <div style={{ marginTop: 16 }}>
            <button className="button" onClick={() => onNavigate("taskflow")}>
              Open TaskFlow
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="icon-box">
            <StickyNote size={24} />
          </div>
          <h2 className="card-title">Meeting Notes</h2>
          <p className="card-description">
            Add meeting notes, generate a task list from them, and push those tasks into TaskFlow automatically.
          </p>
        </div>
        <div className="card-content">
          <div className="small-text">Saved meetings: {meetingCount}</div>
          <div style={{ marginTop: 16 }}>
            <button className="button button-outline" onClick={() => onNavigate("meetings")}>
              Open Meeting Notes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskFlowPage({
  tasks,
  onBack,
  onUpdateStatus,
  onClearAll,
  onAddTask,
  onOpenMeeting,
}: {
  tasks: Task[];
  onBack: () => void;
  onUpdateStatus: (id: string, status: Status) => void;
  onClearAll: () => void;
  onAddTask: (task: { task: string; owner: string; priority: Priority; due_date: string }) => void;
  onOpenMeeting: (meetingId: string) => void;
}) {
  const [filterOwner, setFilterOwner] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [form, setForm] = useState({
    task: "",
    owner: "",
    priority: "Medium" as Priority,
    due_date: "",
  });

  const owners = useMemo(() => {
    const vals = [...new Set(tasks.map((t) => t.owner).filter(Boolean))];
    return vals.sort((a, b) => a.localeCompare(b));
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const ownerMatch = filterOwner === "all" || task.owner === filterOwner;
      const statusMatch = filterStatus === "all" || task.status === filterStatus;
      return ownerMatch && statusMatch;
    });
  }, [tasks, filterOwner, filterStatus]);

  const report = useMemo(() => {
    const open = tasks.filter((t) => t.status === "Open").length;
    const inProgress = tasks.filter((t) => t.status === "In Progress").length;
    const done = tasks.filter((t) => t.status === "Done").length;
    const highPriorityActive = tasks.filter((t) => t.priority === "High" && t.status !== "Done");

    return { total: tasks.length, open, inProgress, done, highPriorityActive };
  }, [tasks]);

  const handleAddTask = () => {
    if (!form.task.trim()) return;

    onAddTask({
      task: form.task.trim(),
      owner: form.owner.trim(),
      priority: form.priority,
      due_date: form.due_date,
    });

    setForm({
      task: "",
      owner: "",
      priority: "Medium",
      due_date: "",
    });
  };

  return (
    <div className="stack">
      <div className="row-between">
        <div>
          <h2 className="page-title" style={{ fontSize: 28 }}>TaskFlow</h2>
          <p className="page-subtitle">A shared task view fed by meeting-generated follow-ups.</p>
        </div>
        <button className="button button-outline" onClick={onBack}>
          <ArrowLeft size={16} style={{ marginRight: 8, verticalAlign: "text-bottom" }} />
          Back Home
        </button>
      </div>

      <div className="grid-four">
        {[
          ["Total Tasks", report.total],
          ["Open", report.open],
          ["In Progress", report.inProgress],
          ["Done", report.done],
        ].map(([label, value]) => (
          <div className="card" key={String(label)}>
            <div className="card-header">
              <div className="small-text">{label}</div>
            </div>
            <div className="card-content">
              <div className="stat-value">{value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid-main">
        <div className="stack">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Add Task Manually</h3>
              <p className="card-description">
                Use this when you want to open a task directly, without going through Meeting Notes.
              </p>
            </div>
            <div className="card-content form-grid">
              <div className="field form-full">
                <label className="label">Task</label>
                <input
                  className="input"
                  value={form.task}
                  onChange={(e) => setForm((prev) => ({ ...prev, task: e.target.value }))}
                  placeholder="Create launch status update"
                />
              </div>

              <div className="field">
                <label className="label">Owner</label>
                <input
                  className="input"
                  value={form.owner}
                  onChange={(e) => setForm((prev) => ({ ...prev, owner: e.target.value }))}
                  placeholder="Tal"
                />
              </div>

              <div className="field">
                <label className="label">Priority</label>
                <select
                  className="select"
                  value={form.priority}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, priority: e.target.value as Priority }))
                  }
                >
                  {priorityOptions.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="label">Due date</label>
                <input
                  className="input"
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, due_date: e.target.value }))}
                />
              </div>

              <div className="form-full">
                <button className="button" onClick={handleAddTask}>
                  Add task
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Task List</h3>
              <p className="card-description">Tasks generated from Meeting Notes and tracked here in one place.</p>
            </div>
            <div className="card-content stack">
              <div className="form-grid">
                <div className="field">
                  <label className="label">Filter by owner</label>
                  <select className="select" value={filterOwner} onChange={(e) => setFilterOwner(e.target.value)}>
                    <option value="all">All owners</option>
                    {owners.map((owner) => (
                      <option key={owner} value={owner}>
                        {owner}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label className="label">Filter by status</label>
                  <select className="select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                    <option value="all">All statuses</option>
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {filteredTasks.length === 0 ? (
                <div className="empty">No tasks yet. Generate them from Meeting Notes or add one manually.</div>
              ) : (
                <div className="stack">
                  {filteredTasks.map((task) => (
                    <div key={task.id} className="task-item">
                      <div className="row-between" style={{ alignItems: "flex-start" }}>
                        <div style={{ flex: 1 }}>
                          <div className="badges" style={{ marginBottom: 8 }}>
                            <strong>{task.task}</strong>
                            <span className={priorityClass(task.priority)}>{task.priority}</span>
                            <span className="badge">{task.status}</span>
                            {task.source === "meeting" && <span className="badge badge-secondary">From Meeting Notes</span>}
                            {task.source === "manual" && <span className="badge">Manual</span>}
                          </div>
                          <div className="task-meta">
                            Owner: {task.owner || "—"} · Due: {task.due_date || "—"}
                          </div>
                          {task.source === "meeting" && task.meetingId && (
                            <div style={{ marginTop: 6 }}>
                              <button className="link-button" onClick={() => onOpenMeeting(task.meetingId as string)}>
                                From: {task.meetingProjectName || "Meeting"}
                                {task.meetingDate ? ` · ${task.meetingDate}` : ""}
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="row-wrap">
                          <button className="button button-outline button-sm" onClick={() => onUpdateStatus(task.id, "Open")}>
                            Open
                          </button>
                          <button
                            className="button button-outline button-sm"
                            onClick={() => onUpdateStatus(task.id, "In Progress")}
                          >
                            In Progress
                          </button>
                          <button className="button button-outline button-sm" onClick={() => onUpdateStatus(task.id, "Done")}>
                            Done
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tasks.length > 0 && (
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button className="button button-ghost" onClick={onClearAll}>
                    Clear all tasks
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Weekly PM Report</h3>
            <p className="card-description">Quick summary of execution status.</p>
          </div>
          <div className="card-content stack">
            <div className="report-block">
              <div className="small-text">Open tasks</div>
              <div className="stat-value">{report.open}</div>
            </div>
            <div className="report-block">
              <div className="small-text">In Progress</div>
              <div className="stat-value">{report.inProgress}</div>
            </div>
            <div className="report-block">
              <div className="small-text">Completed</div>
              <div className="stat-value">{report.done}</div>
            </div>

            <div className="report-block">
              <div className="label" style={{ marginBottom: 12 }}>High-priority active tasks</div>
              {report.highPriorityActive.length > 0 ? (
                <div className="stack" style={{ gap: 8 }}>
                  {report.highPriorityActive.map((task) => (
                    <div key={task.id} style={{ padding: 12, borderRadius: 14, background: "#f8fafc", fontSize: 14 }}>
                      <strong>{task.task}</strong>
                      <span className="small-text"> · {task.owner || "No owner"} · Due {task.due_date || "—"}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="small-text">No active high-priority tasks.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MeetingNotesPage({
  meetings,
  onBack,
  onSaveMeeting,
  expandedMeetingIds,
  onToggleMeeting,
}: {
  meetings: MeetingRecord[];
  onBack: () => void;
  onSaveMeeting: (data: {
    meetingDate: string;
    projectName: string;
    notes: string;
    tasks: Array<{ task: string; owner: string; priority: Priority; due_date: string }>;
  }) => void;
  expandedMeetingIds: Record<string, boolean>;
  onToggleMeeting: (meetingId: string, open?: boolean) => void;
}) {
  const [form, setForm] = useState({
    meetingDate: "",
    projectName: "",
    notes: "",
  });

  const [candidates, setCandidates] = useState<MeetingTaskCandidate[]>([]);

  const generateTasks = () => {
    const extracted = extractTaskCandidates(form.notes);
    setCandidates(extracted);
  };

  const updateCandidate = (
    id: string,
    field: keyof MeetingTaskCandidate,
    value: string | boolean
  ) => {
    setCandidates((prev) =>
      prev.map((task) => (task.id === id ? { ...task, [field]: value } : task))
    );
  };

  const handleSubmit = () => {
    if (!form.meetingDate || !form.projectName.trim() || !form.notes.trim()) return;

    onSaveMeeting({
      meetingDate: form.meetingDate,
      projectName: form.projectName.trim(),
      notes: form.notes.trim(),
      tasks: candidates
        .filter((task) => task.selected)
        .map((task) => ({
          task: task.text,
          owner: task.owner,
          priority: task.priority,
          due_date: task.due_date,
        })),
    });

    setForm({
      meetingDate: form.meetingDate,
      projectName: "",
      notes: "",
    });
    setCandidates([]);
  };

  return (
    <div className="stack">
      <div className="row-between">
        <div>
          <h2 className="page-title" style={{ fontSize: 28 }}>Meeting Notes</h2>
          <p className="page-subtitle">
            Write meeting notes, generate action items, and push them into TaskFlow.
          </p>
        </div>
        <button className="button button-outline" onClick={onBack}>
          <ArrowLeft size={16} style={{ marginRight: 8, verticalAlign: "text-bottom" }} />
          Back Home
        </button>
      </div>

      <div className="grid-main">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">New Meeting Entry</h3>
            <p className="card-description">
              Use bullet points or action-style lines to help the app generate tasks.
            </p>
          </div>
          <div className="card-content stack">
            <div className="field">
              <label className="label">Meeting date</label>
              <input
                className="input"
                type="date"
                value={form.meetingDate}
                onChange={(e) => setForm((prev) => ({ ...prev, meetingDate: e.target.value }))}
              />
            </div>

            <div className="field">
              <label className="label">Project name</label>
              <input
                className="input"
                value={form.projectName}
                onChange={(e) => setForm((prev) => ({ ...prev, projectName: e.target.value }))}
                placeholder="Q2 Launch"
              />
            </div>

            <div className="field">
              <label className="label">Notes</label>
              <textarea
                className="textarea"
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder={`Example:
- Send revised timeline to design
- Review landing page copy
Action: schedule follow-up with sales`}
              />
            </div>

            <div className="row-wrap">
              <button className="button button-outline" type="button" onClick={generateTasks}>
                <Wand2 size={16} style={{ marginRight: 8, verticalAlign: "text-bottom" }} />
                Generate tasks from notes
              </button>
              <button className="button" onClick={handleSubmit}>
                Save meeting + selected tasks
              </button>
            </div>

            <div className="report-block">
              <div className="label" style={{ marginBottom: 12 }}>Generated task candidates</div>
              {candidates.length === 0 ? (
                <div className="small-text">
                  No tasks generated yet. Use notes with bullets, numbered items, or action-style lines.
                </div>
              ) : (
                <div className="stack" style={{ gap: 12 }}>
                  {candidates.map((task) => (
                    <div key={task.id} className="candidate-item">
                      <div className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={task.selected}
                          onChange={(e) => updateCandidate(task.id, "selected", e.target.checked)}
                        />
                        <div style={{ flex: 1 }} className="stack" >
                          <input
                            className="input"
                            value={task.text}
                            onChange={(e) => updateCandidate(task.id, "text", e.target.value)}
                          />
                          <div className="form-grid">
                            <input
                              className="input"
                              value={task.owner}
                              onChange={(e) => updateCandidate(task.id, "owner", e.target.value)}
                              placeholder="Owner"
                            />
                            <select
                              className="select"
                              value={task.priority}
                              onChange={(e) => updateCandidate(task.id, "priority", e.target.value as Priority)}
                            >
                              {priorityOptions.map((priority) => (
                                <option key={priority} value={priority}>
                                  {priority}
                                </option>
                              ))}
                            </select>
                            <input
                              className="input"
                              type="date"
                              value={task.due_date}
                              onChange={(e) => updateCandidate(task.id, "due_date", e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Saved Meetings</h3>
            <p className="card-description">Each meeting keeps its notes and the tasks created from it.</p>
          </div>
          <div className="card-content stack">
            {meetings.length === 0 ? (
              <div className="empty">No meeting notes yet.</div>
            ) : (
              meetings.map((meeting) => {
                const isOpen = expandedMeetingIds[meeting.id] ?? false;

                return (
                  <div id={`meeting-${meeting.id}`} key={meeting.id} className="meeting-item">
                    <div className="row-between">
                      <div className="row-wrap">
                        <strong>{meeting.projectName}</strong>
                        <span className="badge">{meeting.meetingDate}</span>
                      </div>
                      <button className="button button-ghost button-sm" onClick={() => onToggleMeeting(meeting.id)}>
                        {isOpen ? "Collapse" : "Expand"}
                      </button>
                    </div>

                    {!isOpen && (
                      <p className="note-preview small-text" style={{ marginTop: 12 }}>
                        {meeting.notes}
                      </p>
                    )}

                    {isOpen && (
                      <>
                        <p style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>{meeting.notes}</p>
                        <div className="report-block" style={{ marginTop: 16 }}>
                          <div className="label" style={{ marginBottom: 8 }}>Generated tasks</div>
                          {meeting.tasks?.length ? (
                            <div className="stack" style={{ gap: 8 }}>
                              {meeting.tasks.map((task) => (
                                <div key={task.id} className="small-text">
                                  • {task.task}
                                  {task.owner ? ` · ${task.owner}` : ""}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="small-text">No tasks were saved from this meeting.</div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState<"home" | "taskflow" | "meetings">("home");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meetings, setMeetings] = useState<MeetingRecord[]>([]);
  const [expandedMeetingIds, setExpandedMeetingIds] = useState<Record<string, boolean>>({});
  const [pendingMeetingScrollId, setPendingMeetingScrollId] = useState<string | null>(null);

  useEffect(() => {
    const initial = loadState();
    setTasks(initial.tasks || []);
    setMeetings(initial.meetings || []);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks, meetings }));
  }, [tasks, meetings]);

  useEffect(() => {
    if (page === "meetings" && pendingMeetingScrollId) {
      const timer = window.setTimeout(() => {
        const el = document.getElementById(`meeting-${pendingMeetingScrollId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        setPendingMeetingScrollId(null);
      }, 100);

      return () => window.clearTimeout(timer);
    }
  }, [page, pendingMeetingScrollId, meetings]);

  const handleUpdateStatus = (id: string, status: Status) => {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, status } : task)));
  };

  const handleClearAllTasks = () => setTasks([]);

  const handleAddManualTask = (taskInput: {
    task: string;
    owner: string;
    priority: Priority;
    due_date: string;
  }) => {
    const newTask: Task = {
      id: crypto.randomUUID(),
      task: taskInput.task,
      owner: taskInput.owner,
      priority: taskInput.priority,
      due_date: taskInput.due_date,
      status: "Open",
      source: "manual",
      created_at: new Date().toISOString(),
    };

    setTasks((prev) => [newTask, ...prev]);
  };

  const handleOpenMeeting = (meetingId: string) => {
    setExpandedMeetingIds((prev) => ({ ...prev, [meetingId]: true }));
    setPendingMeetingScrollId(meetingId);
    setPage("meetings");
  };

  const handleToggleMeeting = (meetingId: string, open?: boolean) => {
    setExpandedMeetingIds((prev) => ({
      ...prev,
      [meetingId]: open ?? !prev[meetingId],
    }));
  };

  const handleSaveMeeting = (meetingInput: {
    meetingDate: string;
    projectName: string;
    notes: string;
    tasks: Array<{ task: string; owner: string; priority: Priority; due_date: string }>;
  }) => {
    const meetingId = crypto.randomUUID();

    const linkedTasks: Task[] = (meetingInput.tasks || []).map((task) => ({
      id: crypto.randomUUID(),
      task: task.task,
      owner: task.owner,
      priority: task.priority,
      due_date: task.due_date,
      status: "Open",
      source: "meeting",
      meetingId,
      meetingProjectName: meetingInput.projectName,
      meetingDate: meetingInput.meetingDate,
      created_at: new Date().toISOString(),
    }));

    const meetingRecord: MeetingRecord = {
      id: meetingId,
      meetingDate: meetingInput.meetingDate,
      projectName: meetingInput.projectName,
      notes: meetingInput.notes,
      created_at: new Date().toISOString(),
      tasks: linkedTasks,
    };

    if (linkedTasks.length) {
      setTasks((prev) => [...linkedTasks, ...prev]);
    }

    setMeetings((prev) => [meetingRecord, ...prev]);
    setExpandedMeetingIds((prev) => ({ ...prev, [meetingId]: false }));
  };

  return (
    <div className="app-shell">
      <div className="container">
        <div className="topbar">
          <div className="eyebrow">
            <HomeIcon size={14} style={{ verticalAlign: "text-bottom", marginRight: 6 }} />
            PM Tools Suite
          </div>
          <h1 className="page-title">TaskFlow + Meeting Notes</h1>
          <p className="page-subtitle">
            A lightweight productivity suite with a homepage, a task tracker, and a meeting notes page.
            Meeting notes can generate candidate tasks that flow into TaskFlow.
          </p>
        </div>

        {page === "home" && (
          <HomePage onNavigate={setPage} taskCount={tasks.length} meetingCount={meetings.length} />
        )}

        {page === "taskflow" && (
          <TaskFlowPage
            tasks={tasks}
            onBack={() => setPage("home")}
            onUpdateStatus={handleUpdateStatus}
            onClearAll={handleClearAllTasks}
            onAddTask={handleAddManualTask}
            onOpenMeeting={handleOpenMeeting}
          />
        )}

        {page === "meetings" && (
          <MeetingNotesPage
            meetings={meetings}
            onBack={() => setPage("home")}
            onSaveMeeting={handleSaveMeeting}
            expandedMeetingIds={expandedMeetingIds}
            onToggleMeeting={handleToggleMeeting}
          />
        )}
      </div>
    </div>
  );
}
