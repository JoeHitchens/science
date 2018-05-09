

fs = require("fs");

XLSX = require("xlsx");

sleepless = require("sleepless");




argv = process.argv;
if(argv.length < 3) {
	log("Usage: node ss_merge.js file1 [file2 ...]");	
	process.exit(1);
};





