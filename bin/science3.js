
util = require("util");
fs = require("fs");
path = require("path");
zlib = require("zlib");
exec = require("child_process").exec;

require("sleepless");
require("meet");


// writes out an object semi-readable form for debugging purposes
dump = function(o) {
	log(util.inspect(o));
}

// attaches a function string objects that returns a reversed version of said string: "foo" becomes "oof"
String.prototype.reverse = function() {
	var o = '';
	for (var i = this.length - 1; i >= 0; i--)
		o += this[i];
	return o;
}

// return the reverse complement version of the nucleotide sequence in "s": "ACTG" becomes "CAGT"
var rev_comp = function(s) {
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
// XXX This exec() won't work on windows; make the zlib version of this work
gunzip = function(inpath, outpath, cb) {

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


var hash = {};			// temp hash of gene objects, tagged by name
var genes_a = [];		// array of same objects, sorted by name

var fishies = {};


fs.readFileSync( assay_file, "utf8" ).trim().split( "\n" ).forEach(function(line) {
	var cols = line.trim().split( /\s+/ );

	var name = cols[0].trim();
	var g = {
		name: name,
		fwd_prm: cols[1].trim(),
		probe1: cols[2].trim(),
		probe2: cols[3].trim(),
	};
	g.probe1rc = rev_comp(g.probe1);
	g.probe2rc = rev_comp(g.probe2);

	hash[name] = g;
	genes_a.push(g);
});

fs.readFileSync(locus_file, "utf8").trim().split("\n").forEach(function(line) {
	var cols = line.trim().split(",");

	var name = cols[0];
	var g = hash[name];
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

	g.allele1_corr = toFlt(cols[6]);				// correction factor?
	g.allele2_corr = toFlt(cols[7]);				// correction factor?

});

genes_a.sort(function(a, b) {
	if(a.name.toLowerCase() > b.name.toLowerCase()) return 1;
	if(a.name.toLowerCase() < b.name.toLowerCase()) return -1;
	return 0;
});




// scan "data_in" for any files, in any sub-directories that end with .fasq.gz
// XXX This exec() won't work on windows; walk the tree manually instead
cmd = "find \""+data_in+"\" | grep .fastq.gz";
exec(cmd, function(err, stdout, stderr) {
	throwIf(err);

	files = stdout.trim().split("\n");		// split the output of the find command into an array of lines, on per filename
	log("Input directory \""+data_in+"\" contains "+files.length+" .fastq.gz files");

	// queue each .fastq.gz for processing by one_fish()
	var m = new Meet();
	files.forEach(function(file) {
		m.queue(one_fish, file);
	});

	// compile the results of all fish
	m.queue(compile);

	m.allDone(process.exit);		// exit program
});


// process a single fish from the file at "inpath"; call finish() when finished.
one_fish = function(inpath, finish) {

	var fish = { };				// A fish called Wanda

	var file = path.basename(inpath);					// 51085-016_S16_L001_R1_001.fastq.gz
	fish.name = file.replace( /fastq\.gz$/, "" );		// 51085-016_S16_L001_R1_001

	var outpath = data_out + "/" + fish.name;			// data_out/51085-016_S16_L001_R1_001

	// uncompress and load in the fastq data
	gunzip(inpath, outpath, function(data) {

		// data is the uncompressed contents of the entire fastq file

		throwIf(!data, "Empty input file: "+file);		// error if it's empty or something

		var lines = data.trim().split("\n");			// break the data into lines

		// create a temp array containing all the nucleotide sequences from the fastq data
		var a = [];								// create the array (empty)
		for(var i = 0; i < lines.length; i += 4) {		// traverse the lines, 4 at a time
			throwIf(lines[i+2].trim() != "+");			// sanity check - expect this line to contain just a "+" sign
			a.push( lines[ i + 1 ].trim() );	// add the line with the sequence to the array
		}
		log("FISH \""+fish.name+"\" ("+a.length+" sequences)");
		// 'a' is like [ "ACTG...", "GTCA...", ... ]

		fish.raw_reads = a.length;


		// Create a hash with one entry per sequence, where the key is the nucleotide sequence,
		// and the value is the number of times that sequence appears in the fastq data.
		var hash = {};									// create an empty object ( a hash )
		a.forEach(function(seq) {
			hash[seq] = toInt(hash[seq]) + 1;
		});
		// 'hash' is like { "ACTG...": 123, "GTCA...": 456, ... }

		// Convert the hash into an array.
		// Each array entry is an object containing the sequence and count.
		var sequences = [];
		for(var seq in hash) { 
			sequences.push( { sequence: seq, count: hash[seq] } );
		}

		// Sort the array, largest count to smallest count.
		sequences.sort(function(a, b) {
			if(a.count < b.count) return  1;
			if(a.count > b.count) return -1;
			return 0;
		});
		// 'sequences' is like [ { sequence: "GTCA", count: 456 }, ... ]


		fish.genes = {};				// this holds info for this fish related to the genes we're looking for
		fish.on_target_reads = 0;

		// traverse the list of genes in the assay/locus data
		genes_a.forEach(function(g) {

			// create gene tracking object for this gene
			var fg = {
				p1_hits: 0,
				p2_hits: 0,
				on_target_reads: 0,
			};
			// add it to the fish
			fish.genes[g.name] = fg;

			//var rx_fp = new RegExp( "^" + g.fwd_prm );		// matches fwd primer at beginning of sequence
			// var rx_p1 = new RegExp( g.probe1 );				// matches probe 1 anywhere in sequence
			// var rx_p1_rc = new RegExp( rev_comp(g.probe1) );
			// var rx_p2 = new RegExp( g.probe2 );				// matches probe 1 anywhere in sequence
			// var rx_p2_rc = new RegExp( rev_comp(g.probe2) );

			var p1 = g.probe1;
			var p1rc = g.probe1rc;
			var p2 = g.probe2;
			var p2rc = g.probe2rc;

			var fwd_prm = g.fwd_prm;					// the fwd primer sequence for this gene
			var fp_hits = 0;							// # of times fwd prm seen
			var p1_hits = 0;							// # of times fwd prm AND probe1 seen together
			var p2_hits = 0;							// # of times fwd prm AND probe2 seen together
			var hits = 0;

			sequences.forEach(function(sc) {
				var seq = sc.sequence; 					// the nucleotide sequence
				var count = sc.count;					// # of times it appeared in fastq file

				var m_f = seq.indexOf(fwd_prm) == 0;	// true if sequence begins with forward primer
				if(m_f) {
					// sequence "starts" with fwd prm
					fp_hits += count;
					if( seq.indexOf(p1) != -1 || seq.indexOf(p1rc) != -1 ) {
						// sequence contains either probe1 or its RC; on-target read for allele 1
						p1_hits += count;
						hits += count;
					}
					else 
					if( seq.indexOf(p2) != -1 || seq.indexOf(p2rc) != -1 ) {
						// sequence contains either probe2 or its RC; on-target read for allele 2
						p2_hits += count;
						hits += count;
					}
				}
			});

			fish.on_target_reads += hits;
			
			fg.p1_hits += p1_hits;
			fg.p2_hits += p2_hits;
			fg.on_target_reads = fg.p1_hits + fg.p2_hits;
			fg.ot_pct = mk_pct(fp_hits, fg.on_target_reads);
			fg.all_ot_pct = mk_pct(fish.on_target_reads, fg.on_target_reads);

		});




		fish.hom_ct = 0;
		fish.bkgrd_ct = 0;
		fish.ifi = 0;
		fish.num_typed = 0;
		fish.num_typed_hom = 0;
		fish.num_typed_hom_a1 = 0;
		fish.num_typed_hom_a2 = 0;
		fish.num_typed_het = 0;
		fish.num_untyped = 0;
		fish.num_untyped_low_allele_count = 0;

		genes_a.forEach(function(g) {

			var fg = fish.genes[g.name];

			// uncorrected a1:a2 ratio
			fg.a1a2_ratio_uncorr = toInt(((fg.p1_hits || 0.1) / (fg.p2_hits || 0.1)) * 1000) / 1000;

			// apply correction factors (wtf is this?)
			fg.corr_p1_hits = fg.p1_hits - ((fg.on_target_reads / 4) * g.allele1_corr);
			fg.corr_p2_hits = fg.p2_hits - ((fg.on_target_reads / 4) * g.allele2_corr);
			if(fg.corr_p1_hits < 0) fg.corr_p1_hits = 0;
			if(fg.corr_p2_hits < 0) fg.corr_p2_hits = 0;
			fg.corr_p1_hits = toInt(fg.corr_p1_hits);
			fg.corr_p2_hits = toInt(fg.corr_p2_hits);
			// a1:a2 ratio with correction
			fg.a1a2_ratio = toInt(((fg.corr_p1_hits || 0.1) / (fg.corr_p2_hits || 0.1)) * 1000) / 1000;

			fg.genotype = "00";
			fg.genoclass = "NA";

			if((fg.corr_p1_hits + fg.corr_p2_hits) < 10) {
				// low allele count	
				fish.num_untyped += 1;
				fish.num_untyped_low_allele_count += 1;
			}
			else
			if(fg.a1a2_ratio >= 10) {
				// allele1 homozygotes
				fg.genotype = g.allele1 + g.allele1;
				fg.genoclass = "A1HOM";
				fish.num_typed += 1;
				fish.num_typed_hom += 1;
				fish.num_typed_hom_a1 += 1;
					fish.hom_ct += fg.corr_p1_hits;
					fish.bkgrd_ct += fg.corr_p2_hits;
			}
			else
			if(fg.a1a2_ratio < 10 && fg.a1a2_ratio > 5) {
				// in-betweeners
				fish.num_untyped += 1;
					fish.hom_ct += fg.corr_p1_hits;
					fish.bkgrd_ct += fg.corr_p2_hits;
			}
			else
			if(fg.a1a2_ratio <= 0.1) {
				// allele2 homozygotes
				fg.genotype = g.allele2 + g.allele2;
				fg.genoclass = "A2HOM";
				fish.num_typed += 1;
				fish.num_typed_hom += 1;
				fish.num_typed_hom_a2 += 1;
					fish.hom_ct += fg.corr_p2_hits;
					fish.bkgrd_ct += fg.corr_p1_hits;
			}
			else
			if(fg.a1a2_ratio <= 0.5) {
				// in-betweeners
				fish.hom_ct += fg.corr_p2_hits;
					fish.bkgrd_ct += fg.corr_p1_hits;
					fish.num_untyped += 1;
			}
			else
			if(fg.a1a2_ratio <= 2) {
				// heterozygotes
				fg.genotype = g.allele1 + g.allele2;
				fg.genoclass = "HET";
				fish.num_typed += 1;
			}

		});

		fish.ifi = mk_pct(fish.hom_ct, fish.bkgrd_ct);
		fish.ot_pct = mk_pct(fish.raw_reads, fish.on_target_reads);
		fish.pct_typed = mk_pct(genes_a.length, fish.num_typed);


		// write out the .genos file
		var fd = fs.openSync( outpath + ".genos", "w" );
		fs.writeSync( fd, [
			file,
			"Raw-Reads:" + fish.raw_reads,
			"On-Target reads:" + fish.on_target_reads,
			"%On-Target:" + fish.ot_pct,
			"IFI_score:" + fish.ifi,
		].join(",") + "\n" );

		fs.writeSync( fd, [
			"Fish",
			"# Allele 1",
			"# Allele 2",
			"A1:A2 ratio",
			"# Allele 1 corr.",
			"# Allele 2 corr.",
			"A1:A2 ratio corr.",
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
				g.name,									// fish file name
				g.allele1 + "="+ fg.p1_hits,		// # of reads for allele 1
				g.allele2 + "="+fg.p2_hits,		// # of reads for allele 2
				fg.a1a2_ratio_uncorr,					// ratio A1:A2 
				g.allele1 + "="+ fg.corr_p1_hits,	// # of reads for allele 1 corrected
				g.allele2 + "="+fg.corr_p2_hits,	// # of reads for allele 2 corrected
				fg.a1a2_ratio,							// ratio A1:A2 corrected
				fg.genotype,							// genotype
				fg.genoclass,							// genotype class (HOM vs HET)
				g.allele1_corr,								// A1 correction factor
				g.allele2_corr,								// A2 correction factor
				fg.on_target_reads,							// # of reads for gene
				fg.ot_pct,								// % on target for gene only
				fg.all_ot_pct,							// % on target for gene in total on target reads (total on-target for fish)
				"-",
				"-",
			].join(",") + "\n");
		});


		// do the sexy business
		var fp = 0;
		var ot = 0;
		var rx = new RegExp( "CCTACCAAGTACA" );
		sequences.forEach(function(sc) {
			var seq = sc.sequence;
			var count = sc.count;

			if(seq.indexOf("CACAACATGAGCTCATGGG") == 0) {
				fp += count;
				if( rx.test(seq) ) {
					ot += count;
				}
			}
		});

		var ot_pct = mk_pct(fp, ot);
		var all_ot_pct = mk_pct(fish.on_target_reads, ot);

		var cntrl_counts = toInt(fish.on_target_reads * 0.004);		// xxx ??

		var ratio = Math.round((cntrl_counts / ot) * 1000) / 1000;

		var sex_geno = "00";
		var sex_geno_class = "NA";

		if(cntrl_counts + ot < 10) {
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

		fs.writeSync( fd, "Ots_SEXY3-1,X="+cntrl_counts+",Y="+ot+","+ratio+",0,0,0,"+sex_geno+","+sex_geno_class+",0,0,"+ot+","+ot_pct+","+all_ot_pct );


		fs.close(fd);


// -	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-
// All done 

		fishies[fish.name] = fish;


		finish();
	});
}


var compile = function(finish) {
	log("COMPILE: ");

	var headings = "Sample,Raw Reads,On-Target Reads,%On-Target,%GT,IFI";
	genes_a.forEach(function(g) {
		headings += ","+g.name;
	});
	headings += "\n";

	var compile = function(flag, thresh, output_filename) {

		var fd = fs.openSync( output_filename, "w" );
		fs.writeSync(fd, headings);

		for(var name in fishies) {
			var fish = fishies[name];

			var enough_typed = fish.pct_typed >= thresh;

			var a = [
				fish.name,
				fish.raw_reads,
				fish.on_target_reads,
				fish.ot_pct, 
				mk_pct(genes_a.length, fish.num_typed),
				fish.ifi,
			];

			genes_a.forEach(function(g) {
				var fg = fish.genes[g.name];

				switch(flag) {
				case "C":
					a.push( fg.on_target_reads );
					break;
				case "N":
					var nt = "-";
					if(enough_typed) {		// xxx
						nt = "00";
						switch(fg.genoclass) {
						case "A1HOM": nt = "11"; break;
						case "A2HOM": nt = "22"; break;
						case "HET":   nt = "12"; break;
						}
					}
					a.push(nt);
					break;
				case "S":
				default:
					a.push( fg.genotype );
					break;
				}
			});

			fs.writeSync(fd, a.join(",") + "\n");
		}

		fs.close(fd);
	}

	compile("C", 0, data_out+"/compiled_counts.csv");
	compile("S", 0, data_out+"/compiled_snps.csv");
	compile("N", 90, data_out+"/compiled_numeric.csv");
	
	finish();

}


