
fs = require("fs");
path = require("path");
zlib = require("zlib");
exec = require("child_process").exec;

require("sleepless");
require("meet");



data_in = process.argv[2] || "data_in";
data_out = process.argv[3] || "data_out";
assay_file = process.argv[4] || "assayinfo.txt";
probe_file = process.argv[5] || "probeinfo.txt";
log("data_in="+data_in);
log("data_out="+data_out);
log("assay_file="+assay_file);
log("probe_file="+probe_file);


String.prototype.reverse = function() {
	var o = '';
	for (var i = this.length - 1; i >= 0; i--)
		o += this[i];
	return o;
}


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

var rev_comp = function(s, b) {
	return s
		.reverse()
		.replace( /A/g, "t" )
		.replace( /C/g, "g" )
		.replace( /G/g, "c" )
		.replace( /T/g, "a" )
		.replace( /\]/g, "{" )
		.replace( /\[/g, "}" )
		.replace( /\}/g, "]" )
		.replace( /\{/g, "[" )
		.toUpperCase();
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

		var counts = [];
		for(var k in hash) { 
			counts.push([k, hash[k]]);
		}

		counts = counts.sort(function(a, b) {
			if(a[1] < b[1]) return  1;
			if(a[1] > b[1]) return -1;
			return 0;
		});
		// delete hash ?

		// ---------- write out hashes to file
		var fd = fs.openSync( outpath + ".hash", "w" );
		counts.forEach(function(a, i) {
			fs.writeSync(fd, ">;" + (i + 1) + ";" + a[1] + "\n" + a[0] + "\n");
		});
		fs.close(fd);


		//	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-


		// ---------- read in assay info file (tab delimted text)
		var s = fs.readFileSync( assay_file, "utf8" );
		var lines = s.trim().split( "\n" );
		log("  assay info lines="+lines.length);

		var assays = [];
		var fwd_seq = [];
		var probe1 = [];
		var probe2 = [];
		var probe1rc = [];
		var probe2rc = [];
		lines.forEach(function(line) {

			var cols = line.split( /\s+/ );

			assays.push(cols[0]);
			fwd_seq.push(cols[1]);
			probe1.push(cols[2]);
			probe2.push(cols[3]);
			probe1rc.push(rev_comp(cols[2]));
			probe2rc.push(rev_comp(cols[3]));

		});


		var fwd_count = [];
		var probe_count = [];
		var both_count = [];

		for(var i = 0; i < assays.length; i++) {
			fwd_count[i] = 0;
			probe_count[i] = 0;
			both_count[i] = 0;

			var rx_f = new RegExp( fwd_seq[i] );
			var rx_p = new RegExp( "("+probe1[i]+"|"+probe2[i]+"|"+probe1rc[i]+"|"+probe2rc[i]+")" );

			counts.forEach(function(a) {
				var r1_seq = a[0];		// nucleotide sequence
				var count = a[1];		// # of occurances

				var m1 = rx_f.test(r1_seq);
				if( m1 ) {
					fwd_count += count;
				}

				var m2 = rx_p.test( r1_seq );
				if(m2) {
					probe_count[i] += count;
				}

				if(m1 && m2) {
					both_count[i] += count;
				}

			});
		}

		// ---------- write out csv  ... ?
		var fd = fs.openSync( outpath + ".hash.csv", "w" );
		for(var i = 0; i < assays.length; i++) {
			fs.writeSync( fd, [assays[i],fwd_count[i],probe_count[i],both_count[i]].join(",") + "\n" );
		}
		fs.close(fd);



		//	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-
		// genotyper 

		var on_target = [];
		var off_target = [];
		var f_primer = [];
		var f_primerkey = [];
		var allele1name = [];
		var allele2name = [];
		var probea1 = [];
		var probea2 = [];
		var probea1_rc = [];
		var probea2_rc = [];
		var allele1_count = [];
		var allele2_count = [];
		var a1_corr = [];
		var a2_corr = [];
		var print_line = [];
		var ot_reads = 0;
		var raw_reads = 0;
		var unmatched = 0;

		var lines = fs.readFileSync(probe_file, "utf8").trim().split("\n");
		log("  probe info lines="+lines.length);

		lines.forEach(function(line) {
			var info = line.trim().split(",");
			var k = info[0];

			f_primer[k] = info[5].substr(0, 14);		// why only 14 ?
			f_primerkey[f_primer[k]] = k;

			allele1name[k] = info[1];
			allele2name[k] = info[2];

			probea1[k] = info[3];
			probea2[k] = info[4];
			probea1_rc[k] = rev_comp(info[3])
			probea2_rc[k] = rev_comp(info[4]);

			a1_corr[k] = toFlt(info[6]);
			a2_corr[k] = toFlt(info[7]);


			// init allele counts to 0
			allele1_count[k] = 0;
			allele2_count[k] = 0;
			on_target[k] = 0;
			off_target[k] = 0;
		});


		// count alleles
		seqs.forEach(function(seq) {
			var r1_seq = seq.letters;
			var fp_seq = r1_seq.substr(0, 14);
			raw_reads += 1;
			if(f_primerkey[fp_seq] !== undefined) {
				var target = f_primerkey[fp_seq];

				var rx1 = new RegExp( "(" + probea1[target] + "|" + probea1_rc[target] + ")" );
				var rx2 = new RegExp( "(" + probea2[target] + "|" + probea2_rc[target] + ")" );
				if(rx1.test(r1_seq)) {
					allele1_count[target] += 1;
					on_target[target] += 1;
					ot_reads += 1;
				}
				else
				if(rx2.test(r1_seq)) {
					allele2_count[target] += 1;
					on_target[target] += 1;
					ot_reads += 1;
				}
				else {
					off_target[target] += 1;

					// XXX fuzzy matching stuff here

				}

			}
			else {
				unmatched += 1;
				//log("----"+fp_seq);
			}

		});
		log("unmatched="+unmatched);

		if(ot_reads == 0)
			ot_reads = 1;

		var ot_percentage = 0;
		if(raw_reads > 0) 
			ot_percentage = (Math.round(ot_reads / raw_reads) * 1000) / 10;


		var hom_ct = 0;
		var bkgrd_ct = 0;
		var ifi = 0;

		for(var k in f_primer) {
			var a1fix = 0;
			var a2fix = 0;
			var sum_xy = allele1_count[k] + allele2_count[k];
			allele1_count[k] = allele1_count[k] - (sum_xy / 4 * a1_corr[k]);
			if(allele1_count[k] < 0)
				allele1_count[k] = 0;
			allele2_count[k] = allele2_count[k] - (sum_xy / 4 * a2_corr[k]);
			if(allele2_count[k] < 0)
				allele2_count[k] = 0;

			allele1_count[k] = toInt( allele1_count[k] );
			allele2_count[k] = toInt( allele2_count[k] );
			
			var geno = "00";		// init genotype var
			var genoclass = "NA"	// init genotype classification

			a1fix = allele1_count[k] || 0.1;
			a2fix = allele2_count[k] || 0.1;

			var ratio = Math.round((a1fix / a2fix) * 1000) / 1000;

			if(allele1_count[k] + allele2_count[k] < 10) {
				geno = "00";
				genoclass = "NA";
			}
			else
			if(ratio >= 10) {
				geno = allele1name[k]+allele1name[k];
				genoclass = "A1HOM";	// Allele1 Homozygotes
				hom_ct += allele1_count[k];
				bkgrd_ct += allele2_count[k];
			}
			else
			if(ratio < 10 && ratio > 5) {
				geno = "00";
				genoclass = "NA";	// In-betweeners
				hom_ct += allele1_count[k];
				bkgrd_ct += allele2_count[k];
			}
			else 
			if(ratio <= 0.1) {
				geno = allele2name[k]+allele2name[k];
				genoclass = "A2HOM";	// Allele2 Homozygotes
				hom_ct += allele2_count[k];
				bkgrd_ct += allele1_count[k];
			}
			else
			if(ratio <= 0.5) {
				geno = "00";
				genoclass = "NA";
				hom_ct += allele2_count[k];
				bkgrd_ct += allele1_count[k];
			}
			else
			if(ratio <= 2) {
				geno = allele1name[k]+allele2name[k];
				genoclass = "HET";	// Heterozygotes
			}

			if(sum_xy == 0)
				sum_xy = 0.1;
			
			if(off_target[k] == 0)
				off_target[k] = 0.1;

			var on_target_per = (on_target[k] / (off_target[k] + on_target[k] )) * 100;
			var per_of_allotreads = (on_target[k] / ot_reads) * 100;

			on_target_per = Math.round(on_target_per * 10) / 10;
			per_of_allotreads = Math.round(per_of_allotreads * 1000) / 1000;
			print_line[k] = [k, allele1name[k]+"="+allele1_count[k], allele2name[k]+"="+allele2_count[k], ratio, geno, genoclass, a1_corr[k], a2_corr[k], on_target[k], on_target_per, per_of_allotreads, 0, 0].join(",");

		}

		if(hom_ct == 0)
			hom_ct = 1;
		ifi = (bkgrd_ct / hom_ct) * 100;
		ifi = Math.round(ifi * 100) / 100;
		log( "IFI_score:"+ifi);


		var fd = fs.openSync( outpath + ".genos", "w" );
		fs.writeSync( fd, [file,"Raw-Reads:"+raw_reads,"On-Target reads:"+ot_reads,"%On-Target:"+ot_percentage].join(",") + "\n" );
		for(var k in f_primer) {
			fs.writeSync( fd, print_line[k] + "\n" );
		}
		fs.close(fd);


		//	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-


		cb();		// finish 
	});
}



