import { TaskEntry } from "../interfaces/task-entry";

export type TaskTimeoutHandler = (taskEntry: TaskEntry) => void;
