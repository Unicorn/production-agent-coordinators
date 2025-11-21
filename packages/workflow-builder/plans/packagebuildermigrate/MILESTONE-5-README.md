# Milestone 5: Dynamic Orchestration - Complete Planning Package

**Status**: Ready to Start
**Timeline**: 6 weeks (Weeks 25-30)
**Team**: 4 people (2 BE, 1 FE, 0.5 DevOps, 0.5 QA)
**Goal**: Complete PackageBuilder migration with dependency-aware dynamic orchestration

---

## 🎯 THE BIG GOAL

**After Milestone 5, PackageBuilder executes in workflow-builder UI!**

This is the SECOND MOST CRITICAL milestone (after M3 AI self-healing). It delivers:
- Full PackageBuilder workflow visualized and executing in workflow-builder
- Dependency graph visualization (20+ packages, 50+ dependencies)
- Dynamic concurrency with Promise.race (most complex pattern)
- Child workflow spawning with startChild API
- Real-time execution monitoring
- Validation that workflow-builder can handle production complexity

---

## Quick Start

### If you're starting Week 25:
1. Read [MILESTONE-5-TASKS.md](./MILESTONE-5-TASKS.md) - Full task breakdown (21 tasks)
2. Read [MILESTONE-5-QUICK-REFERENCE.md](./MILESTONE-5-QUICK-REFERENCE.md) - Week-by-week overview
3. Review your assigned tasks (see Role Assignments below)
4. Schedule Monday kickoff meeting (1 hour)
5. Start Monday morning!

### If you want the big picture:
1. Read [INCREMENTAL-VALUE-ROADMAP.md](./INCREMENTAL-VALUE-ROADMAP.md) - All 6 milestones
2. Read [MILESTONE-5-GANTT.md](./MILESTONE-5-GANTT.md) - Visual timeline
3. Review [Critical Path](#critical-path) below
4. Understand [Why This Matters](#why-milestone-5-matters)

---

## Document Overview

### Planning Documents (Read These)

#### 1. [MILESTONE-5-TASKS.md](./MILESTONE-5-TASKS.md) ⭐ **MOST IMPORTANT**
**What**: Detailed breakdown of all 21 tasks for Milestone 5
**Why**: This is your execution playbook - everything is here
**Who**: All engineers, QA, DevOps
**When**: Read on Day 1, reference throughout Milestone 5

**Key Sections**:
- **Phase 1: Foundation (Week 25)** - 6 tasks, parallel work
  - Dependency graph engine (algorithm complexity)
  - Child workflow infrastructure (startChild pattern)
  - Graph visualization (complex UI)
- **Phase 2: Dynamic Concurrency (Weeks 26-27)** - 5 tasks, critical path
  - Promise.race pattern 🔴 MOST COMPLEX
  - State management for dynamic orchestration
  - PackageBuilder integration begins
- **Phase 3: PackageBuilder Integration (Week 28)** - 5 tasks, critical validation
  - Import actual PackageBuilder workflow
  - Real-time monitoring API
  - Comprehensive integration testing
- **Phase 4: Performance & Polish (Week 29)** - 4 tasks, production readiness
  - Algorithm optimization (100+ packages)
  - UI optimization (smooth real-time updates)
  - Production monitoring
- **Phase 5: Demo Preparation (Week 30)** - 4 tasks, celebration
  - Demo workflow creation
  - Documentation completion
  - Final demo and celebration 🎉

**Each task includes**:
- Task ID (M5-T001, M5-T002, etc.)
- Owner and dependencies
- Hour estimate (sized appropriately)
- Detailed acceptance criteria
- Testing requirements (unit, integration, E2E)
- Completion requirements (definition of done)
- Deliverables (exact file paths)

---

#### 2. [MILESTONE-5-QUICK-REFERENCE.md](./MILESTONE-5-QUICK-REFERENCE.md) ⭐ **DAILY USE**
**What**: Quick reference guide - TL;DR version of task breakdown
**Why**: Fast lookup for weekly goals, critical path, success metrics
**Who**: All team members, especially during standups
**When**: Keep open during daily standups and planning

**Key Sections**:
- Critical Path (112 hours, 3 weeks of work)
- Week-by-Week Milestones (what success looks like each week)
- 10-Point Demo Checklist (must-have for final demo)
- Task Ownership Quick Reference (who does what when)
- Risk Management (high-risk items with mitigation)
- Success Metrics (quantitative and qualitative)
- Daily Standup Format
- Decision Gates (Go/No-Go checkpoints)

---

#### 3. [MILESTONE-5-GANTT.md](./MILESTONE-5-GANTT.md)
**What**: Visual timeline, Gantt chart, dependency graph
**Why**: See the schedule visually, understand parallelization
**Who**: Team leads, project managers, visual learners
**When**: Use for weekly planning and schedule reviews

**Key Sections**:
- Gantt Chart (week view with all tasks)
- Dependency Graph (visual task dependencies)
- Critical Path Analysis (longest sequence)
- Task Scheduling by Engineer (individual workload)
- Resource Leveling (team capacity utilization)
- Timeline Visualization (calendar view)
- Decision Gates (Go/No-Go checkpoints)
- Performance Targets

---

## Why Milestone 5 Matters

### The PackageBuilder Problem

**Before workflow-builder**:
```typescript
// PackageBuilder is complex TypeScript code (223 lines)
// - Dependency graph resolution
// - Dynamic concurrency with Promise.race
// - Child workflow spawning
// - State management across continues
// - Complex error handling

// To modify:
// 1. Edit TypeScript code
// 2. Understand Temporal APIs (startChild, Promise.race)
// 3. Test locally with Temporal Server
// 4. Debug with Temporal UI (not workflow-specific)
// 5. Deploy and hope it works

// Problems:
// - High barrier to entry (Temporal expertise required)
// - Hard to visualize (what's happening when?)
// - Difficult to debug (why did package X wait for Y?)
// - Can't monitor easily (how many concurrent builds?)
```

**After Milestone 5 (workflow-builder)**:
```typescript
// PackageBuilder is visual workflow
// - Drag dependency graph node to canvas
// - Configure concurrency (slider: 1-10)
// - See dependency visualization (20 packages, 50 edges)
// - Run and monitor in real-time
// - See exactly which packages are building
// - See dependency chains clearly
// - Modify without code (change concurrency, adjust dependencies)

// Benefits:
// - No Temporal expertise needed (visual interface)
// - Easy to understand (see the graph)
// - Simple to debug (visualize execution)
// - Real-time monitoring (watch it happen)
// - Iterate quickly (change config, re-run)
```

### What Makes This Milestone Complex

**Milestone 5 is the 2nd most complex milestone** (after M3 AI self-healing):

1. **Dependency Graph Algorithms**:
   - Topological sort (identify build order)
   - Cycle detection (prevent infinite loops)
   - Dynamic ready-node calculation (which packages can build now?)
   - Graph complexity: 20+ nodes, 50+ edges

2. **Promise.race Concurrency** (Most Complex Pattern):
   - Maintain exactly N concurrent child workflows
   - Dynamically fill slots as children complete
   - Track active builds in state
   - Handle child failures gracefully
   - No deadlocks, no race conditions
   - More complex than Promise.all batching (M4)

3. **Child Workflow Spawning**:
   - Use startChild (non-blocking) vs executeChild (blocking)
   - Track child workflow handles
   - Query child status
   - Handle child completion
   - Manage child lifecycle

4. **Real-time Monitoring**:
   - Update graph in real-time (2-second refresh)
   - Show concurrency level dynamically
   - Handle 50+ packages without performance issues
   - Efficient polling (minimize network traffic)

5. **Integration Complexity**:
   - Convert actual PackageBuilder workflow (223 lines)
   - Preserve all behavior (dependency resolution, concurrency, reporting)
   - Match performance (within 10% of original)
   - Generate equivalent TypeScript code

---

## Critical Path

### The Longest Sequence (112 hours = 3 weeks)

```
Week 25: Foundation
M5-T001: Dependency Graph Engine (16h)
  ↓
M5-T002: Dependency Graph Compiler (12h)
  ↓
Week 26: Dynamic Concurrency 🔴
M5-T030: Promise.race Pattern (20h) ← MOST COMPLEX
  ↓
Week 27-28: Integration 🔴
M5-T050: Import PackageBuilder (24h) ← ACTUAL INTEGRATION
  ↓
Week 28-29: Validation 🔴
M5-T080: PackageBuilder Tests (20h) ← CRITICAL VALIDATION
  ↓
Week 30: Demo
M5-T090: Demo Workflow (12h)
  ↓
M5-T093: Final Demo (8h)

Total: 112 hours
```

**Critical Path Owner**: Backend Engineer 1
**Actual Calendar Time**: 5 weeks (Weeks 25-29)
**Buffer**: Week 30 (demo prep)

**Key Bottlenecks**:
- **Week 26**: Promise.race pattern (most complex, 20h)
- **Week 28**: PackageBuilder integration (validation, 24h)

---

## Team Roles & Responsibilities

### Backend Engineer 1: Critical Path Owner 🔴
**Focus**: Dependency graph, Promise.race, PackageBuilder integration

**Week 25**: Dependency graph engine + compiler (28h)
**Week 26**: Promise.race pattern 🔴 CRITICAL (28h)
**Week 27-28**: PackageBuilder import 🔴 CRITICAL (24h)
**Week 29**: Algorithm optimization (16h)
**Week 30**: Developer docs, demo support (14h)

**Total**: ~140 hours over 6 weeks

**Critical Weeks**: 26 (Promise.race), 28 (PackageBuilder)

---

### Backend Engineer 2: Real-time & State Management
**Focus**: Child workflows, state management, real-time monitoring

**Week 25**: startChild pattern + registry (22h)
**Week 26**: Dynamic loop node + state management (20h)
**Week 27-28**: Real-time API + seed script (24h)
**Week 29**: User documentation (16h)
**Week 30**: User docs completion (12h)

**Total**: ~120 hours over 6 weeks

**Role**: Support BE1 on critical path, own monitoring

---

### Frontend Engineer 1: Visualization & Monitoring
**Focus**: Dependency graph UI, real-time execution view

**Week 25**: Graph visualization + status panel (32h)
**Week 26**: Integration with backend (24h)
**Week 27-28**: Monitoring page (24h)
**Week 29**: UI optimization (20h)
**Week 30**: Demo support (4h)

**Total**: ~120 hours over 6 weeks

**Focus**: Complex UI work (graph visualization hardest)

---

### DevOps Engineer (0.5 FTE): Infrastructure & Monitoring
**Focus**: Performance infrastructure, production monitoring

**Week 25**: Environment prep (12h)
**Week 26-28**: Performance infrastructure (12h)
**Week 29**: Production monitoring (12h)
**Week 30**: Demo environment (4h)

**Total**: ~44 hours over 6 weeks (0.5 FTE)

**Capacity**: Has bandwidth to support other milestones

---

### QA Engineer (0.5 FTE): Integration Testing
**Focus**: PackageBuilder validation, performance testing

**Week 25-27**: Test planning, fixtures (16h)
**Week 28**: PackageBuilder tests 🔴 CRITICAL (20h)
**Week 29**: Performance validation (16h)
**Week 30**: Demo workflow creation (10h)

**Total**: ~70 hours over 6 weeks (0.5 FTE)

**Critical Week**: Week 28 (validate PackageBuilder)

---

## How to Use These Documents

### Week 25 (Before Starting)
1. **Leadership reads**: INCREMENTAL-VALUE-ROADMAP.md (M5 section)
2. **Team lead reads**: All documents (full understanding)
3. **Team members read**: MILESTONE-5-TASKS.md + their assigned tasks
4. **Schedule**: Monday Week 25 kickoff meeting (1 hour)

### Week 25 (Foundation)
1. **Monday AM**: Kickoff meeting (1 hour)
2. **Daily**: Follow task assignments
3. **Daily 9am**: Standup (15 min) using QUICK-REFERENCE
4. **Friday 2pm**: Weekly demo (30 min)
5. **Friday 3pm**: Retrospective (1 hour)

**Demo Focus**: Show foundation working (graph engine, startChild, graph UI)

### Week 26 (Dynamic Concurrency) 🔴 CRITICAL
1. **Daily**: Focus on Promise.race pattern (BE1)
2. **Mid-week**: Pair programming session (BE1 + BE2)
3. **Friday**: Demo Promise.race working (execute 10 packages, concurrency=3)
4. **Friday**: Decision gate (Go/No-Go for PackageBuilder integration)

**This is the hardest week** - Promise.race is most complex pattern

### Week 27-28 (Integration) 🔴 CRITICAL
1. **Week 27**: Start PackageBuilder conversion (incremental)
2. **Week 28 Thursday**: Checkpoint meeting (Go/No-Go for demo)
3. **Week 28 Friday**: Demo PackageBuilder execution (THE BIG DEMO)

**This is the validation week** - Does PackageBuilder work?

### Week 29 (Performance & Polish)
1. **Daily**: Optimize algorithms and UI
2. **Mid-week**: Performance testing
3. **Friday**: Demo optimized performance (50-package stress test)
4. **Friday**: Decision gate (Ready for Week 30 demo?)

### Week 30 (Demo & Celebration) 🎉
1. **Monday-Wednesday**: Documentation, demo prep
2. **Thursday**: Final rehearsal (full run-through)
3. **Friday 2pm**: STAKEHOLDER DEMO (15 min)
4. **Friday 3pm**: Q&A with stakeholders (15 min)
5. **Friday 4pm**: Team celebration! 🎉

---

## Critical Success Factors

### 1. Nail the Promise.race Pattern (Week 26)
**Why Critical**: This is the heart of dynamic orchestration. If this doesn't work, PackageBuilder won't work.

**Success Criteria**:
- Maintains exactly N concurrent child workflows (±0 variance)
- Dynamically fills slots as children complete (no idle time)
- No race conditions or deadlocks
- State persists correctly (handles workflow continues)

**Mitigation**:
- Extensive unit tests before integration
- Pair programming (BE1 + BE2)
- Study Temporal examples
- Fallback: Use M4 batching for demo if race conditions found

---

### 2. Complete PackageBuilder Integration (Week 28)
**Why Critical**: This validates the entire milestone. If PackageBuilder works, we're done.

**Success Criteria**:
- PackageBuilder workflow imported (all phases)
- Executes with 20 packages successfully
- Respects dependencies (layer 0 → layer 1 → ...)
- Maintains concurrency (exactly 4 concurrent)
- Generates correct build report

**Mitigation**:
- Incremental conversion (start with 5 packages, grow to 20)
- Test each phase independently
- Compare generated code to original (diff check)
- Fallback: Simplified demo (10 packages) if edge cases found

---

### 3. Optimize for Real-time Monitoring (Week 29)
**Why Critical**: Users need to see what's happening. Laggy UI = bad demo.

**Success Criteria**:
- Graph renders 50 packages in <2 seconds
- Updates in <100ms on state change
- Polling doesn't bog down network (<5% CPU)
- No memory leaks during 30-minute execution

**Mitigation**:
- Web Workers for graph layout (don't block main thread)
- Incremental updates (only changed nodes)
- Virtual scrolling for large lists
- Fallback: Lower refresh rate (2s → 5s)

---

### 4. Test Comprehensively (Week 28-29)
**Why Critical**: PackageBuilder is production code. Bugs = bad demo.

**Test Coverage**:
- Unit tests: Graph algorithms, Promise.race pattern
- Integration tests: Actual PackageBuilder execution
- E2E tests: UI + backend full flow
- Performance tests: 50-package stress test

**No Shortcuts**: All tests must pass before demo.

---

## Milestone 5 Success = 10 Demo Points

By end of Week 30, you must successfully demonstrate:

1. ✅ **Load PackageBuilder workflow in UI**
2. ✅ **Show dependency graph** (20 packages, multiple layers, clear visualization)
3. ✅ **Configure concurrency** (set to 4, show slider)
4. ✅ **Run workflow, watch in real-time** (click "Run", see execution start)
5. ✅ **Show packages building in parallel** (exactly 4 at a time, no more, no less)
6. ✅ **Show dependency handling** (package waits for dependency to complete)
7. ✅ **Show package completion** (dependency unblocks dependents)
8. ✅ **Show failure handling** (1 package fails, dependents blocked gracefully)
9. ✅ **Show build report generated** (matches original format)
10. ✅ **Show execution completed in optimal time** (within 10% of original)

**If all 10 succeed**: Milestone 5 COMPLETE! PackageBuilder DONE! 🎉

**If 8-9 succeed**: Close enough, minor issues acceptable

**If <8 succeed**: Delay demo, use backup recording, address critical issues

---

## Decision Points

### End of Week 25: Foundation Check
**Question**: Is foundation solid?
**Checklist**:
- [ ] Dependency graph engine works
- [ ] startChild pattern compiles
- [ ] Graph visualization renders complex graphs
- [ ] All foundation tests passing

**Decision**: Go/No-Go for Week 26 Promise.race

---

### End of Week 26: Pattern Check 🔴 CRITICAL
**Question**: Does Promise.race work correctly?
**Checklist**:
- [ ] Promise.race pattern compiles
- [ ] Maintains exactly N concurrency
- [ ] Dynamic slot management works
- [ ] Integration tests passing
- [ ] No race conditions

**Decision**:
- **GREEN**: Continue to PackageBuilder integration
- **YELLOW**: Extend testing, delay integration
- **RED**: Fallback to M4 batching for demo

**This is the most critical gate** - determines M5 success

---

### End of Week 28: Integration Check 🔴 CRITICAL
**Question**: Does PackageBuilder execute successfully?
**Checklist**:
- [ ] PackageBuilder imported and compiles
- [ ] Executes with 20 packages
- [ ] Dependency resolution works
- [ ] Concurrency works (exactly 4)
- [ ] Real-time monitoring accurate
- [ ] Build report correct
- [ ] No critical bugs

**Decision**:
- **GREEN**: Continue to optimization (Week 29)
- **YELLOW**: Use Week 29 for fixes, delay demo
- **RED**: Delay demo 1 week, focus on issues

**This validates the entire milestone**

---

### End of Week 29: Demo Readiness
**Question**: Are we ready to demo?
**Checklist**:
- [ ] All 10 demo points working
- [ ] Performance acceptable
- [ ] No critical bugs
- [ ] Documentation complete
- [ ] Demo rehearsed
- [ ] Stakeholders invited

**Decision**: Go/No-Go for Week 30 demo

---

## Risk Mitigation

### High-Risk Items

1. **Promise.race Complexity** (Week 26) 🔴
   - **Risk**: Most complex pattern, may have edge cases
   - **Mitigation**: Pair programming, extensive tests, Temporal examples
   - **Fallback**: Use M4 batching for demo

2. **PackageBuilder Edge Cases** (Week 28) 🔴
   - **Risk**: Real workflow may have unexpected complexity
   - **Mitigation**: Incremental conversion, early testing, comparison to original
   - **Fallback**: Simplified demo (10 packages)

3. **Real-time UI Performance** (Week 29)
   - **Risk**: Large graphs may slow down UI
   - **Mitigation**: Web Workers, optimization, virtual scrolling
   - **Fallback**: Lower refresh rate, limit demo size

4. **Dependency Graph Cycles**
   - **Risk**: Invalid graphs may crash workflow
   - **Mitigation**: Cycle detection, validation before deployment
   - **Fallback**: Manual validation step

### Team Capacity Risks

- **BE1 Overload**: Weeks 26-28 are heavy (critical path + PackageBuilder)
  - **Mitigation**: BE2 can assist, daily check-ins
  - **Watch**: BE1 working >10h/day consistently
- **Week 28 Crunch**: Integration week heavy for all
  - **Mitigation**: Week 29 is lighter (buffer)

---

## Success Metrics

### Quantitative

| Metric | Target | How We Measure |
|--------|--------|----------------|
| PackageBuilder execution | 20+ packages | Count in demo |
| Dependency graph size | 20+ nodes, 50+ edges | Graph complexity |
| Concurrency maintained | Exactly 4 (±0) | Execution metrics |
| Completion time | Within 10% of original | Performance comparison |
| Real-time update latency | <2 seconds | Monitoring lag time |
| Graph render time | <2 seconds (50 nodes) | UI performance test |
| Test coverage | >80% | Code coverage report |
| Critical bugs | 0 P0 | Bug tracker |

### Qualitative

- [ ] **Complete**: PackageBuilder executes successfully
- [ ] **Performant**: Execution time within 10% of original
- [ ] **Understandable**: Dependency graph is intuitive
- [ ] **Monitored**: Real-time view shows accurate status
- [ ] **Documented**: Users can build similar workflows

---

## Resources

### Internal Documentation
- [INCREMENTAL-VALUE-ROADMAP.md](./INCREMENTAL-VALUE-ROADMAP.md) - All 6 milestones
- [ARCHITECTURE-REVISED.md](./ARCHITECTURE-REVISED.md) - System architecture
- [PATTERN-LIBRARY-IMPLEMENTATION.md](./PATTERN-LIBRARY-IMPLEMENTATION.md) - Temporal patterns

### External Resources
- [Temporal Documentation](https://docs.temporal.io/) - Official docs
- [Temporal TypeScript SDK](https://typescript.temporal.io/) - SDK reference
- [Temporal Examples](https://github.com/temporalio/samples-typescript) - Sample code
- [Promise.race MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/race) - JS reference
- [Topological Sort](https://en.wikipedia.org/wiki/Topological_sorting) - Algorithm reference

### Communication
- **Slack**: `#milestone-5-dynamic-orchestration`
- **Task Board**: GitHub Projects
- **Code**: `feature/milestone-5-dynamic-orchestration` branch

---

## FAQ

**Q: Why is M5 more complex than M4?**
A: M4 uses Promise.all batching (simple: process batch, wait for all, repeat). M5 uses Promise.race (complex: maintain exactly N concurrent, dynamically fill slots, handle completions asynchronously).

**Q: What if Promise.race is too hard?**
A: We have a fallback: use M4 batching pattern for demo. Not ideal (not as efficient), but functional. Week 26 decision gate will determine.

**Q: Can we simplify PackageBuilder for demo?**
A: Yes. If integration is too complex, we can demo with 10 packages instead of 20, or skip the failure scenario. But we should aim for full integration.

**Q: What if real-time UI is too slow?**
A: Multiple levers: lower refresh rate (2s → 5s), limit graph size (20 packages max), use Web Workers, optimize rendering. Week 29 optimization will address.

**Q: Can we finish early?**
A: Unlikely - this is 2nd most complex milestone. But if we do, use buffer for polish, testing, documentation, or start M6 early.

**Q: What if we need to delay the demo?**
A: Week 30 is intentional buffer. Can delay 1 week if critical issues found. Stakeholders will understand if we're close. Better to delay than demo broken system.

---

## Next Steps

1. **Read** [MILESTONE-5-TASKS.md](./MILESTONE-5-TASKS.md) - Full task breakdown
2. **Review** your assigned tasks (see Role Assignments above)
3. **Schedule** Monday Week 25 kickoff meeting (1 hour)
4. **Set up** feature branch: `feature/milestone-5-dynamic-orchestration`
5. **Prepare** development environment (Temporal Server, database, etc.)
6. **Review** PackageBuilder source code (`packages/agents/package-builder-production/`)
7. **See you Monday!** 🚀

---

**Ready to start?**
- [ ] Read MILESTONE-5-TASKS.md
- [ ] Review assigned tasks
- [ ] Schedule Monday kickoff
- [ ] Set up feature branch
- [ ] Review PackageBuilder source code
- [ ] See you Monday! 👍

**Questions?** Ask in `#milestone-5-dynamic-orchestration`

---

**THIS IS IT!** 🎯

After Milestone 5:
- ✅ PackageBuilder executes in workflow-builder
- ✅ Dependency-aware orchestration works
- ✅ Dynamic concurrency patterns implemented
- ✅ Real-time monitoring shows exactly what's happening
- ✅ **PACKAGEBUILDER MIGRATION COMPLETE!** 🎉

Then Milestone 6 is just polish (signals, debugging, templates, GA prep).

**Let's complete this!** 💪
