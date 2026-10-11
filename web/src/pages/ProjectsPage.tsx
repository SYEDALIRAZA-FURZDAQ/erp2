import { useEffect, useState } from 'react';
import { api, del, patch, post } from '../lib/api';
import { ErrorBox, Modal, PageHeader, StatusBadge, SuccessBox } from '../components/ui';

interface Project {
  id: string;
  code: string;
  name: string;
  startDate: string;
  endDate: string | null;
  budget: string;
  status: string;
  priority: string;
  progressPercent: number;
  clientName: string | null;
  taskCount: number;
  completedTaskCount: number;
  totalHoursLogged: string;
  totalExpensesLogged: string;
}

interface Customer {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  fullName: string;
}

interface ProjectDetail extends Project {
  tasks: Array<{
    id: string;
    title: string;
    dueDate: string | null;
    status: string;
    priority: string;
    assignedToName: string | null;
  }>;
  timesheets: Array<{
    id: string;
    date: string;
    hours: string;
    expenseAmount: string;
    description: string;
    employeeName: string | null;
  }>;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modals
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectDetail | null>(null);

  // Delete Project State
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Add Task / Timesheet states
  const [taskTitle, setTaskTitle] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [tsHours, setTsHours] = useState(4);
  const [tsExpense, setTsExpense] = useState(0);
  const [tsDesc, setTsDesc] = useState('');

  // New Project Form
  const [projectForm, setProjectForm] = useState({
    name: '',
    clientId: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    budget: 500000,
    status: 'in_progress',
    priority: 'medium',
    progressPercent: 10,
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [prjs, custs, emps] = await Promise.all([
        api<Project[]>('/projects'),
        api<Customer[]>('/sales/customers').catch(() => []),
        api<Employee[]>('/hr/employees').catch(() => []),
      ]);
      setProjects(prjs);
      setCustomers(custs);
      setEmployees(emps);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await post('/projects', projectForm);
      setSuccess('Project created successfully');
      setShowAddProjectModal(false);
      loadData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const viewProjectDetails = async (id: string) => {
    try {
      const data = await api<ProjectDetail>(`/projects/${id}`);
      setSelectedProject(data);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !taskTitle.trim()) return;
    try {
      await post(`/projects/${selectedProject.id}/tasks`, {
        title: taskTitle,
        assignedTo: taskAssignee || null,
        priority: 'medium',
      });
      setTaskTitle('');
      viewProjectDetails(selectedProject.id);
      loadData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, status: string) => {
    if (!selectedProject) return;
    try {
      await patch(`/projects/tasks/${taskId}`, { status });
      viewProjectDetails(selectedProject.id);
      loadData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleLogTimesheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !tsDesc.trim()) return;
    try {
      await post(`/projects/${selectedProject.id}/timesheets`, {
        hours: tsHours,
        expenseAmount: tsExpense,
        description: tsDesc,
      });
      setTsDesc('');
      setTsExpense(0);
      viewProjectDetails(selectedProject.id);
      loadData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDeleteProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletingProject || deleteConfirm !== 'DELETE') return;
    try {
      setDeleteLoading(true);
      setError(null);
      const res = await del<{ success: boolean; message: string }>(`/projects/${deletingProject.id}`);
      setSuccess(res.message);
      // Close detail modal if we're deleting the currently open project
      if (selectedProject?.id === deletingProject.id) setSelectedProject(null);
      setDeletingProject(null);
      setDeleteConfirm('');
      loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects & Tasks Management"
        subtitle="Track client projects, milestones, task statuses, hours, and project expenditures"
      >
        <button className="btn" onClick={() => setShowAddProjectModal(true)}>
          + New Project
        </button>
      </PageHeader>

      <ErrorBox message={error} />
      <SuccessBox message={success} />

      {/* Projects Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => {
          const budget = Number(p.budget);
          const expenses = Number(p.totalExpensesLogged);
          return (
            <div key={p.id} className="card flex flex-col justify-between space-y-4 hover:border-indigo-300 transition-all">
              {/* Header row: code badge + status + delete button */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span
                    className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded cursor-pointer"
                    onClick={() => viewProjectDetails(p.id)}
                  >
                    {p.code}
                  </span>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={p.status} />
                    <button
                      className="rounded-md p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete project"
                      onClick={(e) => { e.stopPropagation(); setDeletingProject(p); setDeleteConfirm(''); }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
                <h3
                  className="font-bold text-slate-900 text-base cursor-pointer hover:text-indigo-700"
                  onClick={() => viewProjectDetails(p.id)}
                >
                  {p.name}
                </h3>
                <p className="text-xs text-slate-500">Client: {p.clientName || 'Internal Company'}</p>
              </div>

              {/* Progress Bar */}
              <div onClick={() => viewProjectDetails(p.id)} className="cursor-pointer">
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>Progress</span>
                  <span className="font-semibold">{p.progressPercent}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all"
                    style={{ width: `${p.progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Financials & Tasks metrics */}
              <div
                className="border-t border-slate-100 pt-3 grid grid-cols-2 gap-2 text-xs cursor-pointer"
                onClick={() => viewProjectDetails(p.id)}
              >
                <div>
                  <span className="text-slate-500">Budget:</span>
                  <p className="font-mono font-bold text-slate-900">PKR {budget.toLocaleString('en-PK')}</p>
                </div>
                <div>
                  <span className="text-slate-500">Spent / Hours:</span>
                  <p className="font-mono text-slate-700">
                    {p.totalHoursLogged} hrs ({expenses > 0 ? `PKR ${expenses.toLocaleString()}` : '0'})
                  </p>
                </div>
                <div className="col-span-2 flex justify-between items-center text-indigo-600 font-semibold pt-1">
                  <span>Tasks: {p.completedTaskCount} / {p.taskCount} completed</span>
                  <span>View Details →</span>
                </div>
              </div>
            </div>
          );
        })}
        {projects.length === 0 && !loading && (
          <div className="col-span-3 card p-8 text-center text-slate-500">
            No active projects found. Create your first project.
          </div>
        )}
      </div>

      {/* MODAL: Create Project */}
      {showAddProjectModal && (
        <Modal title="Create New Project" maxWidth="max-w-2xl" onClose={() => setShowAddProjectModal(false)}>
          <form onSubmit={handleCreateProject} className="space-y-4">
            <div>
              <label className="label">Project Title</label>
              <input
                type="text"
                className="input"
                required
                placeholder="e.g. ERP Cloud Portal Deployment"
                value={projectForm.name}
                onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Client / Customer</label>
                <select
                  className="input"
                  value={projectForm.clientId}
                  onChange={(e) => setProjectForm({ ...projectForm, clientId: e.target.value })}
                >
                  <option value="">Internal Project</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Project Budget (PKR)</label>
                <input
                  type="number"
                  step="5000"
                  className="input font-mono"
                  value={projectForm.budget}
                  onChange={(e) => setProjectForm({ ...projectForm, budget: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Start Date</label>
                <input
                  type="date"
                  className="input"
                  required
                  value={projectForm.startDate}
                  onChange={(e) => setProjectForm({ ...projectForm, startDate: e.target.value })}
                />
              </div>
              <div>
                <label className="label">End Date</label>
                <input
                  type="date"
                  className="input"
                  value={projectForm.endDate}
                  onChange={(e) => setProjectForm({ ...projectForm, endDate: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Priority</label>
                <select
                  className="input"
                  value={projectForm.priority}
                  onChange={(e) => setProjectForm({ ...projectForm, priority: e.target.value })}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setShowAddProjectModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn">
                Launch Project
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Project Detail (Tasks & Timesheets) */}
      {selectedProject && (
        <Modal
          title={`${selectedProject.code}: ${selectedProject.name}`}
          maxWidth="max-w-4xl"
          onClose={() => setSelectedProject(null)}
        >
          <div className="space-y-6">
            {/* Project Overview Stats */}
            <div className="grid grid-cols-4 gap-2 bg-slate-50 p-3 rounded text-xs">
              <div>
                <span className="text-slate-500">Status:</span>
                <div className="mt-0.5"><StatusBadge status={selectedProject.status} /></div>
              </div>
              <div>
                <span className="text-slate-500">Client:</span>
                <p className="font-bold text-slate-800">{selectedProject.clientName || 'Internal'}</p>
              </div>
              <div>
                <span className="text-slate-500">Budget:</span>
                <p className="font-mono font-bold text-slate-900">
                  PKR {Number(selectedProject.budget).toLocaleString('en-PK')}
                </p>
              </div>
              <div>
                <span className="text-slate-500">Total Hours Logged:</span>
                <p className="font-mono font-bold text-indigo-700">{selectedProject.totalHoursLogged} hrs</p>
              </div>
            </div>

            {/* Section 1: Tasks */}
            <div className="space-y-3">
              <div className="flex justify-between items-center border-b pb-2">
                <h4 className="font-bold text-sm text-slate-900">Project Tasks & Milestones</h4>
                <span className="text-xs text-slate-500">
                  {selectedProject.tasks.filter((t) => t.status === 'done').length} of {selectedProject.tasks.length} done
                </span>
              </div>

              <form onSubmit={handleAddTask} className="flex gap-2">
                <input
                  type="text"
                  className="input flex-1 text-xs"
                  placeholder="Add a new project task or deliverable..."
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                />
                <select
                  className="input w-44 text-xs"
                  value={taskAssignee}
                  onChange={(e) => setTaskAssignee(e.target.value)}
                >
                  <option value="">Assignee...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName}
                    </option>
                  ))}
                </select>
                <button type="submit" className="btn text-xs py-1.5 px-3">
                  + Add
                </button>
              </form>

              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {selectedProject.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-2 rounded border border-slate-100 bg-white hover:bg-slate-50 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleUpdateTaskStatus(task.id, task.status === 'done' ? 'in_progress' : 'done')}
                        className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                          task.status === 'done' ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300'
                        }`}
                      >
                        {task.status === 'done' ? '✓' : ''}
                      </button>
                      <span className={task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-800 font-medium'}>
                        {task.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {task.assignedToName && (
                        <span className="text-slate-500 text-[11px]">👤 {task.assignedToName}</span>
                      )}
                      <StatusBadge status={task.status} />
                    </div>
                  </div>
                ))}
                {selectedProject.tasks.length === 0 && (
                  <p className="text-center text-xs text-slate-400 py-2">No tasks added yet.</p>
                )}
              </div>
            </div>

            {/* Section 2: Timesheets & Expenses */}
            <div className="space-y-3 pt-3 border-t">
              <h4 className="font-bold text-sm text-slate-900">Log Timesheets & Expenses</h4>

              <form onSubmit={handleLogTimesheet} className="flex gap-2 items-center text-xs">
                <input
                  type="text"
                  className="input flex-1"
                  placeholder="Task work log / expense note..."
                  value={tsDesc}
                  onChange={(e) => setTsDesc(e.target.value)}
                />
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  className="input w-20 text-right font-mono"
                  placeholder="Hours"
                  value={tsHours}
                  onChange={(e) => setTsHours(parseFloat(e.target.value) || 1)}
                />
                <input
                  type="number"
                  step="100"
                  min="0"
                  className="input w-28 text-right font-mono"
                  placeholder="Expense PKR"
                  value={tsExpense || ''}
                  onChange={(e) => setTsExpense(parseFloat(e.target.value) || 0)}
                />
                <button type="submit" className="btn text-xs py-1.5 px-3">
                  Log Time
                </button>
              </form>

              <div className="space-y-1 max-h-36 overflow-y-auto">
                {selectedProject.timesheets.map((ts) => (
                  <div key={ts.id} className="flex justify-between items-center p-2 rounded bg-slate-50 text-xs">
                    <div>
                      <span className="font-semibold text-slate-800">{ts.description}</span>
                      <span className="text-slate-400 ml-2">({ts.date})</span>
                    </div>
                    <div className="font-mono text-slate-700">
                      <b>{ts.hours} hrs</b>
                      {Number(ts.expenseAmount) > 0 && ` | PKR ${Number(ts.expenseAmount).toLocaleString('en-PK')}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: Delete Project — Type DELETE to confirm */}
      {deletingProject && (
        <Modal
          title={`Delete Project: ${deletingProject.code}`}
          onClose={() => { if (!deleteLoading) { setDeletingProject(null); setDeleteConfirm(''); } }}
        >
          <form onSubmit={handleDeleteProject} className="space-y-4 text-xs">
            {/* Danger notice */}
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-rose-800 space-y-1.5">
              <p className="font-bold text-rose-900 text-sm">⚠️ Permanent Deletion Warning</p>
              <p>Deleting this project will permanently remove:</p>
              <ul className="list-disc list-inside pl-1 space-y-0.5">
                <li>The project record and all metadata</li>
                <li>All <strong>{deletingProject.taskCount} task(s)</strong></li>
                <li>All timesheet / expense entries logged</li>
              </ul>
              <p className="font-semibold text-rose-950 pt-1">This cannot be undone.</p>
            </div>

            {/* Project summary */}
            <div className="bg-slate-50 p-3 rounded border border-slate-200">
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                    {deletingProject.code}
                  </span>
                  <p className="font-semibold text-slate-800 mt-1.5">{deletingProject.name}</p>
                  <p className="text-slate-500 mt-0.5">Client: {deletingProject.clientName || 'Internal'}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-500">Budget:</p>
                  <p className="font-mono font-bold text-slate-900">PKR {Number(deletingProject.budget).toLocaleString('en-PK')}</p>
                  <p className="text-slate-400 mt-1">{deletingProject.taskCount} task(s) · {deletingProject.totalHoursLogged} hrs logged</p>
                </div>
              </div>
              <div className="mt-2">
                <StatusBadge status={deletingProject.status} />
              </div>
            </div>

            {/* Type DELETE confirmation */}
            <div>
              <label className="label text-xs font-semibold text-slate-800">
                Type <strong className="text-rose-700 tracking-widest">DELETE</strong> to confirm *
              </label>
              <input
                id="delete-project-confirm"
                type="text"
                required
                className="input font-mono tracking-widest"
                placeholder="Type DELETE here..."
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                autoFocus
                autoComplete="off"
                spellCheck={false}
              />
              {deleteConfirm.length > 0 && deleteConfirm !== 'DELETE' && (
                <p className="text-[11px] text-rose-500 mt-0.5">Must be exactly DELETE in capital letters.</p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                className="btn-ghost text-xs"
                disabled={deleteLoading}
                onClick={() => { setDeletingProject(null); setDeleteConfirm(''); }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn bg-rose-600 hover:bg-rose-700 text-xs py-2 px-4 shadow-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={deleteLoading || deleteConfirm !== 'DELETE'}
              >
                {deleteLoading ? 'Deleting…' : '🗑️ Delete Project Permanently'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
