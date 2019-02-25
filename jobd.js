
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// Fishy Science Daemon Version 1
// Copyright 2017 Sleepless Software Inc. All Rights Reserved
// Author: Joe Hitchens <joe@sleepless.com>
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

// This script doesn't do the actual analysis.
// It just moves job dirs around, and starts
// the actual analysis script as needed, then collects and
// stores the output, errors, etc.


// Standard node.js modules
var os = require("os");
var fs = require("fs");
var util = require("util");
var fs = require("fs");
var path = require("path");
var spawnSync = require("child_process").spawnSync;

// Sleepless Inc. modules
require("sleepless");
require("g")("log5");


// -----------------------------
// Misc. supporting functions
// -----------------------------

// Writes out an object in semi-readable form for debugging purposes
var dump = function(o) {
	I(util.inspect(o), 3);
}

// Return true if the path is a directory
var is_dir = function(path) {
	try { return fs.statSync(path).isDirectory(); } catch(e) { }
	return false;
}

// Delete a file/folder
var clobber_file = function(path) {
	try { fs.unlinkSync(path); } catch(e) { }
}

// Replace newlines with CR/LF in a string and return it, but only if we're running under Windows.
var add_crs = function(s) {
	if(os.platform() == "win32") {
		return s.replace(/\n/g, "\r\n");
	}
	return s;
}


// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


var working = 0;		// number of jobs currently in working state


// Start processing a job folder called "name"
var start = function(name) {

	working += 1;

	I("JOB \""+name+"\" starting");

	fs.renameSync("start/"+name, "working/"+name);		// Move the job from "start" to "working" dir

	// Delete log.txt and errors.txt if present.
	clobber_file("working/"+name+"/log.txt");
	clobber_file("working/"+name+"/errors.txt");

	// Start the analysis script.
	// XXX As long as this is using spawnSync, it's probably not leveraging multiple cpus.
	// XXX the cpu leveraging should be done in the science.js world anyway, since
	// XXX this is probably never going to be running multiple jobs at once.
	var r = spawnSync("node", [script], {
		cwd: "working/"+name,			// Set the new process's cwd to the job dir.
		timeout: 1000 * 60 * 60,		// kill it if it runs longer than 1 hour
		maxBuffer: 1000000,
		encoding: "utf8",
	});

	var ec = r.status;		// grab the exit code of the child process

	// Add CR chars to stdout and stderr strings if we're running on windows (ew)
	r.stdout = add_crs(r.stdout);
	r.stderr = add_crs(r.stderr);

	// Move the job dir to appropriate place.
	if(ec == 0) {
		// Normal exit code.  Move to "finished"
		I("JOB \""+name+"\" finished");
		fs.writeFileSync("working/"+name+"/log.txt", r.stdout)
		fs.renameSync("working/"+name, "finished/"+name)
	}
	else {
		// Abnormal exit code.  Move to "failed"
		E("JOB \""+name+"\" **FAILED**");
		fs.writeFileSync("working/"+name+"/log.txt", r.stdout)
		fs.writeFileSync("working/"+name+"/errors.txt", r.stderr)
		fs.renameSync("working/"+name, "failed/"+name)
	}

	working -= 1;
};


var tick = function() {
	V("(working on "+working+" jobs)");

	if(working < num_cpus) {		// are there fewer jobs than there are CPUs available?
		// Yes, so start the next job that we see.

		// scan through the files seen in "start"
		var files = fs.readdirSync("start")
		for(var i = 0; i < files.length; i++) {
			var name = files[i];
			if(is_dir("start/" + name)) {		// Is this one a dir?
				// Yes, so assume it's a job and start processing it.
				start(name);
				break;							// Done. Look no further.
			}
		}
	}
};


// start the daemon running
I("FISHY SCIENCE JOB DAEMON");
var num_cpus = os.cpus().length;
I("Platform "+os.type()+" ("+os.platform()+") "+os.arch()+" "+num_cpus+"-CPUS");
I("Starting "+(new Date()));
//var script = process.argv[1].replace( /[^\/]+$/, "science3.js")
var script = process.cwd() + "/science3.js";
V("script="+script);

process.chdir("./jobs");			// change current working dir to the jobs dir
setInterval(tick, 5 * 1000);		// start looking for new jobs every 5 seconds.




