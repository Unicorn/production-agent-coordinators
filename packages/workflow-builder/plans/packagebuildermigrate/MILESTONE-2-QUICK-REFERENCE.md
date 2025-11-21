# Milestone 2: Quick Reference Guide

**Goal**: Ship decision trees (conditionals + variables + retry) in 6 weeks
**Demo Date**: End of Week 12
**Team**: 5 people (2 BE, 1 FE, 0.5 DevOps, 0.5 QA)

---

## Critical Path (Must Stay On Track)

```
Week 7: Database + Conditional Pattern (22h)
  ↓
Week 8: Variable Management + Conditional Engine (28h)
  ↓
Week 9: Deployment + Frontend Integration (24h)
  ↓
Week 10: Testing (12h)
```

**Total Critical Path**: 74 hours over 4 weeks
**Slack**: Weeks 11-12 are buffer and demo prep

---

## Week-by-Week Milestones

### Week 7: Foundation ✓
**Goal**: Extend M1 for conditionals, variables, retry
- Database schema supports conditionals and variables
- Conditional pattern compiler working
- Retry pattern compiler working
- Conditional node UI component complete
- Variables panel functional
- Branch edges render with colors/labels
- Staging environment ready

**Demo**: Drag conditional node to canvas, configure branches, declare variables

---

### Week 8: Backend Integration ✓
**Goal**: Backend can compile and execute conditional workflows
- Variable management generates state code
- Conditional engine evaluates expressions
- State management service tracks variables
- Retry executor implements exponential backoff
- PropertyPanel configures conditionals
- Retry configuration UI complete

**Demo**: Create conditional workflow, deploy, execute, verify correct branch taken

---

### Week 9: Full Stack Integration ✓
**Goal**: Users can create and run conditional workflows from UI
- Deployment pipeline validates conditionals
- Execution monitoring shows branch paths
- Variable values displayed in execution history
- Retry attempts visible in monitoring
- Can configure and test expressions
- Staging environment operational with M2 features

**Demo**: Create approval workflow in UI, deploy, execute with both branches, monitor results

---

### Week 10: Testing & Polish ✓
**Goal**: Production-ready quality
- All test suites passing (>80% coverage)
- UI polished and accessible
- Error handling improved
- Performance benchmarks met
- Demo environment ready

**Demo**: Full conditional workflow creation flow with no bugs

---

### Week 11: Documentation & Demo Prep ✓
**Goal**: Ready to present to stakeholders
- User and developer docs complete
- Demo workflows created (approval, validation, routing)
- Demo script rehearsed
- Success metrics compiled

**Demo**: Internal rehearsal with feedback

---

### Week 12: Buffer & Final Demo 🎯
**Goal**: Successful stakeholder demo
- Bug fixes from Week 11
- Final rehearsal
- Stakeholder presentation
- Feedback collection

**Demo**: 6-point demo to stakeholders

---

## 6-Point Demo Checklist

Must successfully demonstrate:
1. ✓ Build approval workflow with 2 branches (if/else)
2. ✓ Set up workflow variables (name, type, default value)
3. ✓ Configure retry policy (max 3, exponential backoff)
4. ✓ Run workflow, see it take different paths based on data (show both true and false branches)
5. ✓ Show failed activity auto-retrying (3 attempts visible with timing)
6. ✓ View execution monitoring with branch path highlighted (green/red edges)

**Success**: All 6 points demonstrated without crashes

---

## Task Ownership Quick Reference

### Backend Engineer 1 (Critical Path Owner)
- **Week 7**: Conditional pattern (M2-T020) + Retry pattern (M2-T022)
- **Week 8**: Variable management (M2-T021) + Conditional engine (M2-T061)
- **Week 9**: Deployment pipeline (M2-T070)
- **Week 10**: Integration tests (M2-T081)
- **Week 11**: Developer docs (M2-T092)

### Backend Engineer 2
- **Week 7**: Database schema (M2-T001, M2-T002) + tRPC APIs (M2-T010, M2-T011, M2-T012)
- **Week 8**: State management (M2-T060) + Retry executor (M2-T062)
- **Week 9**: Support frontend integration
- **Week 10**: Error handling (M2-T084) + bug fixes
- **Week 11**: Demo examples (M2-T090)

### Frontend Engineer 1
- **Week 7**: Conditional node (M2-T040) + Branch edges (M2-T041) + Variables panel (M2-T042)
- **Week 8**: PropertyPanel conditionals (M2-T050) + Retry config UI (M2-T051)
- **Week 9**: Execution monitoring (M2-T071) + integration
- **Week 10**: UI polish (M2-T083) + error handling (M2-T084)
- **Week 11**: User docs (M2-T091) + demo video

### DevOps Engineer (0.5 FTE)
- **Week 7**: Monitoring enhance (M2-T030) + Staging deploy (M2-T031)
- **Week 8**: Support backend integration
- **Week 9**: Monitoring dashboards
- **Week 10**: Performance tuning + demo environment
- **Week 11**: Demo environment prep (M2-T093)

### QA Engineer (0.5 FTE)
- **Week 7-9**: Test planning + manual testing
- **Week 10**: E2E tests (M2-T080) + Performance tests (M2-T082)
- **Week 11**: Demo examples (M2-T090) + Demo script (M2-T093)
- **Week 12**: Final testing + bug verification

---

## Parallel Work Opportunities

### Week 7 (Max Parallelization)
All 5 work streams run independently:
1. Database schema + APIs (BE2)
2. Conditional + retry patterns (BE1)
3. Conditional node + variables panel (FE1)
4. Branch edges (FE1)
5. Monitoring setup (DevOps)

### Week 8 (Backend Focus)
1. Variable management + conditional engine (BE1) - Critical path
2. State management + retry executor (BE2)
3. Frontend config UI (FE1) - lighter week

### Week 9 (Integration)
1. Deployment pipeline (BE1) - Critical path
2. Execution monitoring (FE1) - heavy week
3. Monitoring dashboards (DevOps)

### Week 10 (Testing)
1. Integration tests (BE1)
2. E2E tests (QA)
3. UI polish (FE1)
4. Performance tests (QA)

---

## Risk Management

### High-Risk Tasks (Watch Closely)

1. **M2-T061: Conditional Engine (Week 8)** ⚠️⚠️
   - 16 hours estimated
   - Complex expression evaluation, security risks
   - **Mitigation**: BE1 full focus, extensive unit tests, security review
   - **Fallback**: Limit to simple comparisons (==, !=, >, <)

2. **M2-T021: Variable Management (Week 8)** ⚠️
   - 12 hours estimated
   - State management complexity
   - **Mitigation**: Leverage Temporal's state, comprehensive tests
   - **Fallback**: Store state in Redis instead

3. **M2-T040: Conditional Node UI (Week 7)** ⚠️
   - 16 hours estimated
   - UX complexity, may confuse users
   - **Mitigation**: User testing, clear help text, standard flowchart symbols
   - **Fallback**: Simplify to basic if/else (no nested conditionals)

4. **Week 7 FE1 Overload (38h planned)** ⚠️
   - Heavy workload on single engineer
   - **Mitigation**: Start T042 (Variables Panel) in Week 8 if behind
   - **Fallback**: Defer polish on T041 (Branch Edges)

### Mitigation Strategy

- **Daily standups**: Surface blockers early
- **Mid-week check-ins**: Adjust if tasks running long
- **Week 9 checkpoint**: Assess if Week 12 buffer needed earlier
- **Flexible scope**: Can cut M2-T083 (polish) if behind
- **Reduced team size**: Lower utilization (56.7%) provides built-in buffer

---

## Success Metrics

### Quantitative Targets

| Metric | Target | Stretch Goal |
|--------|--------|--------------|
| Conditional workflows created | 15-25 | 30+ |
| Execution success rate | >92% | >95% |
| User adoption | 5-10 users | 15+ users |
| Deployment time | <3 min | <2 min |
| Condition evaluation | <10ms | <5ms |
| Test coverage | >80% | >85% |
| P0 bugs | 0 | 0 |

### Qualitative Success

- [ ] User can create conditional workflow in 15 minutes
- [ ] Demo runs without crashes
- [ ] Users understand branch logic and variables
- [ ] Documentation enables self-service
- [ ] Code quality suitable for production

---

## Daily Standup Template

**What I did yesterday**:
- Task ID and progress (e.g., "M2-T020: 60% complete, conditional pattern working")

**What I'm doing today**:
- Task ID and goal (e.g., "M2-T020: Finish conditional pattern, start tests")

**Blockers**:
- Any issues preventing progress
- Dependencies on other team members

**Risk flag** (Red/Yellow/Green):
- Red: Behind schedule, need help
- Yellow: On track but risky
- Green: On track, no issues

---

## Weekly Demo Checklist

End of each week, demonstrate progress:

**Week 7**:
- [ ] Drag conditional node to canvas
- [ ] Configure true/false branches
- [ ] Declare variable in variables panel
- [ ] Conditional pattern compiles (CLI test)

**Week 8**:
- [ ] Create conditional workflow via API
- [ ] Deploy and execute workflow
- [ ] Verify correct branch taken
- [ ] View execution with branch decision

**Week 9**:
- [ ] Create conditional workflow in UI
- [ ] Deploy from UI
- [ ] Execute and monitor in real-time
- [ ] View variable values in history

**Week 10**:
- [ ] All tests passing
- [ ] UI polished
- [ ] No critical bugs
- [ ] Retry attempts visible

**Week 11**:
- [ ] Full demo rehearsal
- [ ] Documentation complete
- [ ] Demo examples working

**Week 12**:
- [ ] Stakeholder demo successful

---

## Emergency Contacts

**If Conditional Engine issues**:
- Primary: Backend Engineer 1
- Backup: Backend Engineer 2
- Escalation: Simplify expression language

**If State Management issues**:
- Primary: Backend Engineer 2
- Backup: Backend Engineer 1
- Escalation: Use external state store (Redis)

**If UI complexity issues**:
- Primary: Frontend Engineer 1
- Backup: Simplify UI design
- Escalation: User testing session

**If Temporal issues**:
- Primary: DevOps Engineer
- Backup: Backend Engineer 1
- Escalation: Use Temporal Cloud trial

---

## Go/No-Go Decision Points

### End of Week 9 (Critical Checkpoint)
**Question**: Are we on track for Week 12 demo?

**Green (Continue)**:
- ✓ Can create conditional workflow in UI
- ✓ Can deploy conditional workflow
- ✓ Can execute workflow with branches working
- ✓ Can view execution with branch path
- ✓ No critical blockers

**Yellow (Continue with Caution)**:
- ⚠️ Some features working but buggy
- ⚠️ Need to use Week 12 buffer
- ⚠️ May need to cut polish scope

**Red (Delay or Rescope)**:
- ❌ Cannot create conditional workflows
- ❌ Cannot execute with branches
- ❌ Major technical blockers

**Action**: If Red, delay demo by 1-2 weeks and reassess scope

### End of Week 11 (Demo Prep Checkpoint)
**Question**: Are we ready to demo?

**Green**: All 6 demo points working, no critical bugs
**Yellow**: 5/6 demo points working, have backup plan
**Red**: <5 demo points working, need more time

**Action**: If Red, use backup recording or delay demo by 1 week

---

## Communication Channels

- **Daily Standups**: 9:00 AM, 15 minutes, video call
- **Weekly Demos**: Friday 2:00 PM, 30 minutes
- **Slack Channel**: #milestone-2-decision-trees
- **Task Board**: GitHub Projects (update daily)
- **Documentation**: In `/docs` folder (living docs)

---

## Definition of Done (Every Task)

Before marking task complete:
- [ ] Code committed to feature branch `feature/milestone-2`
- [ ] All tests passing (unit, integration, e2e as applicable)
- [ ] Type checking passes (`npm run typecheck`)
- [ ] Linting passes (`npm run lint`)
- [ ] Self-review completed
- [ ] Documentation updated (if user-facing)
- [ ] Task acceptance criteria all met
- [ ] Peer review completed (if modifying critical path)

---

## Useful Commands

### Development
```bash
# Start dev environment
npm run dev

# Run all tests
npm run test

# Run e2e tests
npm run test:e2e

# Type check
npm run typecheck

# Lint
npm run lint

# Start Temporal locally
docker-compose up temporal
```

### Testing Specific Tasks
```bash
# Test conditional compiler (M2-T020, M2-T021)
npm run test -- src/lib/workflow-compiler/patterns

# Test conditional node (M2-T040)
npm run test:e2e -- conditional-node

# Test variables panel (M2-T042)
npm run test:e2e -- variables-panel

# Test execution monitoring (M2-T071)
npm run test:e2e -- conditional-monitoring
```

---

## Quick Links

- [Full Task Breakdown](./MILESTONE-2-TASKS.md)
- [Gantt Chart](./MILESTONE-2-GANTT.md)
- [Milestone 1 Reference](./MILESTONE-1-TASKS.md) (foundation)
- [Incremental Value Roadmap](./INCREMENTAL-VALUE-ROADMAP.md)
- [Architecture Docs](../../docs/architecture/)
- [API Documentation](../../docs/api/)
- [User Guide](../../docs/user-guide/)

---

## Comparison with Milestone 1

| Aspect | M1: Linear | M2: Conditionals | Change |
|--------|-----------|-----------------|---------|
| Duration | 6 weeks | 6 weeks | Same |
| Team Size | 6 people | 5 people (3.4 FTE) | -38% |
| Node Types | 2 (Trigger, Activity) | +1 (Conditional) | +50% |
| Features | Sequential execution | +Branching, Variables, Retry | +3 major features |
| Complexity | Foundation | Building on foundation | Higher |
| Risk Level | High (first) | Medium (proven base) | Lower |
| Value Added | 30-40% of use cases | +30% (60-70% total) | Significant |

---

## Key Differences from M1

### What's Easier in M2
- Database already set up (extend schema only)
- Canvas component exists (add node type)
- Deployment pipeline exists (enhance validation)
- Monitoring exists (add branch tracking)
- Team knows codebase (faster development)

### What's Harder in M2
- Expression evaluation (security risks)
- State management (complexity)
- UI complexity (conditional logic UX)
- Reduced team size (less capacity)
- More features to integrate (conditionals + variables + retry)

### How We Compensate
- Lower utilization (56.7% vs. 72.5%) provides buffer
- Reuse M1 components (canvas, panels, deployment)
- Focus on core features (simple expressions, basic retry)
- Leverage Temporal's built-in features (state, retry)
- Thorough testing (catch issues early)

---

## M2 Value Proposition

**M1 Enabled**: 30-40% of workflows (linear only)
**M2 Enables**: 60-70% of workflows (+ conditionals)

**New Use Cases**:
1. **Approval Workflows** - If approved → provision, else → reject
2. **Validation Pipelines** - If valid → process, else → retry
3. **Smart Routing** - Route based on user tier, data type, etc.
4. **Error Handling** - If error → retry with backoff, else → continue
5. **Business Logic** - Conditional branches based on variables

**Why This Matters**:
- Users can handle 30% more workflow types
- Self-healing with retry (reduces manual intervention)
- Business logic in visual form (no code required)
- State management (persistent workflow context)

---

**Last Updated**: 2025-01-19
**Next Review**: End of Week 9
