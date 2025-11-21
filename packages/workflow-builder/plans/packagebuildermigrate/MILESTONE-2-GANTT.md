# Milestone 2: Gantt Chart & Dependency Visualization

**Duration**: 6 weeks (30 working days)
**Team**: 5 people (2 BE, 1 FE, 0.5 DevOps, 0.5 QA = 200 hours/week capacity)

---

## Gantt Chart (Week View)

```
Week →     7              8              9              10             11             12
         M T W T F    M T W T F    M T W T F    M T W T F    M T W T F    M T W T F

CRITICAL PATH:
T001 ████
T010     █████████
T020 ████████████████
T021                 ████████████████
T040 ████████████████████████
T050                             ████████████████
T080                                                     ████████████

BACKEND:
T002   ████
T011         ████████████
T012     ██████
T022 ████████████
T060                     ████████████████
T061                                 ████████████████████████
T062                                 ████████████
T070                                                 ██████████
T081                                                         ████████████
T084                                                         ██████
T090                                                                     ██████████
T092                                                                     ██████████

FRONTEND:
T040 ████████████████████████
T041                 ██████████
T042 ████████████████
T050                     ████████████████
T051                     ██████████
T071                                 ██████████████████
T083                                                     ██████████████████
T091                                                                 ██████████████

DEVOPS:
T030 ██████
T031 ████
T093                                                                         ████████

QA:
T080                                                     ████████████
T082                                                         ████████
T090                                                                     ████████
T093                                                                         ████████

BUFFER:
T100                                                                                 ████████████████████
T101                                                                                             ████████
```

---

## Dependency Graph (Detailed)

### Week 7: Foundation Layer (Parallel Execution)

```
┌─────────────────────────────────────────────────────────┐
│                    WEEK 7: FOUNDATION                    │
│          Building on M1, Extending for M2                │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┬─────────────┐
        │                 │                 │             │
   ┌────▼────┐       ┌────▼────┐      ┌────▼────┐   ┌────▼────┐
   │ T001    │       │ T020    │      │ T030    │   │ T040    │
   │Database │       │Condition│      │Monitoring│   │Conditional│
   │Schema   │       │Pattern  │      │Enhance  │   │Node UI  │
   │4h (BE2) │       │12h(BE1) │      │6h(DevOps│   │16h(FE1) │
   └────┬────┘       └────┬────┘      └────┬────┘   └────┬────┘
        │                 │                 │             │
        │                 │            ┌────▼────┐   ┌────▼────┐
   ┌────▼────┐       ┌────▼────┐      │ T031    │   │ T041    │
   │ T002    │       │ T022    │      │Staging  │   │Branch   │
   │Variables│       │Retry    │      │Deploy   │   │Edges    │
   │Table    │       │Pattern  │      │4h(DevOps│   │10h(FE1) │
   │3h (BE2) │       │10h(BE1) │      └─────────┘   └─────────┘
   └────┬────┘       └─────────┘
        │                 │            ┌─────────┐
   ┌────▼────┐            │            │ T042    │
   │ T010    │            │            │Variables│
   │tRPC     │            │            │Panel    │
   │Enhance  │            │            │12h(FE1) │
   │6h (BE2) │            │            └─────────┘
   └────┬────┘            │
        │                 │
   ┌────▼────┐            │
   │ T011    │            │
   │Variables│            │
   │API      │            │
   │8h (BE2) │            │
   └────┬────┘            │
        │                 │
   ┌────▼────┐            │
   │ T012    │            │
   │Exec     │◄───────────┘
   │Tracking │
   │6h (BE2) │
   └─────────┘
```

### Week 8: Backend Integration (Critical Path Continues)

```
┌─────────────────────────────────────────────────────────┐
│         WEEK 8: BACKEND INTEGRATION (CRITICAL)           │
│       T021 and T061 are Critical Path Components        │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
   ┌────▼──────┐     ┌────▼──────┐    ┌────▼────┐
   │ T021      │     │ T060      │    │ T050    │
   │Variable   │     │State      │    │Property │
   │Mgmt       │     │Management │    │Panel    │
   │12h (BE1)  │     │12h (BE2)  │    │Condition│
   │CRITICAL   │     └────┬──────┘    │12h(FE1) │
   └────┬──────┘          │           └─────────┘
        │                 │
        │                 │
   ┌────▼──────┐     ┌────▼──────┐    ┌─────────┐
   │ T061      │     │ T062      │    │ T051    │
   │Conditional│     │Retry      │    │Retry UI │
   │Engine     │     │Executor   │    │Config   │
   │16h (BE1)  │     │10h (BE2)  │    │10h(FE1) │
   │CRITICAL   │     └───────────┘    └─────────┘
   └───────────┘
```

### Week 9: Full Stack Integration

```
┌─────────────────────────────────────────────────────────┐
│      WEEK 9: FULL STACK INTEGRATION (CRITICAL END)       │
│         T070 completes critical backend path             │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
   ┌────▼──────┐     ┌────▼──────┐    ┌────▼──────┐
   │ T070      │     │ T071      │    │Integration│
   │Deploy     │     │Exec Mon   │    │Testing    │
   │Pipeline   │     │Conditional│    │(Manual)   │
   │10h (BE1)  │     │14h (FE1)  │    └───────────┘
   │CRITICAL   │     └───────────┘
   └───────────┘
```

### Week 10: Testing & Polish (Parallel)

```
┌─────────────────────────────────────────────────────────┐
│          WEEK 10: TESTING & POLISH (CRITICAL END)        │
│            T080 completes critical path                  │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┬─────────┐
        │                 │                 │         │
   ┌────▼──────┐     ┌────▼──────┐    ┌────▼────┐  ┌▼────┐
   │ T080      │     │ T081      │    │ T083    │  │T082 │
   │E2E Tests  │     │Integration│    │UI Polish│  │Perf │
   │Conditional│     │Tests      │    │Condition│  │8h   │
   │12h (QA)   │     │10h (BE1)  │    │14h(FE1) │  │(QA) │
   │CRITICAL   │     └─────┬─────┘    └─────────┘  └─────┘
   └────┬──────┘           │
        │                  │
        │             ┌────▼──────┐
        └────────────►│ T084      │
                      │Error Hand │
                      │12h (BE2+  │
                      │    FE1)   │
                      └───────────┘
```

### Week 11: Documentation & Demo Prep (Parallel)

```
┌─────────────────────────────────────────────────────────┐
│        WEEK 11: DOCUMENTATION & DEMO PREP                │
│              All tasks can run in parallel               │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┬─────────┐
        │                 │                 │         │
   ┌────▼────┐       ┌────▼────┐      ┌────▼────┐  ┌▼────┐
   │ T090    │       │ T091    │      │ T092    │  │T093 │
   │Demo     │       │User     │      │Dev      │  │Demo │
   │Examples │       │Docs     │      │Docs     │  │Scrpt│
   │10h(BE2+ │       │14h(FE1+ │      │10h(BE1+ │  │8h   │
   │   QA)   │       │   BE1)  │      │   BE2)  │  │(QA+ │
   └─────────┘       └─────────┘      └─────────┘  │Dev) │
                                                    └──┬──┘
                                                       │
                                                  ┌────▼────┐
                                                  │Demo Env │
                                                  │Ready    │
                                                  └─────────┘
```

### Week 12: Buffer & Demo (Sequential)

```
┌─────────────────────────────────────────────────────────┐
│            WEEK 12: BUFFER & FINAL DEMO                  │
│               T100 → T101 → DEMO                         │
└─────────────────────────────────────────────────────────┘
                          │
                     ┌────▼────┐
                     │ T100    │
                     │Bug Fixes│
                     │40h (All)│
                     └────┬────┘
                          │
                     ┌────▼────┐
                     │ T101    │
                     │Final    │
                     │Rehearsal│
                     │8h (All) │
                     └────┬────┘
                          │
                     ┌────▼────┐
                     │  DEMO   │
                     │Milestone│
                     │Complete │
                     └─────────┘
```

---

## Critical Path Analysis

### Definition
The **critical path** is the longest sequence of dependent tasks that determines the minimum project duration. Any delay in critical path tasks delays the entire project.

### Milestone 2 Critical Path

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ T001    │───►│ T010    │───►│ T020    │───►│ T021    │───►│ T040    │───►│ T050    │───►│ T080    │
│Database │    │tRPC     │    │Condition│    │Variable │    │Condition│    │Property │    │E2E      │
│Schema   │    │Enhance  │    │Pattern  │    │Mgmt     │    │Node UI  │    │Panel    │    │Tests    │
│4h       │    │6h       │    │12h      │    │12h      │    │16h      │    │12h      │    │12h      │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
   Week 7         Week 7         Week 7         Week 8         Week 7-8       Week 8         Week 10

Total: 4 + 6 + 12 + 12 + 16 + 12 + 12 = 74 hours
```

**Critical Path Duration**: 74 hours = 2 weeks of focused work (1 person)

**Actual Calendar Time**: 4 weeks (spread across Weeks 7-10 due to dependencies and parallelization)

**Slack Time**: Weeks 11-12 (2 weeks of buffer for delays, polish, demo prep)

---

## Task Scheduling by Engineer

### Backend Engineer 1 (Critical Path Owner) 🔴

```
Week 7  ████████████████ T020: Conditional Pattern (12h)
        ████████████ T022: Retry Pattern (10h)
        │
Week 8  ████████████ T021: Variable Management (12h)
        │            🔴 CRITICAL
        ████████████████████████ T061: Conditional Engine (16h)
        │                         🔴 CRITICAL - Full focus required
Week 9  ██████████ T070: Deployment Pipeline (10h)
        │          🔴 CRITICAL COMPLETION
        ████████ Support frontend integration (8h)
        │
Week 10 ██████████ T081: Integration Tests (10h)
        ██████ T084: Error Handling (6h)
        │
Week 11 ██████████ T092: Developer Docs (10h)
        ████ T091: User Docs (4h)
        ████ Support team (4h)
        │
Week 12 ████ T100: Bug fixes (8h)
        ████ T101: Demo prep (8h)
```

**Total**: ~150 hours over 6 weeks (37.5h/week average)
**Risk**: Week 8 is heavy (28h critical path work). Monitor closely.

---

### Backend Engineer 2

```
Week 7  ████ T001: Database Schema (4h)
        ███ T002: Variables Table (3h)
        ██████ T010: tRPC Enhance (6h)
        ████████ T011: Variables API (8h)
        ██████ T012: Execution Tracking (6h)
        ███ Support/review (5h)
        │
Week 8  ████████████ T060: State Management (12h)
        ██████████ T062: Retry Executor (10h)
        ████ Support BE1 (6h)
        │
Week 9  ████████ Support frontend integration (8h)
        ████████ Bug fixes (8h)
        │
Week 10 ██████ T084: Error Handling (6h)
        ██████████ Bug fixes (10h)
        │
Week 11 ██████████ T090: Demo Examples (10h)
        ████████ Bug fixes (8h)
        │
Week 12 ████ T100: Bug fixes (8h)
        ████ T101: Demo prep (8h)
```

**Total**: ~145 hours over 6 weeks
**Risk**: Week 7 is packed (32h) but manageable.

---

### Frontend Engineer 1

```
Week 7  ████████████████████████ T040: Conditional Node (16h)
        ██████████ T041: Branch Edges (10h)
        ████████████ T042: Variables Panel (12h)
        │
Week 8  ████████████ T050: PropertyPanel Conditionals (12h)
        ██████████ T051: Retry Config UI (10h)
        ████████ Polish from Week 7 (8h)
        │
Week 9  ██████████████ T071: Execution Monitoring (14h)
        ████████ Integration testing (8h)
        │
Week 10 ██████████████ T083: UI Polish (14h)
        ██████ T084: Error Handling (6h)
        │
Week 11 ██████████ T091: User Docs (10h)
        ██████ Demo video (6h)
        ████████ Bug fixes (8h)
        │
Week 12 ████ T100: Bug fixes (8h)
        ████ T101: Demo prep (8h)
```

**Total**: ~165 hours over 6 weeks
**Risk**: Week 7 is very heavy (38h). May need to split T042 or extend to Week 8.

---

### DevOps Engineer (0.5 FTE)

```
Week 7  ██████ T030: Monitoring Enhance (6h)
        ████ T031: Staging Deploy (4h)
        ████ Support team (4h)
        │
Week 8  ████████ Support backend integration (8h)
        ████ Monitoring improvements (4h)
        │
Week 9  ██████ Deploy to staging (6h)
        ██████ Monitoring dashboards (6h)
        │
Week 10 ████████ Performance tuning (8h)
        ██████ Demo environment prep (6h)
        │
Week 11 ████████ T093: Demo Environment (8h)
        ████ Final infrastructure checks (4h)
        │
Week 12 ████ T100: Infrastructure fixes (4h)
        ████ T101: Demo prep (4h)
```

**Total**: ~86 hours over 6 weeks (14.3h/week = 0.36 FTE)
**Risk**: Low. Has capacity to help other teams.

---

### QA Engineer (0.5 FTE)

```
Week 7  ████████ Test planning for M2 (8h)
        ████████ Manual testing (8h)
        │
Week 8  ████████████ Test case creation (12h)
        ████████ Manual testing (8h)
        │
Week 9  ████████████ Integration testing (12h)
        ████████ Manual testing (8h)
        │
Week 10 ████████████ T080: E2E Test Suite (12h)
        ████████ T082: Performance Tests (8h)
        ████████ Manual testing/bug reporting (8h)
        │
Week 11 ████ T090: Demo Examples (4h)
        ████████ T093: Demo Script (8h)
        ████████████ Final testing (12h)
        │
Week 12 ████ T100: Verify bug fixes (4h)
        ████ T101: Demo prep (4h)
```

**Total**: ~120 hours over 6 weeks (20h/week = 0.5 FTE)
**Risk**: Week 10 is critical for test automation (28h). Start planning in Week 8.

---

## Resource Leveling

### Team Capacity by Week

```
Week     BE1  BE2  FE1  DevOps  QA   Total  Target
------------------------------------------------------
Week 7   40h  40h  40h   14h   16h   150h   200h ✓
Week 8   38h  32h  30h   12h   20h   132h   200h ✓ (slack)
Week 9   28h  24h  22h   12h   20h   106h   200h ✓ (slack)
Week 10  26h  26h  20h   14h   28h   114h   200h ✓ (slack)
Week 11  28h  26h  24h   12h   24h   114h   200h ✓ (slack)
Week 12  16h  16h  16h    8h    8h    64h   200h ✓ (buffer)
------------------------------------------------------
Total   176h 164h 152h   72h  116h   680h  1200h

Utilization: 56.7% (allows for significant flex and buffer)
```

**Analysis**:
- Week 7 is at capacity (75%) - foundation work
- Weeks 8-11 have slack (53-66%) - allows for unexpected issues
- Week 12 is intentional buffer (32%) - demo prep and fixes
- Overall 56.7% utilization is healthy given reduced team size (0.5 FTE DevOps/QA)
- Effective team size: ~3.4 FTE (2 BE + 1 FE + 0.5 DevOps + 0.5 QA = 140 hours/week)

### Load Balancing Recommendations

1. **Week 7 FE1 Overload** (38h planned)
   - **Mitigation**: Start T042 (Variables Panel) in Week 8 if behind
   - **Monitor**: Daily check-ins on T040 (Conditional Node) progress
   - **Alternative**: Simplify T041 (Branch Edges) by limiting edge styling

2. **Week 8 BE1 Heavy** (28h critical path work)
   - **Mitigation**: BE2 can assist with T061 if BE1 falls behind
   - **Monitor**: Daily standups on T021 and T061 progress
   - **Alternative**: Simplify expression language (basic comparisons only)

3. **Week 10 QA Heavy** (28h test automation)
   - **Mitigation**: Start test planning in Week 8-9
   - **Alternative**: FE1 can write some E2E tests to share load

4. **Reduced Team Size**
   - **Impact**: Only 3.4 effective FTE vs. M1's 5.5 FTE
   - **Mitigation**: Leverage M1 foundation, reuse components, focus on core features
   - **Risk**: Less buffer for unexpected issues. Week 12 is critical safety net.

---

## Parallelization Matrix

### What Can Run in Parallel?

| Week | Parallel Streams | Dependencies |
|------|-----------------|--------------|
| 7 | 5 streams (DB, Conditional Pattern, Retry, Conditional Node, Variables Panel) | M1 complete |
| 8 | 3 streams (Variable Mgmt + Engine, State Mgmt + Retry, Frontend Config) | Week 7 completion |
| 9 | 2 streams (Deployment Pipeline, Execution Monitoring) | Week 8 completion |
| 10 | 4 streams (E2E Tests, Integration Tests, UI Polish, Error Handling) | Week 9 completion |
| 11 | 4 streams (Demo Examples, User Docs, Dev Docs, Demo Script) | Week 10 completion |
| 12 | 1 stream (Bug fixes → Final rehearsal → Demo) | Sequential |

### Maximum Parallelization Points

**Week 7** is the most parallelizable:
- 5 independent work streams
- Minimal dependencies between teams
- Each team can work at near full speed

**Week 12** is the least parallelizable:
- Sequential tasks (fix bugs → rehearse → demo)
- Requires team coordination
- Intentional slowdown for quality

### Efficiency Comparison with M1

| Metric | M1 | M2 | Change |
|--------|----|----|--------|
| Team Size | 6 people | 5 people (3.4 FTE) | -38% capacity |
| Total Tasks | 32 tasks | 31 tasks | -3% |
| Critical Path | 78 hours | 74 hours | -5% |
| Utilization | 72.5% | 56.7% | -22% |
| Parallel Streams (Peak) | 5 | 5 | Same |

**Insight**: M2 has similar complexity to M1 but with reduced team size. Lower utilization (56.7%) compensates for reduced capacity, maintaining feasibility.

---

## Timeline Visualization (Calendar View)

```
                MILESTONE 2: DECISION TREES
        ┌───────────────────────────────────────────┐
        │        6 WEEKS TO STAKEHOLDER DEMO         │
        │     (Building on M1 Foundation)            │
        └───────────────────────────────────────────┘

Week 7: FOUNDATION
Mon    Tue    Wed    Thu    Fri
[ALL]  [ALL]  [ALL]  [ALL]  [DEMO7]
Sprint planning  →  Independent work  →  Weekly demo

Week 8: BACKEND INTEGRATION
Mon    Tue    Wed    Thu    Fri
[BE]   [BE]   [BE]   [BE]   [DEMO8]
Critical path focus  →  Conditional engine  →  Weekly demo

Week 9: FULL STACK
Mon    Tue    Wed    Thu    Fri
[ALL]  [ALL]  [ALL]  [CHCK] [DEMO9]
Integration week  →  Checkpoint meeting  →  Demo & decision

Week 10: TESTING
Mon    Tue    Wed    Thu    Fri
[QA]   [QA]   [ALL]  [ALL]  [DEMO10]
Test automation  →  Polish & fixes  →  Weekly demo

Week 11: DEMO PREP
Mon    Tue    Wed    Thu    Fri
[DOC]  [DOC]  [TEST] [TEST] [RHRSL]
Documentation  →  Demo examples  →  Rehearsal

Week 12: BUFFER & DEMO
Mon    Tue    Wed    Thu    Fri
[FIX]  [FIX]  [PREP] [PREP] [🎯DEMO]
Bug fixes  →  Final prep  →  STAKEHOLDER DEMO

Legend:
[ALL]   = All hands, parallel work
[BE]    = Backend focus (critical path)
[QA]    = QA/testing focus
[DOC]   = Documentation focus
[FIX]   = Bug fixing
[PREP]  = Demo preparation
[DEMO#] = Weekly team demo
[CHCK]  = Checkpoint decision meeting
[RHRSL] = Demo rehearsal
[🎯DEMO]= Stakeholder demo (Milestone complete!)
```

---

## Decision Gates

### Gate 1: End of Week 7
**Date**: Friday, Week 7
**Question**: Is foundation solid for conditionals?

**Checklist**:
- [ ] Database schemas deployed (conditionals + variables)
- [ ] Conditional pattern compiler works (CLI test)
- [ ] Conditional node renders on canvas
- [ ] Variables panel functional
- [ ] Branch edges display correctly
- [ ] No critical blockers

**Decision**: Go/No-Go for Week 8 backend integration

---

### Gate 2: End of Week 9 (CRITICAL)
**Date**: Friday, Week 9
**Question**: Can we demo in 3 weeks?

**Checklist**:
- [ ] Can create conditional workflow in UI
- [ ] Can deploy conditional workflow
- [ ] Can execute conditional workflow (branches work)
- [ ] Can view execution with branch path highlighted
- [ ] Variables work (declare, reference, update)
- [ ] No critical technical blockers
- [ ] Team confidence level: High

**Decision**:
- **GREEN**: Continue to Week 10 testing
- **YELLOW**: Use Week 12 buffer, may delay demo 1 week
- **RED**: Delay demo 2 weeks, reassess scope

---

### Gate 3: End of Week 11
**Date**: Friday, Week 11
**Question**: Are we ready to demo?

**Checklist**:
- [ ] All 6 demo points working
- [ ] No critical bugs (P0)
- [ ] Demo rehearsed successfully
- [ ] Documentation complete
- [ ] Stakeholders invited

**Decision**:
- **GREEN**: Demo on Friday Week 12
- **YELLOW**: Use backup recording, or delay 1 week
- **RED**: Delay demo, focus on critical issues

---

## Milestone Completion Criteria

### Mandatory (Must Have)

All 6 demo points working:
1. ✅ Build approval workflow with 2 branches (if/else)
2. ✅ Set up workflow variables (name, type, default)
3. ✅ Configure retry policy (max 3, exponential backoff)
4. ✅ Run workflow, see different paths based on data
5. ✅ Show failed activity auto-retrying (3 attempts visible)
6. ✅ View execution monitoring with branch path highlighted

### Nice to Have (Can Defer)

- Extensive UI polish (M2-T083 can be partially deferred)
- Comprehensive performance testing (basic tests sufficient)
- Video walkthrough (screenshots acceptable if behind)
- Interactive tutorial (defer to M3)

### Must Not Have (Out of Scope)

- AI remediation (Milestone 3)
- Loops/iteration (Milestone 4)
- Child workflows (Milestone 5)
- Advanced conditional logic (complex expressions - keep simple)

---

## Comparison with Milestone 1

| Aspect | M1: Linear Workflows | M2: Decision Trees | Change |
|--------|---------------------|-------------------|---------|
| **Duration** | 6 weeks | 6 weeks | Same |
| **Team Size** | 6 people (5.5 FTE) | 5 people (3.4 FTE) | -38% |
| **Total Tasks** | 32 | 31 | -3% |
| **Critical Path** | 78 hours | 74 hours | -5% |
| **Utilization** | 72.5% | 56.7% | -22% |
| **New Features** | 2 node types | +1 node type, variables, retry | Incremental |
| **Complexity** | Foundation | Building on foundation | Higher |
| **Risk Level** | High (first milestone) | Medium (proven foundation) | Lower |

**Key Insights**:
- M2 builds on M1 foundation (less infrastructure work)
- Reduced team size compensated by reusing M1 components
- Lower utilization provides buffer for complexity
- Critical path is shorter despite more complex features
- Risk is lower due to proven foundation from M1

---

**Created**: 2025-01-19
**Version**: 1.0
**Next Update**: End of Week 9 (adjust based on progress)
