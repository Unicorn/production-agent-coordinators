# Video Walkthrough Script

Script for creating a 5-7 minute screencast demonstrating the complete workflow creation process.

## Video Overview

**Title:** "Workflow Builder: From Design to Execution in 7 Minutes"
**Target Audience:** New users, semi-technical to non-technical
**Duration:** 6-7 minutes
**Format:** Screen recording with voiceover
**Goal:** Show complete workflow lifecycle from creation to monitoring

## Pre-Recording Checklist

### Setup Environment

- [ ] Clean browser (no other tabs, incognito mode)
- [ ] Zoom browser to comfortable viewing size (125%)
- [ ] System at http://localhost:3010
- [ ] Temporal running at http://localhost:8233
- [ ] Test user account ready
- [ ] Demo project created (or ready to create)
- [ ] Screen recording software tested (OBS, Loom, or QuickTime)
- [ ] Microphone tested and clear
- [ ] Quiet environment

### Screen Setup

- [ ] Close unnecessary applications
- [ ] Hide desktop icons
- [ ] Set browser to full screen mode
- [ ] Clear notifications
- [ ] Have script open on second monitor

## Video Script

---

### INTRO (0:00 - 0:30)

**[Screen: Workflow Builder homepage, clean interface]**

**Voiceover:**
"Welcome to Workflow Builder! In this video, I'll show you how to create, deploy, and execute your first workflow in just a few minutes - no coding required.

We'll build a simple data processing workflow that fetches user data, processes it, and saves the results. Let's get started!"

**[Cursor movement: Natural, not too fast]**

---

### PART 1: Create a Project (0:30 - 1:15)

**[Screen: Homepage]**

**Voiceover:**
"First, we need to create a project. Projects help organize your workflows."

**[Action: Click 'Projects' in sidebar]**

**[Screen: Projects list page]**

**Voiceover:**
"Let's create a new project."

**[Action: Click 'New Project' button]**

**[Screen: New project form]**

**[Action: Type while speaking]**
- **Voiceover:** "I'll name this 'Data Processing Project'..."
- **Type:** "Data Processing Project" in Name field

**[Action: Type description]**
- **Voiceover:** "...add a description..."
- **Type:** "Workflows for processing user data"

**[Action: Show task queue field]**
- **Voiceover:** "The task queue is auto-generated, which is perfect."

**[Action: Click 'Create Project']**

**[Screen: Project detail page loads]**

**Voiceover:**
"Great! Our project is created. Now let's build a workflow."

**[Pause: 1 second]**

---

### PART 2: Create a Workflow (1:15 - 2:30)

**[Screen: Project detail page]**

**[Action: Click 'Workflows' tab]**

**[Action: Click 'New Workflow' button]**

**[Screen: New workflow form]**

**Voiceover:**
"Now we'll create our workflow. I'll call it 'User Data Pipeline'."

**[Action: Fill form while speaking]**
- **Type:** "User Data Pipeline" in Name
- **Type:** "Fetches and processes user data" in Description
- **Voiceover:** "The kebab name is auto-generated from the name."

**[Action: Click 'Create Workflow']**

**[Screen: Workflow detail page]**

**[Action: Click 'Edit' button]**

**[Screen: Workflow canvas loads]**

**[Pause: 1 second]**

**Voiceover:**
"Perfect! Now we're in the visual workflow editor. You can see three main areas: the Component Palette on the left, the canvas in the center, and the Property Panel on the right."

**[Action: Slowly pan cursor across each area]**

---

### PART 3: Design the Workflow (2:30 - 4:30)

**[Screen: Empty workflow canvas]**

**Voiceover:**
"Every workflow needs a trigger - that's the starting point. Let's add one."

**[Action: Find 'Trigger' in palette]**

**[Action: Drag trigger onto canvas, smooth motion]**

**[Screen: Trigger node on canvas]**

**Voiceover:**
"Great! Now let's configure it."

**[Action: Click on trigger node]**

**[Screen: Property panel shows trigger configuration]**

**[Action: Type in property panel]**
- **Type:** "Start Pipeline" in Label field
- **Voiceover:** "I'll label this 'Start Pipeline'. The trigger type is 'Manual' which is perfect for our demo."

**[Pause: 0.5 seconds]**

**Voiceover:**
"Now let's add our first activity - fetching user data."

**[Action: Drag Activity node from palette]**

**[Screen: Activity node on canvas, to right of trigger]**

**[Action: Click on activity node]**

**[Screen: Property panel for activity]**

**[Action: Configure activity]**
- **Type:** "Fetch User Data" in Label
- **Change timeout:** "30s"
- **Select retry policy:** "Exponential Backoff"
- **Voiceover:** "I'll configure this with a 30-second timeout and exponential backoff retry policy in case the API is temporarily unavailable."

**[Pause: 0.5 seconds]**

**Voiceover:**
"Let's add our second activity to process the data."

**[Action: Drag second activity node]**

**[Screen: Second activity to right of first]**

**[Action: Click on second activity]**

**[Action: Configure]**
- **Type:** "Process Data" in Label
- **Timeout:** "1m"
- **Retry:** "Fail After 2 Attempts"
- **Voiceover:** "This one processes the data. I'll give it one minute and configure it to fail after 2 attempts."

**[Pause: 0.5 seconds]**

**Voiceover:**
"And finally, let's add an activity to save the results."

**[Action: Drag third activity node]**

**[Action: Configure]**
- **Type:** "Save Results" in Label
- **Timeout:** "30s"
- **Retry:** "Exponential Backoff", Max Attempts: 5
- **Voiceover:** "For saving results, I'll use exponential backoff with up to 5 retry attempts to ensure the data gets saved."

**[Pause: 1 second]**

**Voiceover:**
"Now we need to connect these nodes to define the execution flow."

**[Action: Connect trigger to first activity]**
- **Hover over trigger** (show handle)
- **Drag from handle to first activity**
- **Voiceover:** "Click and drag from the handle on the right to connect nodes..."

**[Action: Connect first activity to second]**
**[Action: Connect second activity to third]**

**[Screen: Complete workflow with all connections]**

**Voiceover:**
"Perfect! Our workflow is designed. The system auto-saves every 2 seconds, but let's manually save to be sure."

**[Action: Click 'Save' button]**

**[Screen: 'Saved' confirmation appears]**

---

### PART 4: Deploy the Workflow (4:30 - 5:30)

**[Screen: Workflow canvas with complete design]**

**Voiceover:**
"Now we need to deploy our workflow. This will compile our visual design into executable code and register it with Temporal."

**[Action: Click 'Build Workflow' button]**

**[Screen: Build modal appears with progress]**

**Voiceover:**
"The build process validates our workflow, compiles it to TypeScript, and registers it with the worker."

**[Show: Progress steps completing]**
- ✓ Validating workflow definition...
- ✓ Compiling workflow to TypeScript...
- ✓ Registering with Temporal...

**[Screen: Success message appears]**

**Voiceover:**
"Excellent! Our workflow is now deployed and ready to execute."

**[Action: Click 'Close' on modal]**

**[Screen: Toolbar shows 'Active' status and green worker indicator]**

**[Action: Point to status indicators]**

**Voiceover:**
"You can see the workflow status is now 'Active' and the worker is running. We're ready to execute!"

---

### PART 5: Execute the Workflow (5:30 - 6:30)

**[Screen: Workflow detail page]**

**[Action: Click 'Execute' button]**

**[Screen: Execution modal appears]**

**Voiceover:**
"Let's run our workflow. For this demo, we don't need any input parameters."

**[Action: Click 'Start Execution' button]**

**[Screen: Redirects to Execution History tab]**

**[Screen: New execution appears at top, status 'Running']**

**Voiceover:**
"The workflow is now executing. Let's click on it to see the details."

**[Action: Click on the execution row]**

**[Screen: Execution Detail View loads]**

**[Screen: Shows components executing in real-time]**
- Fetch User Data: Running → Completed ✓
- Process Data: Running → Completed ✓
- Save Results: Running → Completed ✓

**[Action: Expand first component]**

**[Screen: Shows input and output data]**

**Voiceover:**
"Here we can see each component's execution details - the inputs it received, the outputs it produced, how long it took, and whether any retries occurred."

**[Action: Scroll through component details]**

**[Screen: Final execution status shows 'Completed']**

**Voiceover:**
"And there we have it! Our workflow executed successfully. All three activities completed, and we can see the complete execution history."

---

### PART 6: Monitoring and Statistics (6:30 - 6:50)

**[Screen: Still on Execution Detail]**

**[Action: Navigate to Statistics tab]**

**[Screen: Workflow statistics page]**

**Voiceover:**
"The Statistics tab shows aggregated metrics about our workflow - total runs, success rate, average duration, and recent executions."

**[Action: Briefly show charts and metrics]**

**[Action: Navigate to Execution History tab]**

**[Screen: List of executions (just our one execution)]**

**Voiceover:**
"The Execution History shows all runs of this workflow, making it easy to monitor and debug over time."

---

### OUTRO (6:50 - 7:00)

**[Screen: Workflow canvas or completed execution]**

**Voiceover:**
"And that's it! In just a few minutes, we've created a project, designed a workflow visually, deployed it, and executed it successfully.

The best part? No code required. You can build sophisticated workflows using just drag-and-drop and configuration.

To learn more, check out the documentation at the links below. Thanks for watching!"

**[Screen: Fade to documentation links]**
- Getting Started Guide
- Workflow Canvas Guide
- Deployment Guide
- Execution Monitoring Guide

**[End]**

---

## Post-Production Notes

### Editing

- **Trim dead air**: Remove pauses longer than 2 seconds
- **Speed up waiting**: Speed up (1.5x-2x) parts where loading/waiting
- **Add callouts**: Highlight important UI elements with circles/arrows
- **Add timestamps**: Chapter markers for YouTube
- **Add captions**: Auto-generate or manual for accessibility

### Visual Enhancements

- **Cursor highlight**: Make cursor more visible (yellow circle)
- **Zoom effects**: Zoom in on important UI elements
- **Highlight boxes**: Draw attention to key areas
- **Smooth transitions**: Between major sections

### Audio

- **Remove background noise**: Use noise reduction
- **Normalize volume**: Consistent audio level
- **Add subtle music**: Quiet background music (optional)
- **Clear voice**: Ensure voiceover is crisp and clear

## Video Chapters (for YouTube)

```
0:00 - Introduction
0:30 - Create a Project
1:15 - Create a Workflow
2:30 - Design the Workflow
4:30 - Deploy the Workflow
5:30 - Execute the Workflow
6:30 - Monitoring and Statistics
6:50 - Conclusion
```

## Alternative Shorter Version (3-4 minutes)

If a shorter video is needed, combine these steps:

1. **Quick Intro** (0:00-0:15)
2. **Create Project + Workflow** (0:15-0:45) - faster, less narration
3. **Design Workflow** (0:45-2:00) - show all nodes at once, quick connections
4. **Deploy** (2:00-2:30) - show build without waiting for each step
5. **Execute** (2:30-3:15) - quick execution, brief component view
6. **Outro** (3:15-3:30)

## Recording Tips

### Before Recording

1. **Practice the script 2-3 times** without recording
2. **Time each section** to ensure staying within target
3. **Prepare the environment** exactly as needed
4. **Test audio levels** - record 10 seconds and check
5. **Close all notifications** and messaging apps

### During Recording

1. **Speak clearly and at moderate pace** (not too fast)
2. **Pause slightly between sections** (easier to edit)
3. **Move cursor smoothly** (no jerky movements)
4. **Don't rush** - viewers need time to follow along
5. **If you make a mistake**, pause, then restart that section

### Recording Software Settings

**Recommended Settings:**
- **Resolution**: 1920x1080 (Full HD)
- **Frame Rate**: 30 fps
- **Audio**: 44.1kHz, 16-bit
- **Codec**: H.264
- **Bitrate**: 8-10 Mbps

**Good Tools:**
- **OBS Studio** (free, powerful)
- **Loom** (easy, cloud-based)
- **Camtasia** (professional, paid)
- **QuickTime** (Mac, simple)
- **ScreenFlow** (Mac, professional)

## Distribution

### Where to Publish

1. **YouTube** - primary platform
   - Add to playlist: "Workflow Builder Tutorials"
   - Enable captions
   - Add links in description

2. **Vimeo** - backup/embed
   - Higher quality option
   - Embed in documentation

3. **Documentation Site** - embed directly
   - Add to Getting Started page
   - Link from README

4. **Social Media** - promotional clips
   - Twitter: 30-second highlights
   - LinkedIn: Professional audience
   - Reddit: Developer communities

### Video Description Template

```
Learn how to create, deploy, and execute your first workflow using Workflow Builder - all without writing code!

In this tutorial, you'll learn:
✓ How to create a project and workflow
✓ How to use the visual workflow canvas
✓ How to configure nodes and connections
✓ How to deploy workflows to Temporal
✓ How to execute and monitor workflows

⏱️ Timestamps:
0:00 - Introduction
0:30 - Create a Project
1:15 - Create a Workflow
2:30 - Design the Workflow
4:30 - Deploy the Workflow
5:30 - Execute the Workflow
6:30 - Monitoring and Statistics
6:50 - Conclusion

📚 Resources:
- Getting Started Guide: [link]
- Full Documentation: [link]
- GitHub Repository: [link]
- Example Workflows: [link]

💬 Have questions? Leave a comment below!

#WorkflowBuilder #Temporal #NoCode #Automation
```

## Accessibility

Ensure video is accessible:

- **Captions**: Add accurate captions (auto-generate and edit)
- **Transcript**: Provide full text transcript
- **Audio Description**: Consider version with audio descriptions
- **Clear Visuals**: High contrast, readable text
- **Slow Pace**: Not too fast for viewers to follow

## Updates and Maintenance

Plan for video updates when:
- UI changes significantly
- Major features added
- User feedback suggests improvements

Keep video relevant by:
- Noting version number in description
- Creating "What's New" videos for updates
- Maintaining playlist of all tutorial videos

## Success Metrics

Track these metrics to measure video success:

- **Views**: Target 100+ in first month
- **Watch Time**: Aim for >60% completion rate
- **Engagement**: Likes, comments, shares
- **Conversion**: Link clicks to documentation
- **Feedback**: Comment sentiment and questions

Use metrics to improve future videos!

---

**Ready to Record?** Follow this script, adapt as needed, and create an engaging video that helps users get started with Workflow Builder!
