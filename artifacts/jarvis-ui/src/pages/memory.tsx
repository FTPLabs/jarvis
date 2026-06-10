import { Layout } from "@/components/layout";
import { 
  useListMemoryEntries, 
  getListMemoryEntriesQueryKey,
  useListTasks,
  getListTasksQueryKey,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useCreateMemoryEntry,
  useDeleteMemoryEntry
} from "@workspace/api-client-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Brain, CheckCircle, Clock, Plus, Trash2, XCircle } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const PRIORITY_RU: Record<string, string> = {
  urgent: "Срочно",
  high: "Высокий",
  medium: "Средний",
  low: "Низкий",
};

const CATEGORY_RU: Record<string, string> = {
  note: "Заметка",
  goal: "Цель",
  preference: "Предпочтение",
  fact: "Факт",
  reminder: "Напоминание",
};

export default function Memory() {
  const [activeTab, setActiveTab] = useState<"memory" | "tasks">("tasks");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newMemoryContent, setNewMemoryContent] = useState("");

  const { data: memoryEntries, refetch: refetchMemory } = useListMemoryEntries({}, {
    query: { queryKey: getListMemoryEntriesQueryKey({}) }
  });

  const { data: tasks, refetch: refetchTasks } = useListTasks({
    query: { queryKey: getListTasksQueryKey() }
  });

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const createMemory = useCreateMemoryEntry();
  const deleteMemory = useDeleteMemoryEntry();

  const handleTaskStatusToggle = (id: number, currentStatus: string) => {
    const newStatus = currentStatus === "done" ? "pending" : "done";
    updateTask.mutate({ id, data: { status: newStatus as any } }, {
      onSuccess: () => refetchTasks()
    });
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    createTask.mutate({ data: { title: newTaskTitle, priority: "medium" } }, {
      onSuccess: () => { setNewTaskTitle(""); refetchTasks(); }
    });
  };

  const handleCreateMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemoryContent.trim()) return;
    createMemory.mutate({ data: { content: newMemoryContent, category: "note", importance: 3 } }, {
      onSuccess: () => { setNewMemoryContent(""); refetchMemory(); }
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <header className="mb-8 border-b border-primary/20 pb-4 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-mono uppercase tracking-widest text-primary glow-text">Нейросеть</h1>
            <p className="text-muted-foreground font-mono text-sm mt-2">Долгосрочная память и задачи</p>
          </div>
          <div className="flex space-x-2 font-mono text-sm">
            <button 
              onClick={() => setActiveTab("tasks")}
              className={cn("px-4 py-2 border border-primary/30 rounded backdrop-blur transition-all",
                activeTab === "tasks" ? "bg-primary/20 text-primary shadow-[inset_0_0_10px_rgba(0,212,255,0.3)]" : "text-muted-foreground")}
            >
              Задачи
            </button>
            <button 
              onClick={() => setActiveTab("memory")}
              className={cn("px-4 py-2 border border-primary/30 rounded backdrop-blur transition-all",
                activeTab === "memory" ? "bg-primary/20 text-primary shadow-[inset_0_0_10px_rgba(0,212,255,0.3)]" : "text-muted-foreground")}
            >
              Банк памяти
            </button>
          </div>
        </header>

        {activeTab === "tasks" && (
          <div className="space-y-6">
            <form onSubmit={handleCreateTask} className="flex space-x-4">
              <input 
                type="text" 
                value={newTaskTitle}
                onChange={e => setNewTaskTitle(e.target.value)}
                placeholder="Новая задача..."
                className="flex-1 bg-black/40 border border-primary/30 rounded py-3 px-4 font-mono text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-primary"
              />
              <button 
                type="submit"
                disabled={createTask.isPending || !newTaskTitle.trim()}
                className="px-6 bg-primary/20 text-primary border border-primary hover:bg-primary hover:text-background rounded font-mono uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(0,212,255,0.2)]"
              >
                <Plus className="w-5 h-5" />
              </button>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tasks?.map((task) => (
                <motion.div 
                  key={task.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn("glass-panel rounded-lg p-5 flex flex-col justify-between border-l-4",
                    task.status === "done" ? "border-l-muted/50 opacity-60" : "border-l-primary")}
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className={cn("font-mono font-bold text-lg", task.status === "done" && "line-through")}>
                        {task.title}
                      </h3>
                      <span className={cn("text-xs px-2 py-1 rounded font-mono uppercase tracking-wider",
                        task.priority === "urgent" ? "bg-destructive/20 text-destructive" :
                        task.priority === "high" ? "bg-orange-500/20 text-orange-500" :
                        task.priority === "medium" ? "bg-yellow-500/20 text-yellow-500" :
                        "bg-primary/20 text-primary")}>
                        {PRIORITY_RU[task.priority] ?? task.priority}
                      </span>
                    </div>
                    {task.description && <p className="text-sm text-muted-foreground mb-4">{task.description}</p>}
                  </div>
                  <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/5">
                    <div className="text-xs font-mono text-muted-foreground flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {format(new Date(task.createdAt), "d MMM, HH:mm", { locale: ru })}
                    </div>
                    <div className="flex space-x-2">
                      <button onClick={() => handleTaskStatusToggle(task.id, task.status)}
                        className="p-2 hover:bg-primary/20 rounded text-primary transition-colors"
                        title={task.status === "done" ? "Возобновить" : "Завершить"}>
                        {task.status === "done" ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                      </button>
                      <button onClick={() => deleteTask.mutate({ id: task.id }, { onSuccess: () => refetchTasks() })}
                        className="p-2 hover:bg-destructive/20 rounded text-destructive transition-colors" title="Удалить">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
              {!tasks?.length && (
                <div className="col-span-2 text-center py-12 text-muted-foreground font-mono">Задач нет</div>
              )}
            </div>
          </div>
        )}

        {activeTab === "memory" && (
          <div className="space-y-6">
            <form onSubmit={handleCreateMemory} className="flex space-x-4">
              <input 
                type="text" 
                value={newMemoryContent}
                onChange={e => setNewMemoryContent(e.target.value)}
                placeholder="Запомнить новую информацию..."
                className="flex-1 bg-black/40 border border-primary/30 rounded py-3 px-4 font-mono text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-primary"
              />
              <button 
                type="submit"
                disabled={createMemory.isPending || !newMemoryContent.trim()}
                className="px-6 bg-primary/20 text-primary border border-primary hover:bg-primary hover:text-background rounded font-mono uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(0,212,255,0.2)]"
              >
                <Plus className="w-5 h-5" />
              </button>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {memoryEntries?.map((entry) => (
                <motion.div 
                  key={entry.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-panel rounded-lg p-5 flex flex-col border border-accent/20"
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs px-2 py-1 bg-accent/20 text-accent rounded font-mono uppercase tracking-wider">
                      {CATEGORY_RU[entry.category] ?? entry.category}
                    </span>
                    <div className="flex items-center space-x-1">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className={cn("w-1.5 h-3 rounded-sm", i < entry.importance ? "bg-accent" : "bg-accent/20")} />
                      ))}
                    </div>
                  </div>
                  <p className="text-sm mb-4 flex-1">{entry.content}</p>
                  <div className="flex justify-between items-center mt-auto pt-3 border-t border-white/5">
                    <div className="text-xs font-mono text-muted-foreground flex items-center">
                      <Brain className="w-3 h-3 mr-1" />
                      {format(new Date(entry.createdAt), "d MMM yyyy", { locale: ru })}
                    </div>
                    <button onClick={() => deleteMemory.mutate({ id: entry.id }, { onSuccess: () => refetchMemory() })}
                      className="p-1 hover:text-destructive transition-colors text-muted-foreground" title="Удалить">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
              {!memoryEntries?.length && (
                <div className="col-span-3 text-center py-12 text-muted-foreground font-mono">Память пуста</div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
