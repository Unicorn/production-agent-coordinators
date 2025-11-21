# Milestone 4: Quick Reference Guide

**Goal**: Ship batch processing workflows with concurrency control in 6 weeks
**Demo Date**: End of Week 24
**Team**: 5 people (2 BE, 1 FE, 0.5 DevOps, 0.5 QA)

---

## Critical Path (Must Stay On Track)

```
Week 19: Sequential Loop Foundation (18h)
  ↓
Week 20: Concurrency Control (20h) ⚠️ BOTTLENECK
  ↓
Week 21: Progress Tracking (16h)
  ↓
Week 22: Performance Testing + Optimization (36h)
```

**Total Critical Path**: 90 hours over 4 weeks
**Slack**: Weeks 23-24 are buffer and demo prep

---

## Week-by-Week Milestones

### Week 19: Sequential Loop Foundation ✓
**Goal**: Basic loop pattern works (sequential only)
- Sequential loop compiler functional
- Loop container UI on canvas
- Input source resolver working
- Performance monitoring enabled

**Demo**: Execute loop with 100 items sequentially

**Critical Path**: M4-T001 (6h) → M4-T002 (12h)

---

### Week 20: Concurrency Control ⚠️ CRITICAL WEEK
**Goal**: Parallel loop with Promise.race() works
- Concurrency control pattern compiles
- Promise.race() slot management working
- Concurrency limit respected (never exceeds max)
- Error handling strategies implemented

**Demo**: Execute 100 items with 4x concurrency (watch 4 run in parallel)

**Critical Path**: M4-T030 (20h) ⚠️ HIGHEST RISK TASK

**Warning Signs**:
- If not compiling by Wednesday → Escalate
- If estimated to take >30h → Pair programming
- If blocked → Senior engineer review

---

### Week 21: Progress Tracking & UI Integration ✓
**Goal**: Real-time progress visualization works
- Progress tracking API complete
- Progress UI shows real-time updates (polling every 1s)
- History viewer displays per-item results
- Performance test suite started

**Demo**: Execute loop, watch progress bar fill in real-time

**Critical Path**: M4-T032 (16h)

---

### Week 22: Performance Testing & Optimization ⚠️ CRITICAL WEEK
**Goal**: System handles 1000+ items efficiently
- Performance benchmarks pass (1000 items in <5min)
- Concurrency speedup validated (4x → 3x actual)
- Memory usage under 1GB
- Load testing complete (50 concurrent workflows)
- Bottlenecks identified and fixed

**Demo**: Execute 1000 items with 10x concurrency in <5 minutes

**Critical Path**: M4-T050 (16h) → M4-T051 (20h)

**Success Criteria**:
- 1000 items complete in <5 minutes ✓
- 4x concurrency achieves >3x speedup ✓
- Memory stays under 1GB ✓
- No critical performance issues ✓

---

### Week 23: Documentation & Demo Prep ✓
**Goal**: Ready to present to stakeholders
- Demo workflows created (4 examples)
- User and developer docs complete
- Demo script rehearsed (3+ times)
- Demo environment stable
- Video walkthrough recorded

**Demo**: Internal rehearsal with feedback

**No critical path** - All work in parallel

---

### Week 24: Buffer & Final Demo 🎯
**Goal**: Successful stakeholder demo
- Bug fixes from Week 23
- Final rehearsal with timing
- Stakeholder presentation (15 minutes)
- Feedback collection
- Go/No-Go decision on M5

**Demo**: 5-point demo to stakeholders

**Full week is buffer time**

---

## 5-Point Demo Checklist (Week 24)

Must successfully demonstrate:
1. ✓ Create workflow that processes 100 items
2. ✓ Set concurrency to 5 (show concurrency slider)
3. ✓ Run workflow, watch 5 items process in parallel
4. ✓ Show progress bar filling up (real-time updates)
5. ✓ Show execution completed in ~1/5th the time (vs sequential)

**Bonus** (if time allows):
6. ✓ Execute 1000 items with 10x concurrency (prove scale)

---

## Daily Focus Areas

### Week 19
- **Monday-Tuesday**: Loop schema and compiler foundation
- **Wednesday-Friday**: Sequential loop execution working

### Week 20 (CRITICAL)
- **Monday**: Design concurrency control pattern
- **Tuesday**: Implement Promise.race() core logic
- **Wednesday**: CHECK-IN DAY - Code review concurrency control
- **Thursday**: Slot management and testing
- **Friday**: MILESTONE - Parallel loop compiles and executes

### Week 21
- **Monday-Tuesday**: Progress tracking backend
- **Wednesday-Friday**: Progress UI and integration

### Week 22 (CRITICAL)
- **Monday-Tuesday**: Run performance tests, identify bottlenecks
- **Wednesday-Thursday**: Optimize performance
- **Friday**: Verify all benchmarks pass

### Week 23
- **Monday-Wednesday**: Documentation and demo examples
- **Thursday-Friday**: Demo rehearsal

### Week 24
- **Monday-Thursday**: Bug fixes and final polish
- **Friday**: DEMO DAY!

---

## Key Tasks (Ordered by Risk)

### 🔴 HIGHEST RISK
**M4-T030**: Concurrency Control (Week 20)
- **Estimated**: 20 hours
- **Realistic**: 30-40 hours
- **Owner**: Backend Engineer 1
- **Mitigation**: Pair programming, daily check-ins, senior review

### 🟡 MEDIUM RISK
**M4-T050**: Performance Testing (Week 22)
- **Estimated**: 16 hours
- **Risk**: May find critical performance issues
- **Mitigation**: Entire week allocated to optimization

**M4-T051**: Performance Optimization (Week 22)
- **Estimated**: 20 hours
- **Risk**: Unknown bottlenecks
- **Mitigation**: Profiling tools, database tuning, caching

### 🟢 LOW RISK
- M4-T002: Sequential Loop (foundation task, well-understood)
- M4-T032: Progress Tracking (standard backend pattern)
- M4-T040: Progress UI (standard React component)

---

## Performance Targets (Week 22 Validation)

### Must Pass (Critical)
| Test | Target | Measurement |
|------|--------|-------------|
| 1000 items, sequential | <5 minutes | End-to-end execution time |
| 100 items, 4x concurrency | >3x speedup vs sequential | Compare parallel vs sequential |
| Memory usage (1000 items) | <1GB | Peak memory during execution |
| Progress update overhead | <5% | Compare with/without tracking |

### Should Pass (Important)
| Test | Target | Measurement |
|------|--------|-------------|
| 100 items, 10x concurrency | >8x speedup | Compare parallel vs sequential |
| 5000 items, 10x concurrency | <20 minutes | End-to-end execution time |
| Database queries (100 items) | <20 queries | Query count during execution |

### Nice to Have (Stretch)
| Test | Target | Measurement |
|------|--------|-------------|
| 10,000 items | Completes without crash | Memory and stability |
| 50 concurrent workflows | System remains responsive | Load testing |

---

## Team Assignments by Week

### Week 19
- **BE1**: Loop schema (6h), Sequential compiler (12h)
- **BE2**: Input resolver (8h), Error handling (10h)
- **FE1**: Loop container UI (16h), Config panel (12h)
- **DevOps**: Performance monitoring (12h)

### Week 20 ⚠️
- **BE1**: Concurrency control (20h) ⚠️ FULL FOCUS
- **BE2**: Complete error handling (2h), Start progress tracking (10h)
- **FE1**: Polish loop UI (16h)
- **DevOps**: Support backend, prepare load testing (16h)

### Week 21
- **BE1**: Support M4-T050 prep (16h)
- **BE2**: Complete progress tracking (16h)
- **FE1**: Progress UI (14h), History viewer (10h)
- **DevOps**: Load testing infrastructure (12h)
- **QA**: Start performance tests (16h)

### Week 22 ⚠️
- **BE1**: Optimization (16h)
- **BE2**: Optimization (16h)
- **FE1**: UI performance, bug fixes (20h)
- **DevOps**: Load testing, tuning (16h)
- **QA**: Complete performance tests (12h), load testing (8h)

### Week 23
- **BE1**: Dev docs (8h), User docs (4h)
- **BE2**: Demo examples (8h), Bug fixes (8h)
- **FE1**: User docs (8h), Video (4h), Bug fixes (8h)
- **DevOps**: Demo environment (8h)
- **QA**: Demo examples (4h), Demo script (8h), Testing (8h)

### Week 24
- **All**: Bug fixes (40h distributed), Final rehearsal (8h)

---

## Weekly Checkpoints

### End of Week 19
- [ ] Sequential loop executes 100 items successfully
- [ ] Loop container renders on canvas
- [ ] Team confident in foundation

**If NO**: Extend to Week 20, delay concurrency

### End of Week 20 ⚠️ CRITICAL
- [ ] Parallel loop compiles with Promise.race()
- [ ] Concurrency limit works (4 concurrent max)
- [ ] Basic tests pass

**If NO**: ESCALATE IMMEDIATELY - Milestone at risk

### End of Week 21
- [ ] Progress tracking API works
- [ ] Progress UI updates in real-time
- [ ] Performance test suite runs

**If NO**: Reduce scope for demo (100 items instead of 1000)

### End of Week 22 ⚠️ CRITICAL
- [ ] All performance benchmarks pass
- [ ] 1000 items complete in <5 minutes
- [ ] No critical performance issues

**If NO**: Demo with 100 items, document 1000-item support as future work

### End of Week 23
- [ ] Demo script rehearsed 3+ times
- [ ] All documentation complete
- [ ] Demo environment stable

**If NO**: Use Week 24 to complete

### End of Week 24
- [ ] Stakeholder demo successful
- [ ] Feedback collected
- [ ] Milestone 4 COMPLETE ✓

---

## Red Flags & Escalation

### When to Escalate

**Week 20 Red Flags**:
- [ ] M4-T030 not compiling by Wednesday
- [ ] Estimated to take >30 hours
- [ ] Fundamental design issues with Promise.race()

**Week 22 Red Flags**:
- [ ] Performance tests show 1000 items takes >10 minutes
- [ ] Memory usage exceeds 2GB
- [ ] Critical bugs found that block demo

**Any Week Red Flags**:
- [ ] Critical path task slipping by >50%
- [ ] Key team member unavailable (illness, vacation)
- [ ] External dependency blocking (Temporal, database)

### Escalation Path
1. **Daily**: Raise in standup
2. **Weekly**: Raise in weekly demo
3. **Critical**: Email project lead immediately

---

## Success Metrics (Week 24 Demo)

### Quantitative Targets
| Metric | Target | Actual |
|--------|--------|--------|
| Workflows with loops created | 10-15 | ___ |
| Items processed (total) | >10,000 | ___ |
| Concurrency 4x speedup | >3x | ___ |
| Concurrency 10x speedup | >8x | ___ |
| 1000 items execution time | <5 minutes | ___ |
| Memory usage (1000 items) | <1GB | ___ |
| User adoption | 15-20 users | ___ |

### Qualitative Targets
- [ ] Non-technical user can create loop in 15 minutes
- [ ] Parallel execution shows visible speedup
- [ ] 1000-item loop completes without crashes
- [ ] Users understand sequential vs parallel tradeoffs
- [ ] Production-ready quality

---

## Common Issues & Solutions

### Issue: Concurrency control not respecting limit
**Solution**: Check Promise.race() implementation, verify Map cleanup

### Issue: Progress updates slow down execution
**Solution**: Batch updates (every 10 items), async writes

### Issue: Memory usage too high
**Solution**: Stream arrays, clear completed jobs, limit history retention

### Issue: Performance tests failing
**Solution**: Profile execution, optimize database queries, add caching

### Issue: Demo workflow errors
**Solution**: Verify seed data, check activity implementations, test offline

---

## Milestone 4 vs Milestone 1-3

### Similarities
- 6-week timeline
- Buffer week at end
- Demo to stakeholders
- Same team structure

### Differences
- **Lower utilization** (40% vs 60%) - Quality over quantity
- **Dedicated performance week** (Week 22) - Batch processing requires load testing
- **Higher risk concentration** (Week 20) - Concurrency control is complex

### What We Learned from M1-3
- Buffer week is essential (use it!)
- Performance testing catches issues early
- Demo rehearsal prevents surprises
- Documentation takes longer than estimated

---

## Quick Commands

### Run Performance Tests
```bash
npm run test:performance -- loop-execution
```

### Run Load Tests
```bash
./scripts/load/run-load-tests.sh
```

### View Performance Metrics
```bash
# Open monitoring dashboard
open http://localhost:3000/metrics/performance
```

### Seed Demo Workflows
```bash
npm run seed:milestone-4-demos
```

### Execute Demo Workflow
```bash
# From UI: /workflows/demo-bulk-email-sender
# Click "Run" → Watch progress bar
```

---

## Emergency Fallback Plan

### If Week 20 Fails (Concurrency Control)
**Plan B**: Ship with sequential-only
- Demo 100 items sequentially (still valuable)
- Document parallel as "coming in M5"
- Focus on progress tracking and UI

### If Week 22 Fails (Performance)
**Plan B**: Reduce scope to 100 items
- Demo 100 items instead of 1000
- Document performance tuning as future work
- Show concurrency speedup at smaller scale

### If Demo Environment Crashes
**Plan C**: Use backup recording
- Pre-record successful demo
- Show recording instead of live demo
- Still demonstrate functionality

---

## Post-Milestone Checklist

After successful demo:
- [ ] Merge M4 code to main branch
- [ ] Tag release: `v4.0.0-batch-processing`
- [ ] Publish documentation
- [ ] Collect stakeholder feedback
- [ ] Team retrospective
- [ ] Update velocity metrics (actual vs estimated)
- [ ] Identify lessons learned for M5
- [ ] Archive demo environment
- [ ] Go/No-Go decision on M5

---

## Handoff to Milestone 5

M5 will add:
- Child workflow nodes (spawn workflows from workflows)
- Dependency-aware concurrency (build packages in order)
- Dynamic slot management (Promise.race() with dependencies)
- Advanced loop patterns (while loops with dynamic conditions)

**M5 builds directly on M4's concurrency control foundation.**

Start date: Week 25 (immediately after M4)

---

## Contact & Resources

### Code
- **Main Branch**: `feature/milestone-4-batch-processing`
- **Task Tracking**: GitHub Projects or Jira board
- **Code Review**: All PRs to main branch

### Documentation
- **User Guide**: `docs/user-guide/batch-processing.md`
- **Developer Guide**: `docs/architecture/loop-compiler.md`
- **API Reference**: `docs/api/loop-progress-api.md`

### Demos
- **Demo Environment**: `https://demo.workflow-builder.com`
- **Demo Script**: `docs/demo/milestone-4-script.md`
- **Video Walkthrough**: `docs/user-guide/video-batch-processing.mp4`

### Team
- **Backend Lead**: [Backend Engineer 1]
- **Frontend Lead**: [Frontend Engineer 1]
- **DevOps Lead**: [DevOps Engineer]
- **QA Lead**: [QA Engineer]

---

**Remember**: Week 20 is CRITICAL. Focus all energy on concurrency control. Everything else can wait.

**Motto for M4**: "Make it work (Week 20), make it fast (Week 22), make it pretty (Week 23)"

---

**Created**: 2025-01-19
**Version**: 1.0
**Print and Pin to Wall**: Yes! (Especially Week 20 schedule)
