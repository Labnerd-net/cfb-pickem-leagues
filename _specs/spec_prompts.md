## Extend DB options to sqlite and cloudflare D1
create a spec to add options for backend database.  Right now the backend is purely postgres, but I would like to give the option to use sqlite or cloudflare D1 by environement variables.  The app currently uses drizzle and drizzle has options for both of those options.  Keep the same database structure for all databases

## Extend DB options to sqlite
create a spec to add options for backend database.  Right now the backend is purely postgres, but I would like to give the option to use sqlite by environement variables.  The app currently uses drizzle and drizzle has options for sqlite.  Keep the same database structure for both databases

## Navbar
create a spec that creates a navbar which will have the icon and app name which will bring you to the home page.  It will also contain the theme toggle, and when a user is logged in, a logout button which will redirect you to the home page

## user home page
create a spec for creating a user home page that welcome's the user by their display name and has a logout button in the navbar.  This user home page will be the page that the login button will redirect to after a successful login.  The logout button will redirect to the app home page.  This page should just show some basic placeholder elements for now.

## add tests
create a spec for adding tests to the backend and the frontend using vitest. The focus should be on testing critical features and high-risk logic.  But any logic that makes sense to test should be tested too.