# SeaPerch Competition Board

this is the repository for a leaderboard i made in five hours for a seaperch competition because i was asked to fix some code in a program that we were previously using; unfortunately, it wasn't able to be used because there was too much setup to perform in too little time (i was only given the opportunity the day before the competition)

however, it is going to be used for the next competition, so i have a *year* to improve it and make it the *definitive* leaderboard program for seaperch competitions (and maybe even get it adopted internationally – i can only hope for the latter)



---



TO-DO:
- delete current backend server
- write backend network protocol for tls using rust (or some other low-level language; maybe c, maybe not because i can't readily test on a windows computer) & connect to either a custom database solution (i may make one for this because i might have the time) or just use sqlite3
- write webserver in node and python (and maybe some other languages) to give options to whomever is hosting it
- make electron app for ui (because i can)
- add front-end admin panel so you don't have to rely on a vibe-coded REPL (i was tired and wanted to go to sleep)
- build an actual REPL for admin commands using proper methods and not just overriding node's default `node:repl` stuff
- add more export options (& don't rely on `exceljs` because it's outdated and unsafe)
- refactor frontend (maybe)
- add in more customization
- add in a real authentication system
- figure out more cool things to add



---


## HOW TO USE IN ITS CURRENT STATE
currently, to use it, you **must** generate ssl credentials (use something like openssl); key is `server.key`, and certificate is `server.crt`

locate `populate.js` and modify the team data to match yours

add in your score computation data in `computeScores.js` (i was unsure how to calculate scores at that point, so i didn't)

run via `node server.js` and visit `https://localhost/`

in `public/`, there is a schedule which you can modify to be your schedule; simply go into the javascript and modify the objects for mission objective and the obstacle course to match yours. i added in as many options as i could for things, but it may be lacking.



---



as previously mentioned, this was made in five hours and had ssl support hastily added in at the last minute (and i had even forgotten to add support for bonus points).

help with the repl commands can be found by running `help` while running the server; disconnect from it by doing `^D^C` (ctrl + d, ctrl + c)
