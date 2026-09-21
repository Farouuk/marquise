# Contributing

Use Node from `.nvmrc`, install with `npm ci`, then run `npm run check` before proposing changes. Keep the lockfile committed. Use `npm run demo` for a local demonstration without paid AI.

Keep changes focused and add behavior tests for authorization, scheduling, evidence handling or cost controls when those paths change. Include the problem, resulting behavior and validation in pull requests. Never use actual course files or account data as fixtures. Do not enable paid services as part of automated tests.

The Sites deployment metadata belongs to the existing live app. Forks must register their own deployment and authentication boundary; publishing a fork must not target the original project.

Dependency licenses remain applicable. No blanket open-source license is granted for the project as a whole at this time; contact the owner for reuse permissions.
