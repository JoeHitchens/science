
util = require("util");
fs = require("fs");
path = require("path");
zlib = require("zlib");
exec = require("child_process").exec;

require("sleepless");
require("meet");


// -	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-
// some generic helper functions used by the main code


dump = function(o) {
	log(util.inspect(o));
}

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

// -	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-


data_in = process.argv[2] || "data_in";
data_out = process.argv[3] || "data_out";
assay_file = process.argv[4] || "assayinfo.txt";
locus_file = process.argv[5] || "locusinfo.txt";


var genes_h = {};				// hash of gene objects, tagged by name
var genes_a = [];			// array of same objects, sorted by name

var fish = {};


fs.readFileSync( assay_file, "utf8" ).trim().split( "\n" ).forEach(function(line) {
	var cols = line.trim().split( /\s+/ );

	var name = cols[0].trim();
	var g = {
		name: name,
		fwd_prm: cols[1].trim(),
		probe1: cols[2].trim(),
		probe2: cols[3].trim(),
	};

	genes_h[name] = g;
	genes_a.push(g);
});

genes_a.sort(function(a, b) {
	if(a.name.toLowerCase() > b.name.toLowerCase()) return 1;
	if(a.name.toLowerCase() < b.name.toLowerCase()) return -1;
	return 0;
});


fs.readFileSync(locus_file, "utf8").trim().split("\n").forEach(function(line) {
	var cols = line.trim().split(",");

	var name = cols[0];
	var g = genes_h[name];
	throwIf(!g);								// this gene name wasn't present in the assay info file
	throwIf(g.name != name);					// gene name should match
	if( g.fwd_prm != cols[5].trim() ) {
		log( name+" Fwd Prm: assay="+g.fwd_prm+" locus="+cols[5].trim() );
	}
	//throwIf(g.fwd_prm != cols[5].trim());		// fwd primer should match
	if(g.probe1 != cols[3].trim() ) {
		log( name+" Probe 1: assay="+g.probe1+" locus="+cols[3].trim() );
	}
	//throwIf(g.probe1 != cols[3].trim(), g.probe1+" != "+cols[3].trim());		// probe 1 primer should match
	if(g.probe2 != cols[4].trim() ) {
		log( name+" Probe 2: assay="+g.probe2+" locus="+cols[4].trim() );
	}
	//throwIf(g.probe2 != cols[4].trim());		// probe 2 primer should match

	g.allele1 = cols[1].trim();
	g.allele2 = cols[2].trim();

	g.a1_corr = toFlt(cols[6]);				// correction factor?
	g.a2_corr = toFlt(cols[7]);				// correction factor?

});



// scan "data_in" for any files, in any sub-directories that end with .fasq.gz
// XXX This exec() won't work on windows; walk the tree manually instead
cmd = "find \""+data_in+"\" | grep .fastq.gz";
exec(cmd, function(err, stdout, stderr) {
	throwIf(err);

	files = stdout.trim().split("\n");		// split the output of the find command into an array of lines, on per file
	log("Input directory \""+data_in+"\" contains "+files.length+" .fastq.gz files");

	// queue each .fastq.gz for processing by one_fish()
	var m = new Meet();
	files.forEach(function(file) {
		m.queue(one_fish, file);
	});

	// compile the results of all fish
	m.queue(geno_compile);

	m.allDone(process.exit);		// exit program
});


// process a single fish from the file at "inpath"; call finish() when finished.
one_fish = function(inpath, finish) {							// inpath: "foo/bar/file.gz"

	var fish = { };		// A fish!

	var file = path.basename(inpath);							// file: "file.gz"
	fish.name = file.replace( /\.gz$/, "" );
	var outpath = data_out + "/" + fish.name;					// outpath: "data_out/file"


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
		delete data;
		var sequences = [];
		for(var i = 0; i < lines.length; i += 4) {
			throwIf(lines[i+2].trim() != "+");	// sanity check - expect this line to contain just a "+" sign
			sequences.push( lines[ i + 1 ].trim() );
		}
		log("processing \""+file+"\" ("+sequences.length+" sequences)");
		fish.raw_reads = sequences.length;


		// Build an array of counts, one entry per distinct sequence, sorted by count, highest to lowest
		// -	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-

		// Create a hash with one entry per sequence, where the key is the nucleotide sequence,
		// and the value is the number of times that sequence appears in the fastq data.
		var hash = {};
		sequences.forEach(function(seq) {
			hash[seq] = toInt(hash[seq]) + 1;
		});
		// hash: { "ACTG...": 123, "GTCA...": 456, ... }

		// Convert hash into an array.
		// Each array entry is an object containing the sequence and count.
		var sequence_counts = [];
		for(var seq in hash) { 
			sequence_counts.push( { sequence: seq, count: hash[seq] } );
		}

		// Sort the array, largest count to smallest count.
		sequence_counts.sort(function(a, b) {
			if(a.count < b.count) return  1;
			if(a.count > b.count) return -1;
			return 0;
		});

		// 'sequence_counts' now looks like: [ { sequence: "GTCA", count: 456 }, ... ]
		//fish.sequence_counts = sequence_counts;


		// count occurances of fwd prm, probes, on and off target reads
		// -	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-

		fish.ot_reads = 0;
		fish.off_reads = 0;
		fish.genes = {};

		genes_a.forEach(function(g) {

			var fg = {
				fwd_prm_count: 0,
				probe1_count: 0,
				probe2_count: 0,
				both_count: 0,
			};
			fish.genes[g.name] = fg;

			var rx_fp = new RegExp( "^" + g.fwd_prm );		// matches fwd primer at beginning of sequence
			var rx_p1 = new RegExp( g.probe1 );				// matches probe 1 anywhere in sequence
			var rx_p2 = new RegExp( g.probe2 );				// ditto probe 2

			sequence_counts.forEach(function(sc) {
				var seq = sc.sequence; 		// nucleotide sequence
				var count = sc.count;		// # of times it appeared in fastq file

				var m_f = rx_fp.test( seq );		// XXX speed up with s.startsWith() ?
				if(m_f) {
					fg.fwd_prm_count += count;

					if( rx_p1.test( seq ) ) {
						fg.probe1_count += count;
						if( m_f ) {
							fg.both_count += count;
							fish.ot_reads += count;
						}
					}
					else 
					if( rx_p2.test( seq ) ) {
						fg.probe2_count += count;
						if( m_f ) {
							fg.both_count += count;
							fish.ot_reads += count;
						}
					}
					else {
					}
				}
			});

		});

		fish.off_reads = fish.raw_reads - fish.ot_reads;


		throwIf( fish.raw_reads != (fish.ot_reads + fish.off_reads), "rr="+fish.raw_reads + " ot="+fish.ot_reads+" off="+fish.off_reads );

		/*
		// write counts out to csv file
		var fd = fs.openSync( outpath + ".hash.csv", "w" );
		fs.writeSync( fd, [ "Name", "Fwd count", "Probe count", "Both count" ].join(",") + "\n" );
		genes_a.forEach(function(g) {
			var fg = fish.genes[g.name];
			fs.writeSync(fd, [ g.name, fg.fwd_prm_count, fg.probe_count, fg.both_count ].join(",") + "\n" );
		});
		//assays.forEach(function(a) {
		//	fs.writeSync( fd, [ a.name, a.fwd_prm_count, a.probe_count, a.both_count ].join(",") + "\n" );
		//});
		fs.close(fd);
		*/


// Let's give a big hand to the world renowned genotyper!
// -	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-

		fish.hom_ct = 0;
		fish.bkgrd_ct = 0;
		fish.ifi = 0;

		genes_a.forEach(function(g) {

			var fg = fish.genes[g.name];

			fg.probe_count = fg.probe1_count + fg.probe2_count;
			fg.a1_count = fg.probe1_count - ((fg.probe_count / 4) * g.a1_corr);
			fg.a2_count = fg.probe2_count - ((fg.probe_count / 4) * g.a2_corr);

			if(fg.a1_count < 0)
				fg.a1_count = 0;
			if(fg.a2_count < 0)
				fg.a2_count = 0;

			fg.a1_count = toInt(fg.a1_count);
			fg.a2_count = toInt(fg.a2_count);

			fg.a1a2_ratio = ((fg.a1_count || 0.1) / (fg.a2_count || 0.1));

			fg.genotype = "00";
			fg.genoclass = "NA";

			if((fg.a1_count + fg.a2_count) < 10) {
				// low allele count	
			}
			else
			if(fg.a1a2_ratio >= 10) {
				// allele1 homozygotes
				fg.genotype = g.allele1 + g.allele1;
				fg.genoclass = "A1HOM";
				fish.hom_ct += fg.a1_count;
				fish.bkgrd_ct += fg.a2_count;
			}
			else
			if(fg.a1a2_ratio < 10 && fg.a1a2_ratio > 5) {
				// in-betweeners
				fish.hom_ct += fg.a1_count;
				fish.bkgrd_ct += fg.a2_count;
			}
			else
			if(fg.a1a2_ratio <= 0.1) {
				// allele2 homozygotes
				fg.genotype = g.allele2 + g.allele2;
				fg.genoclass = "A2HOM";
				fish.hom_ct += fg.a2_count;
				fish.bkgrd_ct += fg.a1_count;
			}
			else
			if(fg.a1a2_ratio <= 0.5) {
				// in-betweeners
				fish.hom_ct += fg.a2_count;
				fish.bkgrd_ct += fg.a1_count;
			}
			else
			if(fg.a1a2_ratio <= 2) {
				// heterozygotes
				fg.genotype = g.allele1 + g.allele2;
				fg.genoclass = "HET";
			}

			fg.reads = fg.ot_reads + fg.off_reads;

			fg.ot_pct = mk_pct(fg.fwd_prm_count, fg.both_count);
			fg.all_ot_pct = mk_pct(fish.ot_reads, fg.both_count);

		});

		fish.ifi = mk_pct(fish.hom_ct, fish.bkgrd_ct);


		// write out the .genos file
		var fd = fs.openSync( outpath + ".genos", "w" );
		fs.writeSync( fd, [
			file,
			"Raw-Reads:" + fish.raw_reads,
			"On-Target reads:" + fish.ot_reads,
			"%On-Target:" + mk_pct(fish.raw_reads, fish.ot_reads),
			"IFI_score:" + fish.ifi,
		].join(",") + "\n" );

		fs.writeSync( fd, [
			"Fish",
			"# Allele 1",
			"# Allele 2",
			"A1:A2 ratio",
			"Geno type",
			"Geno class",
			"A1 corr.",
			"A2 corr.",
			"# Gene reads",
			"% On-target gene",
			"% On-target fish ",
		].join(",") + "\n" );

		genes_a.forEach(function(g) {
			var fg = fish.genes[g.name];
			fs.writeSync( fd, [
				g.name,								// fish file name
				g.allele1 + "="+ fg.a1_count,		// # of reads for allele 1
				g.allele2 +  "="+fg.a2_count,		// # of reads for allele 2
				fg.a1a2_ratio,						// ratio A1:A2
				fg.genotype,						// genotype
				fg.genoclass,						// genotype class (HOM vs HET)
				g.a1_corr,							// A1 correction factor
				g.a2_corr,							// A2 correction factor
				fg.probe_count,						// # of reads for gene
				fg.ot_pct,							// % on target for gene only
				fg.all_ot_pct,						// % on target for gene in total on target reads (total on-target for fish)
				"-",
				"-",
			].join(",") + "\n");
		});


/*
		// do the sexy business
		var p = 0;
		var c = 0;
		var rx = new RegExp( "CCTACCAAGTACA" );
		sequences.forEach(function(seq) {
			if(seq.indexOf("CACAACATGAGCTCATGGG") == 0) {
				p += 1;
				if( rx.test(seq) ) {
					c++;
				}
			}
		});

		var ot_pct = mk_pct(p, c);

		var all_ot_pct = mk_pct(fish.ot_reads, c);

		var pct = mk_pct(c, fish.ot_reads * 0.004);

		var sex_geno = "00";
		var sex_geno_class = "NA";

		if(cntrl_counts + counts < 10) {
			sex_geno = "00";
			sex_geno_class = "NA";
		}
		else
		if(ratio >= 10) {
			sex_geno = "XX";
			sex_geno_class = "A1HOM";
		}
		else
		if(ratio <= 0.1) {
			sex_geno = "XY";
			sex_geno_class = "A2HOM";
		}
		else
		if(ratio <= 0.2) {
			sex_geno = "00";
			sex_geno_class = "NA";
		}
		else
		if(ratio <= 5) {
			sex_geno = "XY";
			sex_geno_class = "HET";
		}
*/

		//fs.writeSync( fd, "Ots_SEXY3-1,X="+cntrl_counts+",Y="+counts+","+ratio+","+sex_geno+","+geno_class+",0,0,"+counts+","+primerot+","+perofallotreads );
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
						ot_readsx =  toFlt(line[2].replace( /On-Target:/, "" ));
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

				var ot_pct = mk_pct(raw_reads, on_target); //ot_pct = (raw_reads > 0) ? ((on_target / raw_reads) * 100) : 0;

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



