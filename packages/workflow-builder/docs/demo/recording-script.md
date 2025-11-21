# Milestone 1 Demo Recording Script
**Purpose**: Backup video recording for stakeholder demo if live demo fails
**Duration**: 15 minutes (12 minutes demo + 3 minutes introduction/closing)
**Format**: Screen recording with voiceover narration

---

## Recording Setup

### Equipment Checklist
- [ ] Screen recording software installed (OBS Studio, QuickTime, or similar)
- [ ] High-quality microphone configured
- [ ] Quiet recording environment
- [ ] Demo environment running and verified healthy
- [ ] Browser cache cleared and logged in
- [ ] Demo workflows visible in UI
- [ ] Notifications disabled (Do Not Disturb mode)
- [ ] Recording software tested (5-second test recording)

### Recording Settings
- **Resolution**: 1920x1080 (Full HD)
- **Frame Rate**: 60 fps (for smooth mouse movements)
- **Audio**: 48 kHz, 16-bit stereo
- **Format**: MP4 (H.264 video, AAC audio)
- **Bitrate**: 8 Mbps (high quality)

### Browser Setup
- **Zoom**: 110% (for better visibility)
- **Window**: Full screen or maximized
- **Theme**: Light mode (better contrast)
- **DevTools**: Closed (unless showing for specific reason)
- **Extensions**: Disabled (to avoid distractions)

---

## Recording Script

### Opening Sequence (0:00 - 1:00)

**[Visual]**: Show workflow builder landing page with logo

**[Narration]**:
> "Welcome to the Milestone 1 demo of our Workflow Builder system. I'm [Your Name], and over the next 15 minutes, I'll show you a working, production-ready platform that enables you to create, deploy, and monitor Temporal workflows without writing code.
>
> This recording demonstrates all 6 core capabilities we committed to delivering in our roadmap: visual workflow creation, activity configuration, one-click deployment, real-time execution monitoring, code generation, and full observability.
>
> Let's get started."

**[Action]**:
- Show landing page for 3 seconds
- Click "Demo Workflows" project
- Show project page with 6 workflows listed

---

### Part 1: Visual Workflow Creation (1:00 - 4:00)

**[Visual]**: Workflow canvas with component palette

**[Narration]**:
> "First, let me show you how easy it is to create a workflow visually. I'm going to build a simple API orchestration workflow from scratch."

**[Action]**:
1. Click "New Workflow" button
2. Show empty canvas with component palette on left

**[Narration]**:
> "Here's our workflow canvas. On the left is the component palette with two node types: Trigger nodes, which start a workflow, and Activity nodes, which perform work."

**[Action]**:
3. Drag "Manual Trigger" to canvas at position (100, 200)
   - **Timing**: Slow, deliberate drag (2 seconds)
   - **Pause**: 1 second after drop

**[Narration]**:
> "I'm starting with a Manual Trigger node. This lets me start the workflow on demand."

**[Action]**:
4. Drag "Activity" node to position (300, 200)
   - Label appears: "Activity 1"
   - **Pause**: 1 second

**[Narration]**:
> "Now I'll add the first activity."

**[Action]**:
5. Drag second "Activity" to (550, 200)
6. Drag third "Activity" to (800, 200)
   - **Narration during drags**: "Second activity... and third activity."

**[Action]**:
7. Connect nodes by dragging edges:
   - Trigger → Activity 1
   - Activity 1 → Activity 2
   - Activity 2 → Activity 3
   - **Timing**: Slow, clear connections (1 second each)
   - **Pause**: 2 seconds after all connections complete

**[Narration]**:
> "I've just created a linear workflow with 3 activities in under 30 seconds. Notice how the edges connect automatically, creating a clear flow from start to finish."

**[Action]**:
8. Hover over workflow to show interactive elements
9. Zoom in slightly to show detail

**[Narration]**:
> "The canvas supports zoom, pan, and undo/redo, just like any modern design tool. Now let's configure these activities."

---

### Part 2: Activity Configuration (4:00 - 6:00)

**[Visual]**: Property panel with configuration form

**[Action]**:
1. Click on Activity 1 node
2. Property panel slides in from right

**[Narration]**:
> "Clicking on any activity opens the configuration panel. Here I can set custom properties and retry policies."

**[Action]**:
3. Change name from "Activity 1" to "Fetch User Data"
   - **Timing**: Type at normal speed (show real typing)
   - **Pause**: 1 second after typing

**[Narration]**:
> "I'm naming this activity 'Fetch User Data' to make it clear what it does."

**[Action]**:
4. Click timeout field
5. Enter "30s"
   - **Pause**: Show validation (green checkmark appears)

**[Narration]**:
> "Setting a timeout of 30 seconds. The system validates this immediately."

**[Action]**:
6. Expand "Retry Policy" section
7. Select "Exponential Backoff" from dropdown
8. Set:
   - Max Attempts: 3
   - Initial Interval: 1s
   - Backoff Coefficient: 2

**[Narration]**:
> "For retry policy, I'm using exponential backoff. This means if the activity fails, it will retry up to 3 times with increasing delays: first after 1 second, then 2 seconds, then 4 seconds. This is great for handling transient failures like network issues."

**[Action]**:
9. Click "Save" button (if visible) or click away to auto-save
10. **Pause**: 2 seconds to show saved state

**[Action]**:
11. Click Activity 2
12. Configure:
    - Name: "Enrich User Data"
    - Retry: Fail-after-2

**[Narration]**:
> "The second activity enriches the data. I'm using a simpler retry policy here: just fail after 2 attempts."

**[Action]**:
13. Click Activity 3
14. Configure:
    - Name: "Update CRM"
    - Retry: Exponential Backoff, 5 attempts

**[Narration]**:
> "And the final activity updates our CRM. This is critical, so I'm giving it 5 retry attempts."

**[Action]**:
15. Click away to close property panel
16. Show completed workflow with all labels visible

**[Narration]**:
> "Now our workflow is fully configured with meaningful names and appropriate retry strategies for each activity."

---

### Part 3: Deployment (6:00 - 8:00)

**[Visual]**: Deployment button and progress modal

**[Action]**:
1. Hover over "Deploy" button in toolbar
   - **Pause**: Show hover state (1 second)

**[Narration]**:
> "Now for the exciting part: deploying this workflow with a single click."

**[Action]**:
2. Click "Deploy" button
3. Deployment progress modal appears

**[Narration]**:
> "Behind the scenes, the system is now:
> Validating the workflow structure..."

**[Action]**:
4. Show "Validating workflow definition..." stage (2 seconds)

**[Narration]**:
> "Generating production-ready TypeScript code..."

**[Action]**:
5. Show "Generating TypeScript code..." stage (3 seconds)

**[Narration]**:
> "Compiling with TypeScript to ensure type safety..."

**[Action]**:
6. Show "Compiling with TypeScript..." stage (4 seconds)

**[Narration]**:
> "And registering it with the Temporal worker cluster."

**[Action]**:
7. Show "Registering with Temporal worker..." stage (2 seconds)
8. Show "Workflow deployed successfully!" message with green checkmark
   - **Pause**: 3 seconds to let it sink in

**[Narration]**:
> "And we're done! The entire deployment process took about 12 seconds. Our workflow is now active and ready to execute."

**[Action]**:
9. Close deployment modal
10. Show "Active" badge on workflow
11. Point out workflow status indicator

**[Narration]**:
> "Notice the 'Active' badge. This workflow is now running in our Temporal cluster and can be executed at any time."

---

### Part 4: Execution and Monitoring (8:00 - 11:00)

**[Visual]**: Execution panel with real-time updates

**[Action]**:
1. Click "Run Workflow" button
2. Execution input modal appears

**[Narration]**:
> "Let's run this workflow and watch it execute in real-time."

**[Action]**:
3. Show input modal with pre-filled JSON:
```json
{
  "userId": "demo-user-12345",
  "source": "stakeholder-demo"
}
```
4. **Pause**: 2 seconds to show input

**[Narration]**:
> "I'm providing some sample input data. In a real workflow, this might come from an API call, a scheduled trigger, or a manual user action."

**[Action]**:
5. Click "Start Execution"
6. Modal closes
7. Execution panel appears at bottom of screen

**[Narration]**:
> "The workflow is now running. Watch the execution panel - it shows real-time progress."

**[Action]**:
8. Show execution panel with:
   - Status: "Running"
   - Progress bar: 0% → 33% → 66% → 100%
   - Current step indicator
   - Step list with status icons

**[Narration]**:
> "You can see:
> - The overall progress bar filling up as activities complete
> - Each activity's status: pending, running, or completed
> - Real-time duration for each step
>
> This gives you complete visibility into what's happening at any moment."

**[Action]**:
9. Let workflow complete (should take 5-10 seconds with mock activities)
10. Show completion with green checkmark
11. **Pause**: 3 seconds

**[Narration]**:
> "Excellent! The workflow completed successfully. All three activities executed in sequence, each with their configured retry policies ready if needed."

**[Action]**:
12. Click "View Results" to expand execution details
13. Show execution summary:
    - Total duration: ~8 seconds
    - All 3 activities: Completed ✓
    - No retries needed

**[Narration]**:
> "The execution summary shows us:
> - Total duration: 8 seconds
> - All activities completed successfully
> - No retries were needed, meaning everything worked on the first try"

**[Action]**:
14. Click "View Logs" or expand activity details
15. Show individual activity outputs and timings

**[Narration]**:
> "We can drill down into each activity to see exactly what it did, how long it took, and what data it produced. This level of detail is invaluable for debugging and monitoring production workflows."

---

### Part 5: Generated Code (11:00 - 13:00)

**[Visual]**: Code preview dialog with syntax highlighting

**[Action]**:
1. Click "View Code" button in toolbar
2. Code preview dialog opens with tabs

**[Narration]**:
> "One of the most powerful features is that everything we just did visually is compiled to production-ready TypeScript code. Let me show you."

**[Action]**:
3. Show "Workflow" tab (default)
4. Scroll through generated workflow.ts code slowly

**[Narration]**:
> "This is the actual TypeScript code running in Temporal. Notice:
> - Proper imports from the @temporalio/workflow package
> - Type-safe activity definitions
> - Our retry policies translated to Temporal's RetryPolicy objects
> - Clean, readable code with helpful comments explaining each step"

**[Action]**:
5. Highlight or point out key sections:
   - Import statements
   - Activity proxy definition
   - Retry policy configuration
   - Sequential execution logic

**[Narration]**:
> "This isn't pseudo-code or a template. This is production-grade TypeScript that you could copy, customize, and deploy independently if needed."

**[Action]**:
6. Click "Activities" tab
7. Show activity stub implementations

**[Narration]**:
> "The Activities tab shows stubs for each activity with TODO comments. This is where you implement your business logic - calling APIs, querying databases, whatever your workflow needs to do."

**[Action]**:
8. Click "Worker" tab
9. Show worker registration code

**[Narration]**:
> "The Worker tab shows how the workflow is registered with Temporal. This handles all the connection logic, task queue configuration, and worker lifecycle management."

**[Action]**:
10. Click "package.json" tab
11. Show dependencies

**[Narration]**:
> "And package.json includes all the Temporal dependencies and configuration needed to run this as a standalone Node.js application."

**[Action]**:
12. Show "Copy" and "Download Package" buttons at bottom
13. **Pause**: 2 seconds

**[Narration]**:
> "You can copy any of this code, or download the entire package as a zip file. The workflow builder is an accelerator, not a cage - you always have access to the underlying code."

**[Action]**:
14. Close code preview dialog

---

### Part 6: Example Workflows (13:00 - 14:30)

**[Visual]**: Workflow list showing multiple examples

**[Action]**:
1. Navigate back to workflows list
2. Show 6 workflows in "Demo Workflows" project

**[Narration]**:
> "Let me quickly show you the variety of workflows you can build with Milestone 1."

**[Action]**:
3. Click on "ETL Data Pipeline" example
4. Show 5-activity workflow with visual complexity

**[Narration]**:
> "This is a more complex ETL data pipeline with 5 activities. It demonstrates:
> - Multiple retry strategies on different activities
> - Longer execution timeouts for data processing
> - Complex data transformation patterns"

**[Action]**:
5. Click "View Code" briefly
6. Show generated code complexity (scroll quickly)
7. Close code dialog

**[Narration]**:
> "Even with this complexity, the generated code is clean and maintainable."

**[Action]**:
8. Go back to list
9. Click on "E-Commerce Order Fulfillment"
10. Show 4-activity workflow

**[Narration]**:
> "And here's an e-commerce order fulfillment workflow showing real-world patterns:
> - Payment processing
> - Inventory management
> - Shipping coordination
> - Transactional email
>
> These are production-ready patterns you can use immediately or customize for your specific needs."

**[Action]**:
11. **Pause**: 3 seconds to let examples sink in

---

### Closing Summary (14:30 - 15:00)

**[Visual]**: Return to workflow list or landing page

**[Narration]**:
> "So to summarize what Milestone 1 delivers:
>
> **Six Core Capabilities:**
> 1. Visual workflow creation with intuitive drag-and-drop
> 2. Comprehensive activity configuration with timeouts and retry policies
> 3. One-click deployment with automated compilation
> 4. Real-time execution monitoring with full observability
> 5. Production-ready TypeScript code generation
> 6. Complete execution history and debugging tools
>
> **Real Value:**
> - We can now build 30 to 40 percent of our common workflows visually
> - No code required for linear orchestration patterns
> - Deployment time reduced from hours to seconds
> - Full transparency with generated code you own
> - Built on Temporal's enterprise-grade orchestration engine
>
> This is just the beginning. Milestone 2 adds conditionals and decision trees. Milestone 3 adds AI-powered self-healing. And by Milestone 5, we'll have the complete PackageBuilder system running from this UI.
>
> Thank you for watching. I'm excited to discuss this further and answer any questions you have."

**[Visual]**: Fade to end screen with:
- Workflow Builder logo
- Contact information
- Links to documentation

---

## Recording Post-Production

### Editing Checklist
- [ ] Trim any dead air or mistakes
- [ ] Add title slide at beginning (5 seconds)
- [ ] Add end screen with contact info (5 seconds)
- [ ] Normalize audio levels
- [ ] Add subtle background music (optional, very low volume)
- [ ] Add captions/subtitles for accessibility
- [ ] Export in multiple formats:
  - MP4 (H.264) for web playback
  - MOV (ProRes) for archival/editing
  - WebM for modern browsers

### Quality Checks
- [ ] Audio is clear and consistent
- [ ] No background noise or distractions
- [ ] Mouse movements are smooth and visible
- [ ] No typos in text/code shown
- [ ] Timing feels natural (not rushed or dragging)
- [ ] All demo points covered (1-6 from roadmap)
- [ ] Duration is 15 minutes ±30 seconds
- [ ] Video plays correctly in multiple browsers
- [ ] Captions are accurate and synchronized

### Distribution
- [ ] Upload to company video platform (Vimeo, YouTube Private, etc.)
- [ ] Save master copy to `/docs/demo/milestone-1-recording.mp4`
- [ ] Create lower-quality version for email (<25 MB)
- [ ] Add to demo presentation slides as embedded video
- [ ] Include download link in stakeholder follow-up email

---

## Recording Alternatives

### Option 1: Live Recording with Backup Takes

Record in segments, keeping best take of each:
1. Opening (record 3 takes, keep best)
2. Part 1: Visual Creation (record 3 takes, keep best)
3. Part 2: Configuration (record 2 takes, keep best)
4. Part 3: Deployment (record 2 takes, keep best)
5. Part 4: Execution (record 2 takes, keep best)
6. Part 5: Code (record 2 takes, keep best)
7. Part 6: Examples (record 2 takes, keep best)
8. Closing (record 3 takes, keep best)

Then edit together in post-production.

**Pros**: Higher quality, can fix mistakes
**Cons**: More time in post-production

---

### Option 2: Scripted with Slides

Create slides for each section, record voiceover separately:
1. Create slides with screenshots of each demo step
2. Record voiceover reading script (without screen interaction)
3. Add screen recording clips for key moments
4. Edit together with transitions

**Pros**: More polished, easier to redo narration
**Cons**: Less "live" feel, more production time

---

### Option 3: Hybrid Approach (Recommended)

Record full demo live, then:
1. Add title/end slides in post
2. Replace any flubbed narration with re-recorded voiceover
3. Add captions for accessibility
4. Speed up slow parts (1.1x - 1.2x) if needed to hit 15 minutes

**Pros**: Natural feel with professional polish
**Cons**: Moderate post-production time

---

## Narration Tips

### Speaking Style
- **Pace**: Slightly slower than conversational (about 150 words/minute)
- **Tone**: Professional but enthusiastic
- **Energy**: Consistent throughout (don't lose steam at end)
- **Clarity**: Enunciate clearly, especially technical terms
- **Pauses**: Use strategic pauses to let visual actions sink in

### Common Pitfalls to Avoid
- ❌ Saying "um," "uh," "like," or filler words
- ❌ Speaking too fast (trying to cram in too much)
- ❌ Reading script monotonously (sound natural!)
- ❌ Clicking or breathing too close to microphone
- ❌ Talking over important visual moments (let them breathe)

### Recovery from Mistakes
If you make a mistake during recording:
1. **Don't panic** - pause for 3 seconds
2. **Go back** to the start of the current sentence
3. **Repeat** the sentence correctly
4. **Continue** - you'll edit out the mistake later
5. **Mark** the timestamp so you remember to edit it

---

## Technical Requirements

### Minimum Recording Specs
- **CPU**: Intel i5 or AMD Ryzen 5 (4 cores)
- **RAM**: 16 GB
- **Disk Space**: 50 GB free (for raw recordings)
- **Internet**: Not needed (recording locally)

### Recommended Software

**Screen Recording**:
- OBS Studio (free, cross-platform)
- QuickTime Player (Mac, free)
- Camtasia (paid, easier editing)
- ScreenFlow (Mac, paid)

**Audio Recording**:
- Audacity (free, noise reduction)
- Adobe Audition (paid, professional)
- GarageBand (Mac, free)

**Video Editing**:
- DaVinci Resolve (free, professional)
- Adobe Premiere Pro (paid)
- Final Cut Pro (Mac, paid)
- iMovie (Mac, free, basic)

---

## Success Criteria for Recording

### Must Have
- [ ] Covers all 6 roadmap demo points
- [ ] Duration: 14-16 minutes
- [ ] Audio is clear and professional
- [ ] No technical errors visible in demo
- [ ] All workflows execute successfully
- [ ] Generated code is shown and explained
- [ ] Captions/subtitles included

### Nice to Have
- [ ] Smooth, professional editing
- [ ] Background music (subtle)
- [ ] Title and end screens
- [ ] Multiple format exports
- [ ] Lower-quality version for email
- [ ] Transcription available

---

**Recording Prepared By**: [QA Engineer]
**Recording Date**: [Date]
**Duration**: 15:00
**File Size**: ~500 MB (high quality MP4)
**Status**: Ready for use as backup demo material
