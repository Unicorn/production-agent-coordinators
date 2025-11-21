# Milestone 1: Quick Reference Guide

**Goal**: Ship linear workflows in 6 weeks
**Demo Date**: End of Week 6
**Team**: 6 people (2 BE, 2 FE, 1 DevOps, 1 QA)

---

## Critical Path (Must Stay On Track)

```
Week 1: Database + Compiler Core (20h)
  ↓
Week 2: Code Generation + Worker (32h)
  ↓
Week 3: Deployment Pipeline (16h)
  ↓
Week 4: Testing (12h)
```

**Total Critical Path**: 80 hours over 4 weeks
**Slack**: Weeks 5-6 are buffer and demo prep

---

## Week-by-Week Milestones

### Week 1: Foundation ✓
**Goal**: All teams can work independently
- Database schema deployed
- Canvas drag-and-drop working
- Compiler structure in place
- Temporal running locally
- CI/CD operational

**Demo**: Drag nodes on canvas, save to database

---

### Week 2: Backend Integration ✓
**Goal**: Backend can compile and execute workflows
- Code generator produces valid TypeScript
- Workers register workflows dynamically
- Can execute workflow via API
- Monitoring tracks progress

**Demo**: Compile workflow JSON, execute in Temporal, view status

---

### Week 3: Full Stack Integration ✓
**Goal**: Users can deploy and run workflows from UI
- Deploy button works end-to-end
- Execution monitoring UI shows real-time progress
- Can view generated code
- Staging environment operational

**Demo**: Create workflow in UI, deploy, execute, monitor results

---

### Week 4: Testing & Polish ✓
**Goal**: Production-ready quality
- All test suites passing (>80% coverage)
- UI polished and accessible
- Error handling improved
- Performance benchmarks met
- Demo environment ready

**Demo**: Full workflow creation flow with no bugs

---

### Week 5: Documentation & Demo Prep ✓
**Goal**: Ready to present to stakeholders
- User and developer docs complete
- Demo workflows created
- Demo script rehearsed
- Success metrics compiled

**Demo**: Internal rehearsal with feedback

---

### Week 6: Buffer & Final Demo 🎯
**Goal**: Successful stakeholder demo
- Bug fixes from Week 5
- Final rehearsal
- Stakeholder presentation
- Feedback collection

**Demo**: 6-point demo to stakeholders

---

## 6-Point Demo Checklist

Must successfully demonstrate:
1. ✓ Create workflow in UI (drag 3 activities)
2. ✓ Configure each activity (name, timeout)
3. ✓ Click "Deploy" (compilation progress)
4. ✓ Workflow executes successfully
5. ✓ View generated TypeScript code
6. ✓ Monitor execution in UI (steps, progress, results)

**Success**: All 6 points demonstrated without crashes

---

## Task Ownership Quick Reference

### Backend Engineer 1 (Critical Path Owner)
- **Week 1**: Compiler core (M1-T020) + Compiler API (M1-T012)
- **Week 2**: Code generator (M1-T021) + Worker registration (M1-T050)
- **Week 3**: Deployment pipeline (M1-T051)
- **Week 4**: Integration tests (M1-T081)
- **Week 5**: Developer docs (M1-T092)

### Backend Engineer 2
- **Week 1**: Database schema (M1-T001, M1-T002) + tRPC APIs (M1-T010, M1-T011)
- **Week 2**: Execution service (M1-T060) + Monitoring (M1-T061)
- **Week 3**: Support frontend integration
- **Week 4**: Error handling (M1-T084) + bug fixes
- **Week 5**: Demo examples (M1-T090)

### Frontend Engineer 1
- **Week 1**: Canvas component (M1-T040) + Palette (M1-T041)
- **Week 2**: Polish canvas + start code preview (M1-T072)
- **Week 3**: Complete code preview + integration
- **Week 4**: UI polish (M1-T083) + accessibility
- **Week 5**: User docs (M1-T091) + demo video

### Frontend Engineer 2
- **Week 1**: Property panel (M1-T042)
- **Week 2**: Start deployment UI (M1-T070)
- **Week 3**: Complete deployment UI + Execution monitoring UI (M1-T071)
- **Week 4**: UI polish (M1-T083) + error handling (M1-T084)
- **Week 5**: Bug fixes + demo prep

### DevOps Engineer
- **Week 1**: Temporal setup (M1-T030) + CI/CD (M1-T031)
- **Week 2**: Support backend integration
- **Week 3**: Deploy staging + monitoring
- **Week 4**: Performance tuning + demo environment
- **Week 5**: Demo environment prep (M1-T093)

### QA Engineer
- **Week 4**: E2E tests (M1-T080) + Performance tests (M1-T082)
- **Week 5**: Demo examples (M1-T090) + Demo script (M1-T093)
- **Week 6**: Final testing + bug verification

---

## Parallel Work Opportunities

### Week 1 (Max Parallelization)
All 5 work streams run independently:
1. Database schema (BE2)
2. Compiler core (BE1)
3. Canvas UI (FE1)
4. Property panel (FE2)
5. Temporal setup (DevOps)

### Week 2 (Backend Focus)
1. Code generation (BE1) - Critical path
2. Execution service (BE2)
3. Frontend polish (FE1, FE2) - lighter week

### Week 3 (Integration)
1. Deployment pipeline (BE1) - Critical path
2. Frontend integration (FE1, FE2) - heavy week
3. Deploy staging (DevOps)

### Week 4 (Testing)
1. Integration tests (BE1)
2. E2E tests (QA)
3. UI polish (FE1, FE2)
4. Performance tests (QA)

---

## Risk Management

### High-Risk Tasks (Watch Closely)

1. **M1-T050: Worker Registration (Week 2)** ⚠️
   - 16 hours estimated
   - Complex, may take longer
   - **Mitigation**: BE1 full focus, BE2 backup
   - **Fallback**: Static registration (manual restart)

2. **M1-T021: Code Generator (Week 2)** ⚠️
   - 16 hours estimated
   - Quality critical for demo
   - **Mitigation**: Extensive unit tests, TypeScript validation
   - **Fallback**: Manual templates for demo

3. **M1-T080: E2E Tests (Week 4)** ⚠️
   - May be flaky, slow
   - **Mitigation**: Proper waits, page objects
   - **Fallback**: Manual testing for demo

### Mitigation Strategy

- **Daily standups**: Surface blockers early
- **Mid-week check-ins**: Adjust if tasks running long
- **Week 3 checkpoint**: Assess if Week 6 buffer needed earlier
- **Flexible scope**: Can cut M1-T083 (polish) if behind

---

## Success Metrics

### Quantitative Targets

| Metric | Target | Stretch Goal |
|--------|--------|--------------|
| Workflows created | 5-10 | 15+ |
| Execution success rate | >90% | >95% |
| User adoption | 3-5 users | 10+ users |
| Deployment time | <2 min | <1 min |
| Test coverage | >80% | >90% |
| P0 bugs | 0 | 0 |

### Qualitative Success

- [ ] Non-technical person can create workflow in 10 minutes
- [ ] Demo runs without crashes
- [ ] Users understand monitoring and errors
- [ ] Documentation enables self-service
- [ ] Code quality suitable for production

---

## Daily Standup Template

**What I did yesterday**:
- Task ID and progress (e.g., "M1-T020: 60% complete, compiler core working")

**What I'm doing today**:
- Task ID and goal (e.g., "M1-T020: Finish compiler core, start tests")

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

**Week 1**:
- [ ] Drag nodes on canvas
- [ ] Save workflow to database
- [ ] Compiler compiles simple workflow (CLI test)

**Week 2**:
- [ ] Compile workflow via API
- [ ] Execute workflow in Temporal
- [ ] View execution status

**Week 3**:
- [ ] Deploy workflow from UI
- [ ] Execute from UI
- [ ] Monitor in real-time

**Week 4**:
- [ ] All tests passing
- [ ] UI polished
- [ ] No critical bugs

**Week 5**:
- [ ] Full demo rehearsal
- [ ] Documentation complete

**Week 6**:
- [ ] Stakeholder demo successful

---

## Emergency Contacts

**If Temporal issues**:
- Primary: DevOps Engineer
- Backup: Backend Engineer 1
- Escalation: Use Temporal Cloud trial

**If compiler issues**:
- Primary: Backend Engineer 1
- Backup: Backend Engineer 2

**If frontend issues**:
- Primary: Frontend Engineer 1 (Canvas)
- Primary: Frontend Engineer 2 (Panels/UI)

**If CI/CD issues**:
- Primary: DevOps Engineer
- Backup: Run tests locally, deploy manually

---

## Go/No-Go Decision Points

### End of Week 3 (Critical Checkpoint)
**Question**: Are we on track for Week 6 demo?

**Green (Continue)**:
- ✓ Can deploy workflow from UI
- ✓ Can execute workflow
- ✓ Can monitor execution
- ✓ No critical blockers

**Yellow (Continue with Caution)**:
- ⚠️ Some features working but buggy
- ⚠️ Need to use Week 6 buffer
- ⚠️ May need to cut polish scope

**Red (Delay or Rescope)**:
- ❌ Cannot deploy workflows
- ❌ Cannot execute workflows
- ❌ Major technical blockers

**Action**: If Red, delay demo by 1-2 weeks and reassess scope

### End of Week 5 (Demo Prep Checkpoint)
**Question**: Are we ready to demo?

**Green**: All 6 demo points working, no critical bugs
**Yellow**: 5/6 demo points working, have backup plan
**Red**: <5 demo points working, need more time

**Action**: If Red, use backup recording or delay demo by 1 week

---

## Communication Channels

- **Daily Standups**: 9:00 AM, 15 minutes, video call
- **Weekly Demos**: Friday 2:00 PM, 30 minutes
- **Slack Channel**: #milestone-1-linear-workflows
- **Task Board**: GitHub Projects (update daily)
- **Documentation**: In `/docs` folder (living docs)

---

## Definition of Done (Every Task)

Before marking task complete:
- [ ] Code committed to feature branch
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
# Test compiler (M1-T020, M1-T021)
npm run test -- src/lib/workflow-compiler

# Test canvas (M1-T040)
npm run test:e2e -- workflow-canvas

# Test deployment (M1-T051, M1-T070)
npm run test:e2e -- deployment

# Test execution (M1-T060, M1-T071)
npm run test:e2e -- execution
```

---

## Quick Links

- [Full Task Breakdown](./MILESTONE-1-TASKS.md)
- [Incremental Value Roadmap](./INCREMENTAL-VALUE-ROADMAP.md)
- [Architecture Docs](../../docs/architecture/)
- [API Documentation](../../docs/api/)
- [User Guide](../../docs/user-guide/)

---

**Last Updated**: 2025-01-19
**Next Review**: End of Week 3
