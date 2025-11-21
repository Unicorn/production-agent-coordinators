import { z } from 'zod';

// Requirement statuses
export const RequirementStatusSchema = z.enum([
  'IDEA',
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'PAUSED'
]);

export type RequirementStatus = z.infer<typeof RequirementStatusSchema>;

// Task statuses
export const TaskStatusSchema = z.enum([
  'TODO',
  'READY',
  'BLOCKED',
  'IN_PROGRESS',
  'COMPLETED',
  'FAILED',
  'PAUSED'
]);

export type TaskStatus = z.infer<typeof TaskStatusSchema>;

// BrainGrid Project
export const BrainGridProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional()
});

export type BrainGridProject = z.infer<typeof BrainGridProjectSchema>;

// BrainGrid Requirement
export const BrainGridRequirementSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  status: RequirementStatusSchema,
  description: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});

export type BrainGridRequirement = z.infer<typeof BrainGridRequirementSchema>;

// BrainGrid Task
export const BrainGridTaskSchema = z.object({
  id: z.string(),
  reqId: z.string(),
  title: z.string(),
  status: TaskStatusSchema,
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  dependencies: z.array(z.string()).optional(),
  assignedTo: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

export type BrainGridTask = z.infer<typeof BrainGridTaskSchema>;

// CLI Error
export class BrainGridCliError extends Error {
  constructor(
    message: string,
    public command: string,
    public exitCode: number,
    public stderr: string
  ) {
    super(message);
    this.name = 'BrainGridCliError';
  }
}
