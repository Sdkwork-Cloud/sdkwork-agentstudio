import { create } from 'zustand';

export type TaskStatus = 'idle' | 'running' | 'success' | 'error';
export type TaskType = 'download' | 'install' | 'build' | 'sync';

export interface Task {
  id: string;
  title: string;
  subtitle?: string;
  progress: number;
  status: TaskStatus;
  type: TaskType;
  createdAt: number;
}

interface TaskStore {
  tasks: Task[];
  isPanelOpen: boolean;
  togglePanel: () => void;
  setPanelOpen: (isOpen: boolean) => void;
  addTask: (task: Omit<Task, 'id' | 'progress' | 'status' | 'createdAt'> & { id?: string }) => string;
  updateTask: (id: string, updates: Partial<Task>) => void;
  removeTask: (id: string) => void;
  clearCompleted: () => void;
}

export const useTaskStore = create<TaskStore>((set) => ({
  tasks: [],
  isPanelOpen: false,
  togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),
  setPanelOpen: (isOpen) => set({ isPanelOpen: isOpen }),
  addTask: (task) => {
    const id = task.id || Math.random().toString(36).substring(7);
    set((state) => {
      if (state.tasks.some((current) => current.id === id)) {
        return state;
      }

      return {
        tasks: [
          { ...task, id, progress: 0, status: 'running', createdAt: Date.now() },
          ...state.tasks,
        ],
        isPanelOpen: true,
      };
    });
    return id;
  },
  updateTask: (id, updates) =>
    set((state) => ({
      tasks: state.tasks.map((task) => (task.id === id ? { ...task, ...updates } : task)),
    })),
  removeTask: (id) =>
    set((state) => ({
      tasks: state.tasks.filter((task) => task.id !== id),
    })),
  clearCompleted: () =>
    set((state) => ({
      tasks: state.tasks.filter((task) => task.status !== 'success'),
    })),
}));
