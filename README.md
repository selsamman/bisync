# BiSync

### Bidirectional Directory Synchronization for Source Repositories

Bisync allows directories of shared code to be synchronized in both 
directions.  Specific use cases include common code in a mono-repo and for 
keeping projects that consume an NPM module that is under active development 
in sync without having to publish incremental changes.

## Usage
```
npm install bisync --save-dev
```
If you have a mono-repo with many subdirectories each of which has it's own
npm folder and package.json install this at the root even if it is the only
node module at the root.
## Configuration
Create a bisync.json in the route directory
```
[
    [
        "./subproj1/src/common",
        "./subproj2/src/common",
    ],
    [
        "./subproj1/node_modules/mymodule",
        "../mymodule/build"
    ]
]
```
The JSON file is an array of directory groups.  Each group is simply an
array of directories to be synchronized within that group.  Synchronization 
occurs recursively.

The first group in the example shows two subprojects in a mono-repo, each of 
which has directory called common for common source files.  The second one shows a
node_module being developed and project that consumes it that is to be kept 
up-to-date as the node_module is changed and rebuilt.
## Background Processing
Bisync runs as a daemon on port 3111.  It can handle multiple 
configuration files from multiple projects at the same time. 
You simply add and remove configuration files as needed.  If bisync detects 
that the project is removed (because the configuration file is 
deleted) it will stop synchronizing directories
specified in that configuration file.

By naming your configuration file bisync.json, the synchronization will be 
started automatically when bisync is installed so team members working on 
the project don't need to explicitly start bisync.
## Commands

```
npx bisync watch=<config-file>        to add a configuration file to be watched
npx bisync forget=<config-file>       to stop watching directories in config file 
npx bisync stop                       to stop the daemon 
npx bisync start                      to restart the daemon (with all previous watches)
npx bisync status                     show status of daemon and which config files are in effect
npx bisync install                    prepare your system to automatically start bisync on login  
```
## Automating its use in a repo

Bisync is automatically started upon installation and looks for a 
config called bisync.json.  The package.json referring to bisync in its 
devDependencies should both be in the root of the monorepo.

However if your system is shutdown and restarted, the daemon won't 
automatically run unless you install a script to start upon login.  This 
command can be used to insert an '''npx bisync start``` in the appropriate 
folder based on your system (Macos, Windows). 

```
npx bisync install
```
* Under windows it will add a start_bisync.bat file to 
  C:\Users\<user-id>\AppData\Roaming\Microsoft\Windows\Start 
  Menu\Programs\Startup
* In osx it will create ~/start_bisync.command to ~/ and you must then go to 
  Preferences > Users & Groups and select your user name.  Then you can add 
  this command file to login items 

Do not try and start bisync at system startup since it needs to be run as 
the user that owns the files to be synced.  It is not designed to be run as 
root.
## Logging
If needed you can enable logging
```
npx bisync log=<logfile>
```
## Limitations
bisync is intended for source code repositories.  It is not a general 
purpose synchronization mechanism.  Among it's limitations are:
* Not handling symlinks
* Not handling file attributes such as read-only or executable
* Not handling ownership of files
