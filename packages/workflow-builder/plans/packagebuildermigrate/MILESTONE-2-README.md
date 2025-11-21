# Milestone 2: Decision Trees - Complete Planning Package

**Status**: Ready to Start (After M1 Complete)
**Timeline**: 6 weeks (Weeks 7-12)
**Team**: 5 people (2 BE, 1 FE, 0.5 DevOps, 0.5 QA)
**Goal**: Ship working conditional workflows with if/else branching, variables, and basic retry

---

## Quick Start

### If you're starting Week 7 (after M1 complete):
1. Read [MILESTONE-2-TASKS.md](./MILESTONE-2-TASKS.md) - Full task breakdown
2. Read [MILESTONE-2-QUICK-REFERENCE.md](./MILESTONE-2-QUICK-REFERENCE.md) - Week-by-week overview
3. Review M1 retrospective (lessons learned)
4. Schedule Monday Week 7 kickoff meeting (1 hour)
5. Start Monday morning!

### If you want the big picture:
1. Read [INCREMENTAL-VALUE-ROADMAP.md](./INCREMENTAL-VALUE-ROADMAP.md) - All 6 milestones
2. Read [MILESTONE-1-README.md](./MILESTONE-1-README.md) - What we built in M1
3. Read [MILESTONE-2-GANTT.md](./MILESTONE-2-GANTT.md) - Visual timeline and dependencies

---

## Document Overview

### Planning Documents (Read These)

#### 1. [INCREMENTAL-VALUE-ROADMAP.md](./INCREMENTAL-VALUE-ROADMAP.md)
**What**: Complete 6-milestone roadmap for the entire project
**Why**: Understand where Milestone 2 fits in the bigger picture
**Who**: Everyone (especially stakeholders and leadership)
**When**: Read before starting project

**Key Sections**:
- Milestone 1: Linear Workflows (Weeks 1-6) ← **Completed**
- Milestone 2: Decision Trees (Weeks 7-12) ← **You are here**
- Milestone 3: AI Self-Healing (Weeks 13-18)
- Milestone 4: Batch Processing (Weeks 19-24)
- Milestone 5: Dynamic Orchestration (Weeks 25-30)
- Milestone 6: Production Polish (Weeks 31-36)

---

#### 2. [MILESTONE-2-TASKS.md](./MILESTONE-2-TASKS.md) ⭐ **MOST IMPORTANT**
**What**: Detailed breakdown of all 31 tasks for Milestone 2
**Why**: This is your execution playbook - everything is here
**Who**: All engineers, QA, DevOps
**When**: Read on Day 1 of Week 7, reference throughout Milestone 2

**Key Sections**:
- **Phase 1: Foundation (Week 7)** - 13 tasks, mostly parallel
- **Phase 2: Integration (Weeks 8-9)** - 8 tasks, backend + frontend convergence
- **Phase 3: Testing & Polish (Week 10)** - 5 tasks, quality focus
- **Phase 4: Demo Preparation (Week 11)** - 4 tasks, documentation + demo
- **Phase 5: Buffer & Final Polish (Week 12)** - 2 tasks, bug fixes + rehearsal

**Each task includes**:
- Task ID (M2-T001, M2-T002, etc.)
- Owner (Backend, Frontend, DevOps, QA)
- Dependencies (what must complete first, including M1 tasks)
- Parallelization (what can run simultaneously)
- Estimate (hours or days)
- Acceptance criteria (how to know it's done)
- Testing requirements
- Completion requirements
- Deliverables (files created/modified)

---

#### 3. [MILESTONE-2-QUICK-REFERENCE.md](./MILESTONE-2-QUICK-REFERENCE.md) ⭐ **START HERE**
**What**: Quick reference guide - TL;DR version of task breakdown
**Why**: Fast lookup for weekly goals, critical path, success metrics
**Who**: All team members, especially team leads
**When**: Keep open during daily standups and planning

**Key Sections**:
- Critical Path (74 hours over 4 weeks)
- Week-by-Week Milestones (what success looks like each week)
- 6-Point Demo Checklist (must-have for final demo)
- Task Ownership Quick Reference (who does what when)
- Risk Management (high-risk tasks to watch)
- Success Metrics (quantitative and qualitative)
- Comparison with M1 (what's different)

---

#### 4. [MILESTONE-2-GANTT.md](./MILESTONE-2-GANTT.md)
**What**: Visual timeline, Gantt chart, dependency graph
**Why**: See the schedule visually, understand parallelization
**Who**: Team leads, project managers, visual learners
**When**: Use for weekly planning and schedule reviews

**Key Sections**:
- Gantt Chart (week view with all tasks)
- Dependency Graph (visual task dependencies)
- Critical Path Analysis (longest sequence of dependent tasks)
- Task Scheduling by Engineer (individual workload)
- Resource Leveling (team capacity utilization)
- Parallelization Matrix (what can run in parallel)
- Timeline Visualization (calendar view)
- Decision Gates (go/no-go checkpoints)
- Comparison with M1 (efficiency analysis)

---

## How to Use These Documents

### Before Week 7 (M1 Wrap-Up)
1. **M1 Retrospective**: What worked, what didn't, lessons learned
2. **Team lead reads**: All M2 documents (full understanding)
3. **Team members read**: MILESTONE-2-TASKS.md + their assigned tasks
4. **Schedule**: Monday Week 7 kickoff meeting
5. **Review**: M1 codebase (foundation for M2)

### Week 7 (Foundation)
1. **Monday AM**: Kickoff meeting (1 hour)
2. **Daily**: Reference MILESTONE-2-QUICK-REFERENCE.md
3. **Daily 9am**: Standup (15 min)
4. **Friday 2pm**: Weekly demo (30 min)
5. **Friday 3pm**: Retrospective (30 min)

### Week 8-11 (Execution)
1. **Daily 9am**: Standup using MILESTONE-2-QUICK-REFERENCE.md
2. **Weekly**: Demo following week-by-week milestones
3. **As needed**: Check MILESTONE-2-TASKS.md for acceptance criteria
4. **As needed**: Check MILESTONE-2-GANTT.md for dependencies
5. **Week 9**: Critical checkpoint meeting (Friday)

### Week 12 (Buffer & Demo)
1. **Bug fixes**: Address issues from Week 11
2. **Demo prep**: Rehearse 6-point demo
3. **Final demo**: Present to stakeholders
4. **Decision**: Go/No-Go for Milestone 3

---

## Critical Success Factors

### 1. Build on M1 Foundation
**Most Important**: Reuse M1 components instead of rebuilding
- Extend WorkflowCanvas (don't rebuild)
- Extend PropertyPanel (add conditional config)
- Extend deployment pipeline (add validation)
- Extend execution monitoring (add branch tracking)

**Why**: We have 38% less capacity (3.4 FTE vs. 5.5 FTE). Must leverage existing work.

---

### 2. Follow the Critical Path
**Critical Tasks**: Backend Engineer 1 must complete:
- Week 7: Conditional Pattern (T020) + Retry Pattern (T022)
- Week 8: Variable Management (T021) + Conditional Engine (T061)
- Week 9: Deployment Pipeline (T070)

**Why**: This is the longest dependency chain. Delays here delay everything.

---

### 3. Manage Frontend Workload
**Week 7 Risk**: FE1 has 38h planned (95% of capacity)
- Monitor daily progress on T040 (Conditional Node)
- Be ready to defer T042 (Variables Panel) to Week 8
- Simplify T041 (Branch Edges) if needed

**Why**: Single frontend engineer with heavy Week 7 workload. Need flexibility.

---

### 4. Secure Expression Evaluation
**High Risk**: M2-T061 (Conditional Engine) evaluates user expressions
- Use safe evaluation library (not `eval()`)
- Validate expressions before compilation
- Limit expression complexity
- Security review required

**Why**: Arbitrary code execution is a security risk. Must be safe for production.

---

### 5. Test Continuously
**Don't Wait for Week 10**: Write tests as you build
- Unit tests for all new patterns (conditional, variable, retry)
- Integration tests for execution engine
- E2E tests for UI flows

**Why**: Reduced team size means less time for bug fixes. Catch issues early.

---

## Milestone 2 Success = All 6 Demo Points

By end of Week 12, you must successfully demonstrate:

1. ✅ **Build approval workflow** - If/else branches with clear paths
2. ✅ **Set up variables** - Declare, assign default values, reference in conditions
3. ✅ **Configure retry** - Max 3 attempts, exponential backoff (1s, 2s, 4s)
4. ✅ **Execute with branching** - Show both true and false paths in separate runs
5. ✅ **Show retry in action** - Force failure, watch 3 retry attempts with timing
6. ✅ **Monitor conditional execution** - Branch path highlighted (green/red), variable values shown

---

## Team Roles & Responsibilities

- **Backend Engineer 1**: Conditional pattern, variable management, conditional engine (Critical Path Owner)
- **Backend Engineer 2**: API layer, database, state management, retry executor
- **Frontend Engineer 1**: Conditional node, variables panel, branch edges, config UI
- **DevOps Engineer (0.5 FTE)**: Infrastructure support, monitoring enhancements
- **QA Engineer (0.5 FTE)**: Test automation, manual testing, demo prep

---

## Decision Points

### End of Week 9: Critical Checkpoint
**Question**: Can we demo in 3 weeks?

**Go** if: Can create, deploy, execute conditional workflows with working branches
**Caution** if: 2 of 3 working, some bugs
**Stop** if: Cannot execute conditionals or branches don't work

---

### End of Week 11: Demo Readiness
**Question**: Are we ready to demo?

**Go** if: All 6 demo points working, no critical bugs
**Caution** if: 5 of 6 working, have backup plan
**Stop** if: <5 demo points working

---

## Success Metrics

### Quantitative
- Tasks completed: 31/31 (100%)
- Conditional workflows created: 15-25
- Execution success rate: >92%
- Test coverage: >80%
- P0 bugs: 0
- Demo points working: 6/6

### Qualitative
- User can create conditional workflow in 15 minutes
- Demo runs without crashes
- Users understand branch logic and variables
- Documentation enables self-service
- Code quality suitable for production

---

## What's New in Milestone 2?

### New Features (vs. M1)
1. **Conditional Node** - If/else branching with visual diamond shape
2. **Branch Edges** - Color-coded true (green) / false (red) paths
3. **Variables Panel** - Declare and manage workflow state
4. **Expression Language** - Simple comparisons (==, !=, >, <, &&, ||)
5. **Retry Configuration** - Exponential backoff on activity failures
6. **Conditional Execution Monitoring** - Track which branch was taken
7. **Variable State Tracking** - View variable values over time

### New Use Cases (vs. M1)
1. **Approval Workflows** - If approved → provision, else → reject
2. **Validation Pipelines** - If valid → process, else → retry
3. **Smart Routing** - Route based on conditions (user tier, data type, etc.)
4. **Error Handling** - If error → retry with backoff
5. **Business Logic** - Conditional branches based on variables

### Value Increase
- **M1**: 30-40% of workflows (linear only)
- **M2**: 60-70% of workflows (+ conditionals)
- **Increase**: +30 percentage points in use case coverage

---

## Differences from Milestone 1

### Team Size
- **M1**: 6 people (5.5 FTE effective)
- **M2**: 5 people (3.4 FTE effective)
- **Change**: -38% capacity
- **Mitigation**: Lower utilization (56.7% vs. 72.5%), reuse M1 components

### Complexity
- **M1**: Foundation (database, compiler, canvas, deployment)
- **M2**: Building on foundation (extend patterns, add features)
- **M1 Risk**: High (unproven foundation)
- **M2 Risk**: Medium (proven foundation, but expression evaluation complexity)

### Critical Path
- **M1**: 78 hours
- **M2**: 74 hours
- **M2 is shorter** despite more features (leveraging M1 foundation)

### Utilization
- **M1**: 72.5% utilization
- **M2**: 56.7% utilization
- **M2 lower** to compensate for reduced team size

---

## FAQ

**Q: What if we finish M1 late?**
A: Delay M2 start accordingly. Don't rush M1 to hit M2 dates.

**Q: What if we fall behind in M2?**
A: Prioritize 6 demo points (must have), cut tests/docs if needed (should have), defer polish (nice to have)

**Q: Can we change the plan mid-milestone?**
A: Yes! Re-estimate, adjust priorities, reassign tasks. Document changes and reasons.

**Q: What if conditional engine is too complex?**
A: Simplify expression language (basic comparisons only), defer complex logic to M3

**Q: Can we use AI to help?**
A: Yes for code generation, tests, docs, debugging. But still need human review for security (expression evaluation).

**Q: What if frontend overloaded in Week 7?**
A: Defer T042 (Variables Panel) to Week 8, simplify T041 (Branch Edges)

---

## Resources

### Internal Documentation
- [Milestone 1 Tasks](./MILESTONE-1-TASKS.md) - What we built (foundation)
- [Architecture Docs](../../docs/architecture/) - System design
- [API Reference](../../docs/api/) - tRPC endpoints
- [User Guide](../../docs/user-guide/) - End-user documentation
- [Testing Guide](../../docs/testing/) - Test strategy

### External Resources
- [Temporal Documentation](https://docs.temporal.io/)
- [Temporal Retry Policies](https://docs.temporal.io/concepts/what-is-a-retry-policy)
- [ReactFlow Custom Nodes](https://reactflow.dev/docs/examples/nodes/custom-node/)
- [Expression Evaluation Security](https://cheatsheetseries.owasp.org/cheatsheets/Injection_Prevention_Cheat_Sheet.html)
- [Playwright Testing](https://playwright.dev/)

### Communication
- **Slack**: #milestone-2-decision-trees
- **Task Board**: GitHub Projects
- **Code**: GitHub Repository (feature/milestone-2 branch)

---

## Pre-Milestone 2 Checklist

**Before Week 7 starts**:
- [ ] Milestone 1 complete and demoed
- [ ] M1 code merged to main
- [ ] M1 retrospective completed
- [ ] Lessons learned documented
- [ ] Known M1 issues triaged (fix in M2 or defer)
- [ ] Stakeholder feedback on M1 collected
- [ ] M2 team availability confirmed (note: reduced team size)
- [ ] M2 kickoff meeting scheduled (Monday Week 7)
- [ ] All team members have read M2 documents
- [ ] Development environment tested with M1 code

---

## What M1 Must Deliver for M2 to Start

**M1 Foundation Required**:
- [ ] WorkflowCanvas component working (drag-and-drop)
- [ ] PropertyPanel component working (node configuration)
- [ ] Compiler generates TypeScript code
- [ ] Deployment pipeline works (compile → validate → register)
- [ ] Execution monitoring works (track progress, view results)
- [ ] Database schema extensible (can add fields to workflows table)
- [ ] Temporal workers running (dynamic registration)
- [ ] CI/CD pipeline operational
- [ ] Staging environment deployed

**If M1 is incomplete**: Prioritize completing these foundational pieces before M2.

---

## Next Steps

1. Complete Milestone 1
2. Run M1 retrospective
3. Review M1 codebase (BE1, BE2, FE1)
4. Read [MILESTONE-2-TASKS.md](./MILESTONE-2-TASKS.md)
5. Read [MILESTONE-2-QUICK-REFERENCE.md](./MILESTONE-2-QUICK-REFERENCE.md)
6. Review your assigned tasks
7. Schedule Monday Week 7 kickoff
8. See you Week 7! 🚀

---

**Ready to start M2?**
- [ ] M1 complete and demoed
- [ ] M1 retrospective completed
- [ ] Read MILESTONE-2-TASKS.md
- [ ] Read MILESTONE-2-QUICK-REFERENCE.md
- [ ] Review your assigned tasks
- [ ] Understand M2 differences (reduced team, conditional complexity)
- [ ] Schedule Monday Week 7 kickoff
- [ ] See you Week 7! 👍

**Questions?** Ask in #milestone-2-decision-trees

---

**Created**: 2025-01-19
**Version**: 1.0
**Review Cycle**: After Week 9 checkpoint
