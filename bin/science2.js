
fs = require("fs");
path = require("path");
zlib = require("zlib");
exec = require("child_process").exec;

require("sleepless");
require("meet");


// returns a reversed version of a string: "foo" becomes "oof"
String.prototype.reverse = function() {
	var o = '';
	for (var i = this.length - 1; i >= 0; i--)
		o += this[i];
	return o;
}


// return the reverse complement version of the nucleotide sequence in "s": "ACTG" becomes "CAGT"
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


// return a percentage as a number to 2 decimal places: mk_pct(6, 2) returns 33.33 (2 is 33.33% of 6)
var mk_pct = function(t, f) {
	if(f <= 0) {
		return 0;
	}
	return Math.round((f / t) * 10000) / 100;
}


data_in = process.argv[2] || "data_in";
data_out = process.argv[3] || "data_out";
assay_file = process.argv[4] || "assayinfo.txt";
probe_file = process.argv[5] || "probeinfo.txt";


// read in assay info file (tab delimted text)
var assays = [];
fs.readFileSync( assay_file, "utf8" ).trim().split( "\n" ).forEach(function(line) {
	var cols = line.split( /\s+/ );

	var a = {};

	a.name = cols[0].trim();

	a.fwd_prm = cols[1].trim();
	a.fwd_prm_rc = rev_comp(a.fwd_prm);

	a.probe1 = cols[2].trim();
	a.probe1_rc = rev_comp(a.probe1);

	a.probe2 = cols[3].trim();
	a.probe2_rc = rev_comp(a.probe2);

	a.fwd_count = 0;
	a.probe_count = 0;
	a.both_count = 0;

	assays.push(a);
});
assays.sort(function(a, b) {
	if(a.name.toLowerCase() > b.name.toLowerCase()) return 1;
	if(a.name.toLowerCase() < b.name.toLowerCase()) return -1;
	return 0;
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
var unmatched = 0;

var probe_info = fs.readFileSync(probe_file, "utf8").trim().split("\n");
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



// scan "data_in" for any files, in any sub-directories that end with .fasq.gz
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
	m.queue(geno_compile);
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


// process a single fish from the file at "inpath"; call finish() when finished.
do_science = function(inpath, finish) {								// inpath: "foo/bar/file.gz"

	var file = path.basename(inpath);							// file: "file.gz"
	var outpath = data_out + "/" + file.replace( /\.gz$/, "" );	// outpath: "data_out/file"


	// uncompress and load in the fastq data
	gunzip(inpath, outpath, function(data) {

		if(data == "") {
			log("skipping empty input file \""+file+"\".");
			finish();
			return;
		}


// -	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-
// convert the fastq data into an array of objects, one per sequence.

		var lines = data.trim().split("\n");	// break the data into lines

		var sequences = [];
		for(var i = 0; i < lines.length; i += 4) {
			throwIf(lines[i+2].trim() != "+");	// sanity check - expect this line to contain just a "+" sign
			sequences.push({
				// info: lines[i+0].trim(),		// currently unused
				sequence: lines[i+1].trim(),
				// plus: lines[i+2].trim(),		// currently unused
				//quality: lines[i+3].trim(),	// currently unused
			});
		}
		log("processing \""+file+"\" ("+sequences.length+" sequences)");

		// 'sequences' now looks like: [ { sequence: "ACTG" }, { ... }, ... ]


// Build an array of counts, one entry per distinct sequence, sorted by count, highest to lowest
// -	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-

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

		// write out hashes to file
		var fd = fs.openSync( outpath + ".hash", "w" );
		sequence_counts.forEach(function(a, i) {
			fs.writeSync(fd, ">;" + (i + 1) + ";" + a[1] + "\n" + a[0] + "\n");
		});
		fs.close(fd);

		// 'sequence_counts' now looks like: [ [ "GTCA", 456 ], [ "ACTG", 123 ], ... ]



// count occurances of fwd sequence and it's RC, probes (and their RCs), and occurances of both
// -	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-

		assays.forEach(function(a) {

			var rx_fp = new RegExp( a.fwd_prm );			// matches the forward primer sequence
//			var rx_fp_rc = new RegExp( a.fwd_prm_rc );		// matches the RC of the forward primer sequence
			var rx_p1 = new RegExp( a.probe1 );				// matches the first probe sequence
//			var rx_p1_rc = new RegExp( a.probe1_rc );		// matches the RC of the first probe sequence
			var rx_p2 = new RegExp( a.probe2 );				// ditto probe2
//			var rx_p2_rc = new RegExp( a.probe2_rc );		// and RC of probe2

			sequence_counts.forEach(function(sc) {
				var seq = sc[0];		// nucleotide sequence
				var num = sc[1];		// # of occurances
				var m_f, m_p;

//				m_f = rx_fp.test(seq) || rx_fp_rc.test(seq);	// m_f is true if fwd primer or its RC is found
//				m_p = rx_p1.test( seq ) || rx_p2.test( seq ) || rx_p1_rc.test( seq ) || rx_p2_rc.test( seq );	// m_p is true if either probe1 or probe2 (or their RCs) are found
				m_f = rx_fp.test(seq);
				m_p = rx_p1.test( seq ) || rx_p2.test( seq );

				if(m_f) {
					a.fwd_count += num;
				}
				if(m_p) {
					a.probe_count += num;
				}
				if(m_f && m_p) {
					a.both_count += num;
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



// Let's give a big hand to the world renowned genotyper!
// -	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-

		// count alleles, ontarget, and off target reads
		sequences.forEach(function(seq) {
			var r1_seq = seq.sequence;
			var fp_seq = r1_seq.substr(0, 14);
			if(f_primerkey[fp_seq] !== undefined) {
				var target = f_primerkey[fp_seq];

				var rx_p1 = new RegExp( probea1[target] );
//				var rx_p1rc = new RegExp( probea1_rc[target] );
				var rx_p2 = new RegExp( probea2[target] );
//				var rx_p2rc = new RegExp( probea2_rc[target] );

				if( rx_p1.test(r1_seq) /*|| rx_p1rc.test(r1_seq)*/ ) {
					allele1_count[target] += 1;
					on_target[target] += 1;
					ot_reads += 1;
				}
				else
				if( rx_p2.test(r1_seq) /*|| rx_p2rc.test(r1_seq)*/ ) {
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

		if(ot_reads == 0)
			ot_reads = 1;

		var ot_percentage = 0;
		if(sequences.length > 0) 
			ot_percentage = (Math.round(ot_reads / sequences.length) * 1000) / 10;


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
			print_line[k] = [k, allele1name[k]+"="+allele1_count[k], allele2name[k]+"="+allele2_count[k], ratio, geno, genoclass, a1_corr[k], a2_corr[k], on_target[k], on_target_per, per_of_allotreads, "\"-\"", "\"-\""].join(",");

		}

		if(hom_ct == 0)
			hom_ct = 1;
		ifi = (bkgrd_ct / hom_ct) * 100;
		ifi = Math.round(ifi * 100) / 100;
		//log( "hom_ct="+hom_ct+" bkgrd_ct="+bkgrd_ct );
		log( "IFI_score:"+ifi );


		// do the sexy business
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


		// write out the .genos file
		var fd = fs.openSync( outpath + ".genos", "w" );
		fs.writeSync( fd, [file,"Raw-Reads:"+sequences.length,"On-Target reads:"+ot_reads,"%On-Target:"+ot_percentage,"IFI_score:"+ifi].join(",") + "\n" );
		for(var k in f_primer) {
			fs.writeSync( fd, print_line[k] + "\n" );
		}
		fs.writeSync( fd, "Ots_SEXY3-1,X="+cntrl_counts+",Y="+counts+","+ratio+","+sex_geno+","+geno_class+",0,0,"+counts+","+primerot+","+perofallotreads );
		fs.close(fd);


// -	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-
// All done 


		finish();
	});
}


var geno_compile = function(finish) {


	fs.readdir(data_out, function(err, f) {
		
		var files = [];
		f.forEach(function(filename) {
			if( /\.genos$/.test(filename) ) {
				var o = { filename:filename, lines:[] };
				var lines = fs.readFileSync(data_out+"/"+filename, "utf8").trim().split("\n");
				lines.forEach(function(line) {
					o.lines.push(line.trim().split(","));
				});
				files.push(o);
			}
		});
		// files now looks like: [ { filename:"foo.genos", lines: [ [ "word1", ... ], [ "word2", ... ] ... }, ... ]
		log("loaded "+files.length+" .genos files");


		// use the first file to output the assay names (whatever they are)
		var headings = "Sample,Raw Reads,On-Target Reads,%On-Target,%GT,IFI";
		var file = files[0];
		file.lines.forEach(function(line, i) {
			if(i == 0) return;		// skip the first line
			headings += ","+line[ 0 ];
		});
		headings += "\n";


		var compile = function(file, flag, thresh, output_filename) {

			var fd = fs.openSync( output_filename, "w" );
			fs.writeSync(fd, headings);

			files.forEach(function(file) {


				var raw_reads = 0;
				var on_target = 0;
				var gt_pct = 0;
				var ifi = 0;
				var sample_name = file.filename.replace( /\.genos$/, "" );

				var lines = file.lines;

				lines.forEach(function(line, i) {
					if(i == 0) {
						// first line
						raw_reads =  toInt(line[1].replace( /Raw-Reads:/, "" ));
						ifi =  toFlt(line[4].replace( /IFI_score:/, "" ));
					}
					else {
						// remaining lines
						if(line[4].match( /NA|00/)) {
							gt_pct += 1;
						}
						// Ots_110495-380,G=0,C=459,0,CC,A2HOM,1.7,0,790,97.2,1.473,"-","-"
						var count1 = toInt(line[1].split("=")[1]);		// 0 (G=0)
						var count2 = toInt(line[2].split("=")[1]);		// 459 (C=459)
						on_target += count1 + count2;
					}
				});


				var num_targets = lines.length - 1;
				gt_pct = 100 - mk_pct(num_targets, gt_pct); //gt_pct = (num_targets > 0) ? ((gt_pct / num_targets) * 100) : 0;

				log("rr="+raw_reads+" ot="+on_target);
				ot_pct = mk_pct(raw_reads, on_target); //ot_pct = (raw_reads > 0) ? ((on_target / raw_reads) * 100) : 0;

				var out = sample_name+","+raw_reads+","+on_target+","+ot_pct+","+gt_pct+","+ifi+",";

				lines.forEach(function(line, i) {
					if(i > 0) {
						var geno = line[4];
						var l_count = 0;
						var x1 = toInt(line[1].split("=")[1]);
						var x2 = toInt(line[2].split("=")[1]);
						l_count = x1 + x2;

						var numgt = "00";
						switch(line[5]) {
						case "A1HOM": numgt = "11"; break;
						case "HET": numgt = "12"; break;
						case "A2HOM": numgt = "22"; break;
						//case "NA": numgt = "00"; break;
						}
						/*if(g == "A1HOM") { numgt = "11" };
						if(g == "HET") { numgt = "12" };
						if(g == "A2HOM") { numgt = "22" };
						if(g == "NA") { numgt = "00" };*/

						if(flag == "S" && gt_pct >= thresh)
							out += geno+",";
						else
						if(flag == "C" && gt_pct >= thresh)
							out += l_count+",";
						else
						if(flag == "N" && gt_pct >= thresh)
							out += numgt+",";
						//else
						//	out += "\"-\",";

					}

				});

				out += "\n";

				fs.writeSync(fd, out);
			});

			fs.close(fd);
		}

		//compile(files, "S", 0, data_out+"/compiled.csv");					// this is same as compiled_snps.csv
		compile(files, "C", 0, data_out+"/compiled_counts.csv");
		compile(files, "S", 0, data_out+"/compiled_snps.csv");
		compile(files, "N", 90, data_out+"/compiled_numeric.csv");

		
		finish();

	});

}



