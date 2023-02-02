# BiSync

### Bidirectional directory synchronization for software development

Bisync allows directories of shared code to be synchronized generally in a
mono-repo.  It can also be useful for synchronizing an npm project which you
are developing locally with a project that consumes it.

## Usage
```
npm install --only=dev bisync
```
If you have a mono-repo with many sub-directories each of which has it's own
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
array of directories to be synchronized with that group.  Recursion is not
supported at present.

The first group shows two sub-projects in a mono-repo each of which has
directory called common for common source files.  The second one shows a
node_module called mymodule which are actively developing and want to keep
updated when you build it.  This let's you test changes in a target project
without publishing.
## Background Processing
bisync runs as daemon.  Normally you would let it run forever and start and
stop synchronization of particular project configurations when you check out
or create projects.  If bisync detects that the project is removed (because
the bisync.json file is deleted) it will stop synchronizing directories
specified in that bisync.json file so you never need to stop it.

bisync will save the name of all config files in a .bisync file in your home
directory so that you only need start it once from within any of the
projects that use it and all projects will then be synchronized.

## Commands

You would typically place these scripts in the root of your project
```
  "scripts": {
    "bisync": "bisync config=bisync.json"
  },
```
Then you can start synchronization with:
```
npm bisync
```
