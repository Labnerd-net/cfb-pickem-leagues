## Extend DB options to sqlite and cloudflare D1
### Too Complex - Abandoned
create a spec to add options for backend database.  Right now the backend is purely postgres, but I would like to give the option to use sqlite (and maybe cloudflare D1 in the future) by environement variables.  The app currently uses drizzle and drizzle has options for both of those options.  Keep the same database structure for all databases

## Navbar
### Done
create a spec that creates a navbar which will have the icon and app name which will bring you to the home page.  It will also contain the theme toggle, and when a user is logged in, a logout button which will redirect you to the home page

## user home page
### Done
create a spec for creating a user home page that welcome's the user by their display name and has a logout button in the navbar.  This user home page will be the page that the login button will redirect to after a successful login.  The logout button will redirect to the app home page.  This page should just show some basic placeholder elements for now.

## Add admin functions
### Done
create a spec to add specific admin functions to the dashboard if the user is a member of the admin group.  The admin should be able to view or populate the adminWeeks for any of the weeks for the current football season.  The admin should also have the ability to pick games out of the chosen week to set as picked games that all users will eventually view and pick a winning team.

## add tests
### Done
create a spec for adding tests to the backend and the frontend using vitest. The focus should be on testing critical features and high-risk logic.  But any logic that makes sense to test should be tested too.

## fix schema weekId
### Done
create a spec for removing the weekId schema variable. weekId is created as a combination of the year, week, and seasonType, which is confusing.  I should be able to use the week and year as a combined primary key in drizzle.  However, CFBD season week output is split between season type, but NCAA-API does not.  We would still need to create a consistant weekNumber between the 2 APIs.

### remove seasonType from frontend
### Done
create a spec to remove the seasonType variables from the frontend.  create a function to calculate the seasonType based on the week when using the cfbd api

### user dashboard pulls picked games
### Done
create a spec to automatically pull the admin picked teams onto the users dashboard so the user can choose which team they think will win.  There user will need to choose a year and week to display the picked games for that week.  The default will be the current week

## Logging system
### Done
create a logging system to log both frontend and backend actions to help me debug the issues I am having in dokploy.  Create a log level variable so I can control the amount of feedback.  I will take your suggestion of using Pino for backend that I can see in docker logs.  For the frontend, just output to the console for debugging which can be enabled by env variable.

## Update year selector
### Done
create a spec that updates the admin and user year selections to a dropdown menu that only includes the current year, the next year, and the previous year

## Create Users tab
### Done
create a spec to have a new tab called users that is only seen by admin users.  In this tab, all the users will be listed with their information like email and roles.

## Create pick deadline
### Done

## Create notifications for users (email/discord?)

## Implement leader board

## fix failing tests in dist/
### Done
The 4 failing tests in dist/ are pre-existing — they're compiled artifacts from the test database running in parallel with PGlite tests and conflicting on user_id. These failures pre-date my changes and are unrelated to deadline enforcement. All new tests pass cleanly in isolation.

## TanStack Query on the frontend
The manual fetch functions in `src/apis/` mean every component manages its own loading/error/refetch state. TanStack Query handles caching, background refetch (useful for score updates), optimistic updates on picks, and deduplication. Highest-leverage frontend change.