
fs = require("fs");
path = require("path");
zlib = require("zlib");
exec = require("child_process").exec;

require("sleepless");
require("meet");



data_in = process.argv[2] || "data_in";
data_out = process.argv[3] || "data_out";
//log("data_in="+data_in);
//log("data_out="+data_out);

// scan data_in for an files, in any dirs that end with .fasq.gz
cmd = "find \""+data_in+"\" | grep .fastq.gz";
exec(cmd, function(err, stdout, stderr) {
	throwIf(err);

	files = stdout.trim().split("\n");

	log("Directory "+data_in+" contains "+files.length+" .fastq.gz files");

	// queue each .fastq.gz for processing by do_science()
	var m = new Meet();
	//files = [files[0], files[1]];
	files.forEach(function(file) {
		m.queue(do_science, file);
	});
	m.allDone(process.exit);

});


gunzip = function(inpath, outpath, cb) {

	// xxx make the zlib version of this work

	var cmd = "gunzip < \"" + inpath + "\" > \"" + outpath + "\"";
	exec(cmd, function(err, stdout, stderr) {
		throwIf(err);
		fs.readFile(outpath, "utf8", function(err, text) {
			throwIf(err);
			cb(text);
		});
	});

	/*
	var reader = fs.createReadStream(inpath);
	var writer = fs.createWriteStream(outpath);
	var unzipper = zlib.createGunzip();
	reader.pipe(unzipper).pipe(writer);
	reader.on("end", function() {
		log("r end");
	});
	writer.on("end", function() {
		log("w end");
	});
	reader.on("error", function(err) {
		log("r error: "+err);
	});
	writer.on("error", function(err) {
		log("w error: "+err);
	});
	*/
}


do_science = function(inpath, cb) {
	var file = path.basename(inpath);
	var outpath = data_out + "/" + file.replace( /\.gz$/, "" );
	
	log("inpath: "+inpath);
	log("outpath: "+outpath);

	gunzip(inpath, outpath, function(text) {
		log("text = "+text.length);

		if(text == "") {
			log("(empty)");
			cb();
			return;
		}

		var lines = text.trim().split("\n");
		log("lines: "+lines.length);
		delete text;

		var seqs = [];
		for(var i = 0; i < lines.length; i += 4) {
			throwIf(lines[i+2].trim() != "+");
			seqs.push({
				// info: lines[i+0].trim(),
				letters: lines[i+1].trim(),
				// plus: lines[i+2].trim(),
				quality: lines[i+3].trim(),
			});
		}
		delete lines;
		log("seqs: "+seqs.length);

		var hash = {};
		for(var i = 0; i < seqs.length; i++) {
			var seq = seqs[i];
			var key = seq.letters;
			hash[key] = toInt(hash[key]) + 1;
		}

		var a = [];
		for(var k in hash) { 
			a.push([k, hash[k]]);
		}

		a = a.sort(function(a, b) {
			if(a[1] < b[1]) return  1;
			if(a[1] > b[1]) return -1;
			return 0;
		});
		// delete hash ?

		var fd = fs.openSync( outpath + ".hash", "w" );
		a.forEach(function(a2, i) {
			//log(">;"+(i+1)+";"+a2[1]+"\n"+a2[0]);
			//writer.write( ">;" + (i + 1) + ";" + a2[1] + "\n" + a2[0] + "\n");
			fs.writeSync(fd, ">;" + (i + 1) + ";" + a2[1] + "\n" + a2[0] + "\n");
		});
		fs.close(fd);

		cb();		// finish 
	});
}



