import Anthropic from '@anthropic-ai/sdk'
import Handlebars from 'handlebars'
import * as fs from 'fs/promises'
import * as path from 'path'
import { fileURLToPath } from 'url'
import type { Problem, AgentRegistry, CoordinatorAction } from '../types/coordinator.types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export async function analyzeProblem(
  problem: Problem,
  registry: AgentRegistry
): Promise<CoordinatorAction> {
  // Load prompt template
  const templatePath = path.join(__dirname, '../prompts/coordinator-analysis.hbs')
  const templateContent = await fs.readFile(templatePath, 'utf-8')
  const template = Handlebars.compile(templateContent)

  // Render prompt with problem data
  const prompt = template({
    problem,
    agents: registry.agents
  })

  // Call Claude API
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  })

  const response = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',
    max_tokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS || '4096'),
    temperature: 0.2,
    messages: [{
      role: 'user',
      content: prompt
    }]
  })

  // Parse JSON response
  const content = response.content[0]
  if (content.type !== 'text') {
    throw new Error('Expected text response from Claude')
  }

  const action = JSON.parse(content.text) as CoordinatorAction

  // Validate action structure
  validateCoordinatorAction(action)

  return action
}

function validateCoordinatorAction(action: CoordinatorAction): void {
  if (!action.decision) {
    throw new Error('CoordinatorAction must have decision field')
  }

  if (action.decision === 'DELEGATE' && (!action.agent || !action.task)) {
    throw new Error('DELEGATE decision requires agent and task fields')
  }

  if (action.decision === 'ESCALATE' && !action.escalation) {
    throw new Error('ESCALATE decision requires escalation field')
  }

  if (!action.reasoning) {
    throw new Error('CoordinatorAction must have reasoning field')
  }
}

export async function writeDiagnosticReport(
  problem: Problem,
  action: CoordinatorAction
): Promise<void> {
  const reportPath = action.escalation?.reportPath || '/tmp/coordinator-diagnostic.json'

  const report = {
    timestamp: new Date().toISOString(),
    problem,
    action,
    escalatedBy: 'CoordinatorWorkflow'
  }

  await fs.writeFile(reportPath, JSON.stringify(report, null, 2))
  console.log(`📊 Diagnostic report written: ${reportPath}`)
}
