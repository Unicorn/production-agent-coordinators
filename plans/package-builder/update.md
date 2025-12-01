 There are a couple thing that we need to figure out and I am not sure what the best order of operations here should be:
1. Integrating the Claude and Gemini workflows into the PackageBuilderWorkflow
2. Identifying the commonalities between these two workflows so that we can obfuscate the CLI/model/company specifics out while still getting the same results
3. Make sure that we are doing all the steps that we had in the PackageBuildWorkflow or PackageBuilderWorkflow so that we do the optimizations and correct workflow steps that 
need
to be done, like identifying package dependencies, checking npm for hte packages that are already published so that we don't rebuild something that is already built, validating 
packages, and all the other steps that we put into our package writing coordination.

We don't need the turn based workflow code any longer because we are able to use the gemini and claude CLIs to handle the Gemini an Claude API particulars for us. 
That saves us a ton of trouble and time! We can now focus on the workflow activities, steps, coordination, child workflows, parallelization, validation, optimization, and 
publishing  instead.

Please let's create a proper plan to clean up the turn based code, integrate the gemini and claude code, and obfuscate models/APIs from the workflow user:
- pulling out the steps that we need to keep, like the package building steps that we need to ask our CLIs to do
- Getting rid of the code that we no longer need (like the actual API integration, API Rate limiting, and agentic conversation and context management code)
- Optimizing the order of operations for activities
- Identifying what actions we can do in the workflow outside of agent work to reduce token usage, because it's the right time or because we can do it programmatically

We can choose which agents to use based on our credits remaining, basically using Gemini first and then if we run out of credits or get rate limited we can fall back to Claude.
Our build workflows should, just like hte CLIs, be able to identify that a package was mid-build and pick up mid-plan by comparing the current file and their state against the 
plan to figure out where to pick up and continue.

Create this plan in a new directory in ./plans/ so that we can get this project started - in an order that makes sense nad takes advantage of the code we have, cleans up as we 
go, allows for testing as we go, and helps us come out at the end with a much better more scalable, more reliable, better coordinated workflow that will build packages whether it
 has no dependencies or a hierarchy of dependencies. 