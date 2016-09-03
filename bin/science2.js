
fs = require("fs");
path = require("path");
zlib = require("zlib");
exec = require("child_process").exec;

require("sleepless");
require("meet");


// return a reversed version of a string: srev = "foo".reverse();	// "oof"
String.prototype.reverse = function() {
	var o = '';
	for (var i = this.length - 1; i >= 0; i--)
		o += this[i];
	return o;
}


// return the reverse complement version of the nucleotide sequence in "s"
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


data_in = process.argv[2] || "data_in";
data_out = process.argv[3] || "data_out";
assay_file = process.argv[4] || "assayinfo.txt";
probe_file = process.argv[5] || "probeinfo.txt";
//log("data_in="+data_in);
//log("data_out="+data_out);
//log("assay_file="+assay_file);
//log("probe_file="+probe_file);


// read in assay info file (tab delimted text)
var data = fs.readFileSync( assay_file, "utf8" ).trim().split( "\n" );
//log("  assay info lines="+data.length);
var assays = [];
//var fwd_seq = [];
//var probe1 = [];
//var probe2 = [];
//var probe1rc = [];
//var probe2rc = [];
data.forEach(function(line) {

	var cols = line.split( /\s+/ );

	var o = {};

	o.name = cols[0].trim();

	o.fwd_seq = cols[1].trim();
	o.fwd_seq_rc = rev_comp(o.fwd_seq);

	o.probe1 = cols[2].trim();
	o.probe1_rc = rev_comp(o.probe1);

	o.probe2 = cols[3].trim();
	o.probe2_rc = rev_comp(o.probe2);

	o.fwd_count = 0;
	o.probe_count = 0;
	o.both_count = 0;

	assays.push(o);

	/*var s = cols[0].trim();
	assays.push(s);

	var s = cols[1].trim();
	fwd_seq.push(s);
	fwd_seq_rc.push(rev_comp(s));

	var s = cols[2].trim();
	probe1.push(s);
	probe1_rc.push(rev_comp(s));

	var s = cols[3].trim();
	probe2.push(s);
	probe2_rc.push(rev_comp(s));
	*/

});



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

var probe_info = fs.readFileSync(probe_file, "utf8").trim().split("\n");
//log("  probe info lines="+probe_info.length);

probe_info.forEach(function(line) {
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




// scan data_in for any files, in any sub-directories that end with .fasq.gz
// XXX This exec() won't work on windows; walk the tree manually instead
cmd = "find \""+data_in+"\" | grep .fastq.gz";
exec(cmd, function(err, stdout, stderr) {
	throwIf(err);

	files = stdout.trim().split("\n");		// split the output of the find command into an array of lines, on per file
	log("Input directory \""+data_in+"\" contains "+files.length+" .fastq.gz files");

	// queue each .fastq.gz for processing by do_science()
	var m = new Meet();
	files.forEach(function(file) {
		m.queue(do_science, file);
	});
	m.allDone(process.exit);		// exit program when all are done.

});


// read the compressed file at "inpath" and write it back out to "outpath", call cb() when done
gunzip = function(inpath, outpath, cb) {

	// XXX This exec() won't work on windows; make the zlib version of this work
	var cmd = "gunzip < \"" + inpath + "\" > \"" + outpath + "\"";
	exec(cmd, function(err, stdout, stderr) {
		throwIf(err);
		fs.readFile(outpath, "utf8", function(err, text) {		// read in the uncompressed file as 'text'
			throwIf(err);
			fs.unlink(outpath, function(err) {					// delete uncompressed file from disk (it was temporary)
				throwIf(err);
				cb(text);										// pass 'text' to the callback function
			})
		});
	});

}


// process a single fish from the file at "inpath"; call cb() when finished.
do_science = function(inpath, cb) {								// inpath: "foo/bar/file.gz"

	var file = path.basename(inpath);							// file: "file.gz"
	var outpath = data_out + "/" + file.replace( /\.gz$/, "" );	// outpath: "data_out/file"


	// uncompress and load in the fastq data
	gunzip(inpath, outpath, function(data) {

		if(data == "") {
			log("skipping empty input file \""+file+"\".");
			cb();
			return;
		}


		//	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-
		// convert the raw fastq data into an array of objects, one per sequence.
		//	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-

		// break the data into lines
		var lines = data.trim().split("\n");

		var sequences = [];
		for(var i = 0; i < lines.length; i += 4) {
			throwIf(lines[i+2].trim() != "+");	// sanity check - expect this line to contain just a "+" sign
			sequences.push({
				// info: lines[i+0].trim(),		// unused
				sequence: lines[i+1].trim(),
				// plus: lines[i+2].trim(),		// unused
				//quality: lines[i+3].trim(),	// unused
			});
		}
		log("processing \""+file+"\" ("+sequences.length+" sequences)");
		// 'sequences' now looks like: [ { sequence: "ACTG" }, { ... }, ... ]



		//	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-
		// Build an array of counts, one entry per sequence, sorted by count, highest to lowest
		//	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-

		// Create a hash with one entry per sequence, where the sequence is the nucleotide sequence,
		// and the value is the number of times that sequence appears in the fastq data.
		var hash = {};
		for(var i = 0; i < sequences.length; i++) {
			var key = sequences[i].sequence;
			hash[key] = toInt(hash[key]) + 1;
		}
		// hash: { "ACTG...": 123, "GTCA...": 456, ... }

		// convert the hash into an array.
		// Each array entry is itself an array, first entry being the sequence, and second being the count.
		var sequence_counts = [];
		for(var k in hash) { 
			sequence_counts.push([k, hash[k]]);
		}

		// sort them
		sequence_counts.sort(function(a, b) {
			if(a[1] < b[1]) return  1;
			if(a[1] > b[1]) return -1;
			return 0;
		});
		// delete hash ?

		// ---------- write out hashes to file
		var fd = fs.openSync( outpath + ".hash", "w" );
		sequence_counts.forEach(function(a, i) {
			fs.writeSync(fd, ">;" + (i + 1) + ";" + a[1] + "\n" + a[0] + "\n");
		});
		fs.close(fd);
		//log("done hashing");

		// 'sequence_counts' now looks like: [ [ "GTCA", 456 ], [ "ACTG", 123 ], ... ]



		//	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-
		// count occurances of fwd sequence and it's RC, probes (and their RCs), and occurances of both
		//	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-

		assays.forEach(function(a) {

			var rx_fs = new RegExp( a.fwd_seq );
			var rx_fs_rc = new RegExp( a.fwd_seq_rc );
			var rx_p = new RegExp( "("+a.probe1+"|"+a.probe2+")" );
			var rx_p_rc = new RegExp( "("+a.probe1_rc+"|"+a.probe2_rc+")" );

			sequence_counts.forEach(function(a) {
				var seq = a[0];		// nucleotide sequence
				var num = a[1];		// # of occurances

				var m1 = rx_fs.test(seq) || rx_fs_rc.test(seq);
				if( m1 ) {
					a.fwd_count += num;
					//log("fwd  match: "+a.name);
				}

				var m2 = rx_p.test( seq ) || rx_p_rc.test( seq );
				if( m2 ) {
					a.probe_count += num;
					//log("probe match: "+a.name);
				}

				if(m1 && m2) {
					a.both_count += num;
					//log("both match: "+a.name);
				}


			});
		});

		// write counts out to csv file
		var fd = fs.openSync( outpath + ".hash.csv", "w" );
		fs.writeSync( fd, [ "Name", "Fwd count", "Probe count", "Both count" ].join(",") + "\n" );
		assays.forEach(function(a) {
			fs.writeSync( fd, [ a.name, a.fwd_count, a.probe_count, a.both_count ].join(",") + "\n" );
		});
		fs.close(fd);



		//	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-
		// genotyper 
		//	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-

		// count alleles
		sequences.forEach(function(seq) {
			var r1_seq = seq.sequence;
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
			}

		});
		//log("unmatched="+unmatched);

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
		log( "hom_ct="+hom_ct+" bkgrd_ct="+bkgrd_ct );
		log( "IFI_score:"+ifi );


		// sex stuff
		var primer_counts = 0;
		var counts = 0;

		sequences.forEach(function(seq) {
			var seq = seq.sequence;
			if(seq.indexOf("CACAACATGAGCTCATGGG") == 0) {
				primer_counts += 1;
				var rx = new RegExp( "CCTACCAAGTACA" );
				if( rx.test(seq) ) {
					counts++;
				}
			}
		});

		if(primer_counts == 0)
			primer_counts = 1;

		var primerot = (counts / primer_counts) * 100;
		primerot = Math.round(primerot * 1000) / 1000;

		var perofallotreads = (counts / ot_reads) * 100;
		perofallotreads = Math.round(perofallotreads * 1000) / 1000;

		var cntrl_counts = toInt(ot_reads * 0.004);
		if(cntrl_counts == 0)
			cntrl_counts = 1;

		if(counts == 0)
			counts = 1;

		var ratio = Math.round((cntrl_counts / counts) * 1000) / 1000;

		var sex_geno = "00";
		var geno_class = "NA";

		if(cntrl_counts + counts < 10) {
			sex_geno = "00";
			geno_class = "NA";
		}
		else
		if(ratio >= 10) {
			sex_geno = "XX";
			geno_class = "A1HOM";
		}
		else
		if(ratio <= 0.1) {
			sex_geno = "XY";
			geno_class = "A2HOM";
		}
		else
		if(ratio <= 0.2) {
			sex_geno = "00";
			geno_class = "NA";
		}
		else
		if(ratio <= 5) {
			sex_geno = "XY";
			geno_class = "HET";
		}


		var fd = fs.openSync( outpath + ".genos", "w" );

		fs.writeSync( fd, [file,"Raw-Reads:"+raw_reads,"On-Target reads:"+ot_reads,"%On-Target:"+ot_percentage].join(",") + "\n" );
		for(var k in f_primer) {
			fs.writeSync( fd, print_line[k] + "\n" );
		}

		fs.writeSync( fd, "Ots_SEXY3-1,X="+cntrl_counts+",Y="+counts+","+ratio+","+sex_geno+","+geno_class+",0,0,"+counts+","+primerot+","+perofallotreads );

		fs.close(fd);


		//	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-


		var flag = "S";
		var geno_thresh = 0;


		var out = [];
		var s = "Sample,Raw Reads,On-Target Reads,%On-Target,%GT,IFI";
		probe_info.forEach(function(pi) {
			var a = pi.trim().split(",");
			s += "," + a[0];
		});
		log(s);


		//	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-


		cb();		// finish 
	});
}



