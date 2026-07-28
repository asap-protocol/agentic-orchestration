import type { Workflow } from "./workflow-types"

export interface HistoryState {
  workflow: Workflow
  timestamp: number
}

export class HistoryManager {
  private undoStack: HistoryState[] = []
  private redoStack: HistoryState[] = []
  private maxHistorySize = 50
  private revision = 0
  private readonly listeners = new Set<() => void>()

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getRevision(): number {
    return this.revision
  }

  private notify() {
    this.revision += 1
    for (const listener of this.listeners) {
      listener()
    }
  }

  saveState(workflow: Workflow) {
    const snapshot = JSON.parse(JSON.stringify(workflow)) as Workflow
    const top = this.undoStack[this.undoStack.length - 1]
    if (top && JSON.stringify(top.workflow) === JSON.stringify(snapshot)) {
      return
    }

    this.undoStack.push({
      workflow: snapshot,
      timestamp: Date.now(),
    })

    if (this.undoStack.length > this.maxHistorySize) {
      this.undoStack.shift()
    }

    this.redoStack = []
    this.notify()
  }

  canUndo(): boolean {
    return this.undoStack.length > 0
  }

  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  undo(currentWorkflow: Workflow): Workflow | null {
    if (!this.canUndo()) return null

    this.redoStack.push({
      workflow: JSON.parse(JSON.stringify(currentWorkflow)),
      timestamp: Date.now(),
    })

    const previousState = this.undoStack.pop()!
    this.notify()
    return previousState.workflow
  }

  redo(currentWorkflow: Workflow): Workflow | null {
    if (!this.canRedo()) return null

    this.undoStack.push({
      workflow: JSON.parse(JSON.stringify(currentWorkflow)),
      timestamp: Date.now(),
    })

    const nextState = this.redoStack.pop()!
    this.notify()
    return nextState.workflow
  }

  clear() {
    this.undoStack = []
    this.redoStack = []
    this.notify()
  }
}

const historyManagers = new Map<string, HistoryManager>()

export function getHistoryManager(workflowId: string): HistoryManager {
  if (!historyManagers.has(workflowId)) {
    historyManagers.set(workflowId, new HistoryManager())
  }
  return historyManagers.get(workflowId)!
}
