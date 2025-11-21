# Milestone 4: Batch Processing - Navigation & Context

**Duration**: Weeks 19-24 (6 weeks)
**Goal**: Enable batch processing workflows with concurrency control
**Team**: 5 people (2 BE, 1 FE, 0.5 DevOps, 0.5 QA)

---

## What This Milestone Delivers

### User-Facing Features
- **Loop Container Node**: Visual container for processing arrays/lists
- **Concurrency Control**: Slider to set parallel execution (1-10x)
- **Sequential vs Parallel Toggle**: Choose execution mode
- **Progress Visualization**: Real-time progress bar with ETA
- **History Viewer**: See results for each processed item

### Technical Capabilities
- **Sequential Loop Pattern**: Process items one-by-one
- **Parallel Loop Pattern**: Process multiple items simultaneously with Promise.race()
- **Concurrency Control**: Limit parallel executions (slot management)
- **Progress Tracking**: Real-time updates during execution
- **Error Handling**: Fail-fast, continue-on-error, retry strategies
- **Performance Optimization**: Handle 1000+ items efficiently

### Use Cases Enabled

**1. Bulk Email Sender**
```
[Start] → [For each user in users]
            └─→ [Send Personalized Email]
          → [Generate Report] → [End]
```
*Process 100s of users sequentially or in parallel*

**2. Multi-Package Build**
```
[Start] → [For each package in packages]
            └─→ [Build Package] (4 concurrent)
          → [Integration Tests] → [End]
```
*Build multiple packages in parallel with controlled concurrency*

**3. Data Migration**
```
[Start] → [For each record in records]
            └─→ [Transform & Load] (10 concurrent)
          → [Verify Counts] → [End]
```
*Migrate 1000s of records efficiently*

---

## Document Structure

This milestone plan consists of 4 documents:

### 1. **MILESTONE-4-TASKS.md** (This Document's Foundation)
**Purpose**: Comprehensive task breakdown with full details
**Use When**: Planning sprints, assigning work, tracking progress
**Key Sections**:
- Executive Summary (critical path, team structure, challenges)
- Phase 1: Sequential Loop Foundation (Week 19)
- Phase 2: Concurrency Control (Weeks 20-21) ⚠️ CRITICAL
- Phase 3: Performance Testing (Week 22) ⚠️ CRITICAL
- Phase 4: Demo Preparation (Week 23)
- Phase 5: Buffer & Demo (Week 24)
- Dependency Graph
- Weekly Timeline
- Risk Mitigation
- Success Metrics
- Performance Benchmarks
- Handoff to M5

**Read This**: When you need task details, acceptance criteria, testing requirements

---

### 2. **MILESTONE-4-GANTT.md** (Timeline Visualization)
**Purpose**: Visual timeline and dependency tracking
**Use When**: Understanding schedule, identifying bottlenecks, resource planning
**Key Sections**:
- Gantt Chart (week-by-week view)
- Dependency Graph (visual representation)
- Critical Path Analysis (90 hours)
- Parallelization Opportunities
- Resource Allocation by Week
- Risk Hotspots on Timeline
- Daily Breakdown (Week 20 - critical week)
- Success Indicators by Week

**Read This**: When you need to visualize timeline or understand dependencies

---

### 3. **MILESTONE-4-QUICK-REFERENCE.md** (Daily Guide)
**Purpose**: Quick lookup for daily work and checkpoints
**Use When**: Daily standups, weekly check-ins, troubleshooting
**Key Sections**:
- Critical Path (one-page view)
- Week-by-Week Milestones
- Daily Focus Areas
- Key Tasks (ordered by risk)
- Performance Targets
- Team Assignments by Week
- Weekly Checkpoints
- Red Flags & Escalation
- Common Issues & Solutions
- Quick Commands

**Read This**: Keep on your desk for daily reference

---

### 4. **MILESTONE-4-README.md** (This Document)
**Purpose**: Navigation and context for the entire milestone
**Use When**: First time reading, onboarding new team members, understanding overall scope
**Key Sections**:
- What This Milestone Delivers
- Document Structure (you are here)
- How to Use These Documents
- Why Milestone 4 is Different
- Key Concepts Explained
- Prerequisites and Dependencies
- Questions & Answers

**Read This**: Start here if new to Milestone 4

---

## How to Use These Documents

### For Project Managers
1. **Start**: Read this README for context
2. **Planning**: Use MILESTONE-4-TASKS.md to create sprint plans
3. **Tracking**: Use MILESTONE-4-GANTT.md to monitor progress
4. **Daily**: Use MILESTONE-4-QUICK-REFERENCE.md for standups

### For Engineers
1. **Start**: Read this README and QUICK-REFERENCE
2. **Task Details**: Look up your tasks in MILESTONE-4-TASKS.md
3. **Dependencies**: Check MILESTONE-4-GANTT.md before starting work
4. **Daily**: Refer to QUICK-REFERENCE for focus areas

### For QA Engineers
1. **Start**: Read this README
2. **Test Planning**: Review acceptance criteria in MILESTONE-4-TASKS.md
3. **Performance Testing**: Focus on Week 22 section in all docs
4. **Daily**: Use QUICK-REFERENCE for testing priorities

### For DevOps Engineers
1. **Start**: Read this README
2. **Infrastructure**: Review M4-T020, M4-T052 in TASKS.md
3. **Timeline**: Check GANTT.md for infrastructure setup timing
4. **Monitoring**: Set up dashboards per QUICK-REFERENCE

---

## Why Milestone 4 is Different

### Compared to Milestones 1-3

**Milestone 1** (Linear Workflows):
- Foundation milestone
- Simple sequential execution
- Focus: Get basic workflows working

**Milestone 2** (Decision Trees):
- Added conditionals (if/else)
- State management
- Focus: Control flow

**Milestone 3** (AI Self-Healing):
- Added AI remediation
- Coordinator retry pattern
- Focus: Resilience

**Milestone 4** (Batch Processing):
- Added loop containers
- Concurrency control
- Focus: **Performance at scale**

### Unique Challenges

1. **Concurrency Control Complexity**
   - Most complex compiler pattern yet
   - Promise.race() with slot management
   - Estimated 20h, realistically 30-40h
   - **Why complex**: Temporal workflows must be deterministic, but Promise.race() is inherently non-deterministic

2. **Performance Requirements**
   - Must handle 1000+ items
   - Memory management critical
   - Database optimization required
   - **Why critical**: Batch processing is all about performance - if it's slow, it's useless

3. **Testing at Scale**
   - Can't manually test 1000 items
   - Need automated performance testing
   - Load testing infrastructure required
   - **Why different**: M1-3 could be manually tested, M4 needs automation

### Lower Team Utilization (40% vs 60%)

**Why?**
- Concurrency control requires deep thinking time
- Performance optimization needs profiling and analysis
- Quality over quantity for complex patterns

**Is this OK?**
- Yes! M4 is about correctness and performance
- Better to take time and get it right than rush and fail at scale

---

## Key Concepts Explained

### 1. Loop Container Node

**What is it?**
A special node type that contains other nodes (activities) and executes them for each item in an array.

**Visual Representation**:
```
┌─────────────────────────────────┐
│ Loop: For each user             │
│ ┌─────────────────────────────┐ │
│ │ [Send Email]                │ │
│ │        ↓                    │ │
│ │ [Log Result]                │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**In Generated Code**:
```typescript
for (const user of users) {
  await sendEmail(user);
  await logResult(user);
}
```

---

### 2. Sequential vs Parallel Execution

**Sequential** (Safe, Predictable):
```
Item 1 → Item 2 → Item 3 → Item 4 → Item 5
  1s      1s       1s       1s       1s
Total: 5 seconds
```

**Parallel 4x** (Fast, Complex):
```
Item 1 ──┐
Item 2 ──┼─→ Complete
Item 3 ──┤
Item 4 ──┘
  ↓ (1 completes, start next)
Item 5 ──→ Complete

Total: ~1.25 seconds (4x speedup)
```

---

### 3. Concurrency Control (Promise.race() Pattern)

**Problem**: Can't start all 1000 jobs at once (memory, resource limits)

**Solution**: Limit concurrent jobs to N (e.g., 4)

**How it Works**:
1. Start 4 jobs in parallel
2. Wait for ANY job to complete (Promise.race())
3. Start next job in the freed slot
4. Repeat until all items processed

**Code Pattern**:
```typescript
const maxConcurrent = 4;
const activeJobs = new Map<number, Promise<void>>();

for (let i = 0; i < items.length; i++) {
  // Wait if at capacity
  while (activeJobs.size >= maxConcurrent) {
    const completed = await Promise.race(
      Array.from(activeJobs.entries()).map(async ([idx, promise]) => {
        await promise;
        return idx;
      })
    );
    activeJobs.delete(completed);
  }

  // Start new job
  const job = processItem(items[i], i);
  activeJobs.set(i, job);
}

// Drain remaining jobs
while (activeJobs.size > 0) {
  const completed = await Promise.race(/* ... */);
  activeJobs.delete(completed);
}
```

**Why Complex?**
- Must be deterministic (Temporal requirement)
- Slot management with Map
- Draining logic at end
- Error handling per job

---

### 4. Progress Tracking

**Challenge**: How to show progress for 1000-item loop in real-time?

**Solution**: Batch updates
- Update database every 10 items (not every item)
- Emit progress events asynchronously
- Calculate ETA based on rate

**Data Tracked**:
- Completed count (e.g., 450)
- Total count (e.g., 1000)
- Percentage (e.g., 45%)
- Items/second rate (e.g., 5.2 items/sec)
- ETA (e.g., 2 minutes remaining)

**UI Updates**:
- Poll every 1 second during execution
- Progress bar fills smoothly
- Stop polling when complete

---

### 5. Performance Optimization

**Bottlenecks Identified**:
1. **Database**: Too many progress updates
   - Solution: Batch updates (every 10 items)
2. **Memory**: Loading all items at once
   - Solution: Stream items, clear completed jobs
3. **Temporal**: Large workflow history
   - Solution: Reduce update frequency, use signals (M6)

**Benchmarks**:
- 1000 items, sequential: <5 minutes
- 1000 items, 10x parallel: <1 minute
- Memory usage: <1GB

---

## Prerequisites and Dependencies

### From Milestone 3 (Must Be Complete)

- [ ] AI self-healing workflows working
- [ ] Coordinator retry pattern implemented
- [ ] Workflow state management
- [ ] Execution monitoring UI
- [ ] Code generation for activities and conditionals

**Why Required**:
- M4 builds on M3's state management
- Loop progress uses execution monitoring foundation
- Error handling uses retry patterns from M3

### Technical Dependencies

**Temporal**:
- Version: 1.x (supports Promise.race())
- Workflow history limits: Must handle 1000+ activities
- Worker capacity: Must scale to handle concurrency

**Database**:
- Connection pooling: Must support concurrent progress updates
- Indexes: Required on workflow_executions, loop_progress tables
- Query performance: <100ms for progress queries

**Frontend**:
- ReactFlow: Must support nested nodes (loop containers)
- Polling: Must not freeze UI during rapid updates
- Virtual scrolling: Required for 1000+ item history

---

## Risk Assessment

### Critical Risks (High Impact, High Probability)

1. **Concurrency Control Implementation** (Week 20)
   - **Probability**: 70% (will take longer than estimated)
   - **Impact**: Delays entire milestone
   - **Mitigation**: Start early, pair programming, senior review

2. **Performance at Scale** (Week 22)
   - **Probability**: 50% (may need optimization)
   - **Impact**: Demo may be limited to 100 items
   - **Mitigation**: Dedicated optimization week, profiling tools

### Medium Risks (Medium Impact, Low Probability)

3. **Progress Tracking Overhead**
   - **Probability**: 30% (may slow execution)
   - **Impact**: Need to reduce update frequency
   - **Mitigation**: Batch updates, async writes, performance testing

4. **Team Availability** (Week 20 or 22)
   - **Probability**: 20% (illness, vacation)
   - **Impact**: Critical tasks delayed
   - **Mitigation**: Cross-training, buffer week

### Low Risks (Low Impact, Low Probability)

5. **Load Testing Infrastructure**
   - **Probability**: 20% (may not be ready)
   - **Impact**: Manual load testing instead
   - **Mitigation**: Simple tools (k6), early setup

---

## Success Criteria

### Must Have (Demo Blockers)
- [ ] Loop container node works in UI
- [ ] Sequential loop executes 100 items
- [ ] Parallel loop executes with concurrency control
- [ ] Progress bar shows real-time updates
- [ ] Demo workflow runs successfully 3+ times

### Should Have (Performance Targets)
- [ ] 1000 items complete in <5 minutes
- [ ] 4x concurrency achieves >3x speedup
- [ ] Memory usage <1GB
- [ ] No critical bugs

### Nice to Have (Stretch Goals)
- [ ] 5000 items supported
- [ ] 50 concurrent workflows (load testing)
- [ ] Dependency-aware scheduling (preview of M5)

---

## Milestone 4 in Context of Overall Roadmap

### Before M4
**M1**: Linear workflows (activities in sequence)
**M2**: Decision trees (conditionals, branches)
**M3**: AI self-healing (coordinator retry pattern)

### Milestone 4 (You Are Here)
**Batch Processing**: Process arrays with concurrency control

**Value Add**:
- Enables high-volume use cases (bulk operations)
- Performance optimization foundation
- Introduces concurrency patterns for M5

### After M4
**M5**: Dynamic Orchestration
- Child workflows (spawn workflows from workflows)
- Dependency-aware concurrency (PackageBuilder pattern)
- Dynamic slot management with Promise.race()

**M6**: Production Polish
- Signal handling
- Continue-as-new (long-running workflows)
- Advanced debugging tools

**Why M4 is Critical**:
- M5 builds on M4's concurrency control
- PackageBuilder system requires parallel execution
- Without M4, can't achieve M5 goals

---

## Questions & Answers

**Q: Why is the team utilization lower in M4 (40% vs 60% in M1)?**
A: Concurrency control is complex and requires deep thinking time. Quality over quantity. Better to take time and get it right than rush and fail at scale.

**Q: What if concurrency control takes longer than 20 hours?**
A: We have buffer in Week 24. Realistic estimate is 30-40h. Can also ship sequential-only as fallback and add parallel in a follow-up.

**Q: Why dedicate an entire week to performance testing (Week 22)?**
A: Batch processing is all about performance. If it's slow, it's useless. Need time to identify bottlenecks and optimize. M1-3 didn't need this because they weren't performance-critical.

**Q: Can we skip the 1000-item demo and show 100 items instead?**
A: Yes, that's our fallback plan. 100 items is still valuable. But 1000 items proves we can handle production scale.

**Q: What if we fall behind in Week 20 (concurrency control)?**
A: Week 20 has daily check-ins and pair programming built in. If not compiling by Wednesday, escalate and consider extending into Week 21. Week 24 is full buffer.

**Q: How does M4 prepare us for M5 (PackageBuilder)?**
A: M5 needs dependency-aware concurrency (build packages in order). M4's Promise.race() pattern is the foundation. M5 adds dependency resolution on top of M4's slot management.

**Q: What's the most likely reason M4 could fail?**
A: Promise.race() pattern (M4-T030) taking 40+ hours instead of 20h. Mitigation: start early, pair programming, senior review, fallback to sequential.

**Q: What should we focus on if we have to cut scope?**
A: Priority order:
1. Sequential loop (must have)
2. Parallel loop with concurrency 4x (should have)
3. Progress tracking (nice to have)
4. 1000-item scale (nice to have)

---

## Getting Started

### For Team Members Starting M4

**Week 1 (Before Week 19)**:
1. Read this README (you're doing it!)
2. Read MILESTONE-4-QUICK-REFERENCE.md
3. Review your assigned tasks in MILESTONE-4-TASKS.md
4. Check dependencies in MILESTONE-4-GANTT.md
5. Set up local environment (Temporal, monitoring)

**Week 19 (Foundation Week)**:
1. Attend kickoff meeting
2. Review your Week 19 tasks
3. Set up daily standups (focus on critical path)
4. Start work Monday morning

**Week 20 (CRITICAL)**:
1. All hands on concurrency control
2. Daily check-ins at 10am and 3pm
3. Pair programming for M4-T030
4. Code review Wednesday

**Ongoing**:
- Check QUICK-REFERENCE daily
- Track progress on GANTT
- Update task status in TASKS.md
- Escalate blockers immediately

---

## Document Maintenance

### When to Update

**MILESTONE-4-TASKS.md**:
- When tasks are completed (mark done)
- When estimates change (update hours)
- When new tasks discovered (add to backlog)
- After retrospective (lessons learned)

**MILESTONE-4-GANTT.md**:
- When tasks slip (update timeline)
- When resources change (update assignments)
- Weekly (update progress)

**MILESTONE-4-QUICK-REFERENCE.md**:
- When red flags identified (update escalation)
- When common issues found (add to troubleshooting)
- When commands change (update quick commands)

**MILESTONE-4-README.md**:
- When scope changes (update deliverables)
- When FAQs arise (add to Q&A)
- After milestone (update with actual results)

---

## Resources

### Code Repositories
- **Main Branch**: `feature/milestone-4-batch-processing`
- **Base**: `main` (merge from M3 completion)
- **PR Target**: `main`

### Documentation
- **User Guide**: `docs/user-guide/batch-processing.md` (created in Week 23)
- **Developer Guide**: `docs/architecture/loop-compiler.md` (created in Week 23)
- **API Reference**: `docs/api/loop-progress-api.md` (created in Week 23)

### Tools
- **Task Tracking**: GitHub Projects or Jira
- **Monitoring**: DataDog / New Relic / Grafana
- **Performance Testing**: k6 or Artillery
- **Load Testing**: k6 or JMeter

### Communication
- **Daily Standups**: 9:30am (15 minutes)
- **Weekly Demos**: Friday 2pm (1 hour)
- **Slack Channel**: #milestone-4-batch-processing
- **Email**: milestone-4@workflow-builder.com

---

## After Milestone 4

### Completion Checklist
- [ ] All 5 demo points successful
- [ ] Stakeholder feedback collected
- [ ] Performance benchmarks documented
- [ ] Code merged to main
- [ ] Documentation published
- [ ] Team retrospective completed
- [ ] Lessons learned documented
- [ ] Handoff to M5 prepared

### Retrospective Questions
1. What went well?
2. What took longer than expected? (adjust M5 estimates)
3. What performance bottlenecks were found? (inform M5)
4. What would we do differently?
5. What should we keep doing?

### Handoff to Milestone 5
- Review INCREMENTAL-VALUE-ROADMAP.md for M5 scope
- Create MILESTONE-5-TASKS.md, GANTT.md, QUICK-REFERENCE.md, README.md
- Schedule M5 kickoff meeting
- Carry forward lessons learned from M4

---

## Conclusion

**Milestone 4 is about enabling batch processing with performance at scale.**

**Three Critical Weeks**:
1. **Week 20**: Concurrency control (Promise.race() pattern)
2. **Week 22**: Performance testing and optimization
3. **Week 24**: Demo to stakeholders

**Success Factors**:
- Focus on concurrency control (Week 20)
- Dedicated performance week (Week 22)
- Buffer for unexpected issues (Week 24)
- Team collaboration and daily check-ins
- Realistic estimates and fallback plans

**If in doubt, refer to**:
- Daily: MILESTONE-4-QUICK-REFERENCE.md
- Weekly: MILESTONE-4-GANTT.md
- Task Details: MILESTONE-4-TASKS.md
- Context: This README

**Remember**: Quality over quantity. Better to ship sequential loops that work than parallel loops that crash.

---

**Created**: 2025-01-19
**Version**: 1.0
**Status**: Ready for Review
**Next Steps**: Team review, kickoff meeting, start Week 19
