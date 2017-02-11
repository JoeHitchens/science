

// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// Fishy Science Version 3
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


// -----------------------------
// Pull in some external modules/librarires
// -----------------------------

// Standard node.js modules
var util = require("util");
var fs = require("fs");
var path = require("path");
var zlib = require("zlib");
//var exec = require("child_process").exec;

// Sleepless Inc. modules
require("sleepless");
require("meet");



// -----------------------------
// Misc. supporting functions
// -----------------------------

// Writes out an object semi-readable form for debugging purposes
var dump = function(o) {
	log(util.inspect(o), 3);
}


// Returns a reversed version of a string: "foo" becomes "oof"
String.prototype.reverse = function() {
	var o = '';
	for (var i = this.length - 1; i >= 0; i--)
		o += this[i];
	return o;
}


// Return the reverse complement version of the nucleotide sequence in "s": "ACTG" becomes "CAGT"
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


// Return a percentage as a number to 2 decimal places: mk_pct(6, 2) returns 33.33 (2 is 33.33% of 6)
var mk_pct = function(t, f) {
	if(f <= 0) {
		return 0;
	}
	return Math.round((f / t) * 10000) / 100;
}


// Read the compressed file at "inpath" and pass the uncompressed contents to cb()
var gunzip = function(inpath, cb) {
	var c = fs.readFileSync(inpath);
	zlib.gunzip(c, function(e, d) {
		cb(d.toString());
	});
}


// -----------------------------
// Here's where we start the real science work
// -----------------------------

var data_in = process.argv[2] || "data_in";
var data_out = process.argv[3] || "data_out";
var assay_file = data_in + "/assay_info.csv";
var locus_file = data_in + "/locus_info.csv";
var sex_file = data_in + "/sex_info.csv";
log("Input directory: \""+data_in+"\"");
log("Output directory: \""+data_out+"\"");

var fishies = {};		// all fish are added to this object as they're processed,  tagged by fish name

var gene_info = [];		// array of gene/locus info objects - should maybe be called locus_info


/*
// sex locus fwd primers and probes
if(process.argv[4] == "chinook") {
	// chinook
	sex_fp = "CACAACATGAGCTCATGGG";
	sex_prb = "CCTACCAAGTACA";
}
else {		
	// not-chinook (i.e., steelhead)
	sex_fp = "GCGCATTTGTATGGTGAAAA";
	sex_prb = "ATGTGTTCATATGCCAG";
}
*/

var a = fs
	.readFileSync( sex_file, "utf8" )	// read in the the sex info as utf8 encoded text
	.trim()								// discard leading or trailing whitespace
	.replace(/\r/g, "\n")				// replace carriage returns (if present) with newlines
	.replace(/\n+/g, "\n")				// crunch down repeated newlines into just one
	.split( "\n" )						// cut the text up into lines on newline boundaries
var a = a[0].split(",");
sex_fp = (a[0] || "").trim();
throwIf(!sex_fp, "No forward primer in sex_info.csv");
sex_prb = (a[1] || "").trim();
throwIf(!sex_prb, "No probe in sex_info.csv");

log("using sex locus sequences: FP="+sex_fp+" PRB="+sex_prb+(a[2] ? " "+a[2] : ""));


// -----------------------------
// Load, preprocess, and merge the gene information from the assay and locus files
// -----------------------------
var hash = {};			// temporary hash of gene objects, tagged by name

// load data from assay file and put it into hash
fs
	.readFileSync( assay_file, "utf8" )	// read in the contents of the file as utf8 encoded text
	.trim()								// strip off any leading or trailing whitespace characters
	.replace(/\r/g, "\n")				// replace all carriage returns (if present) with newlines
	.replace(/\n+/g, "\n")				// crunch down repeated newlines into just one
	.split( "\n" )						// cut the text up into lines on newline boundaries
	.forEach(function(line, ii) {			// and finally, start iterating through each of the lines

	var cols = line.trim().split( /,/ );	// remove leading/trailing whitespace from line, and break it up on commas

	var name = cols[0].trim();			// the first column is the name/label of the gene

	// make an object 'g' that contains the gene name, fwd primer, and the 2 proboes
	var g = {
		name: name,
		fwd_prm: cols[1].trim(),
		probe1: cols[2].trim(),
		probe2: cols[3].trim(),
	};

	// add in the rever complements of the probes as well
	g.probe1rc = rev_comp(g.probe1);
	g.probe2rc = rev_comp(g.probe2);

	hash[name] = g;			// place that object in the hash, keyed by the gene name.

	gene_info.push(g);		// add the gene object to the gene_info array
});

// load the locus file and merge info into hash
fs
	.readFileSync(locus_file, "utf8")		// read in the contents of the file as utf8 encoded text
	.trim()									// strip off any leading or trailing whitespace characters
	.replace(/\r/g, "\n")					// replace all carriage returns (if present) with newlines
	.replace(/\n+/g, "\n")					// replace all carriage returns (if present) with newlines
	.split("\n")							// cut the text up into lines on newline boundaries
	.forEach(function(line) {				// and finally, start iterating through each of the lines

	var cols = line.trim().split(",");		// remove leading/trailing whitespace from line, and break it up on commas

	var name = cols[0];						// the first column is the name/label of the gene

	// verify that this gene was also present in the assay file.
	var g = hash[name];
	throwIf(!g, "sanity check: this gene wasn't in assay file: "+name);	

	// verify that the fwd primer and the 2 probes are the same as those from the assay file
	if(true) {
		// this version errors if they don't match
		throwIf(g.fwd_prm != cols[5].trim());	// sanity check: fwd primer should match
		throwIf(g.probe1 != cols[3].trim());	// sanity check: probe 1 primer should match
		throwIf(g.probe2 != cols[4].trim());	// sanity check: probe 2 primer should match
	}
	else {
		// this version prints the two out so you can look them up, but doesn't generate error
		if( g.fwd_prm != cols[5].trim() ) {
			log( name+"  Fwd Prm: assay="+g.fwd_prm+" locus="+cols[5].trim() );
		}
		if(g.probe1 != cols[3].trim() ) {
			log( name+" Probe 1: assay="+g.probe1+" locus="+cols[3].trim() );
		}
		if(g.probe2 != cols[4].trim() ) {
			log( name+" Probe 2: assay="+g.probe2+" locus="+cols[4].trim() );
		}
	}

	// add the additional file from locus file to the gene object (alleles, and correction factors)
	g.allele1 = cols[1].trim();				// single nucleotide letter, like "A" or "G"
	g.allele2 = cols[2].trim();				// same for allele2

	g.a1_corr = toFlt(cols[6]);				// allele1 correction factor
	g.a2_corr = toFlt(cols[7]);				// same for allele2

});


// Sort gene_info array by gene name, case insignificant
gene_info.sort(function(a, b) {
	if(a.name.toLowerCase() > b.name.toLowerCase()) return 1;
	if(a.name.toLowerCase() < b.name.toLowerCase()) return -1;
	return 0;
});






// -----------------------------
// Process a single fish from the fastq file at "inpath".
// Call finish() when done.
// XXX consider fork()ing in order to leverage all CPUs.
// -----------------------------
one_fish = function(inpath, finish) {

	var fish = { };			// create object to hold relevant info collected about this fish


	var file = path.basename(inpath);					// 51085-016_S16_L001_R1_001.fastq.gz
	fish.name = file.replace( /\.fastq\.gz$/, "" );		// 51085-016_S16_L001_R1_001

	var outpath = data_out + "/" + fish.name;			// data_out/51085-016_S16_L001_R1_001


	// uncompress and load in the fastq data
	gunzip(inpath, function(data) {

		// data is the uncompressed contents of the entire fastq file

		if(!data) {
			log("Skipping empty input file: "+file);
			finish();
			return;
		}


		// -----------------------------
		// Hash the sequence data
		// -----------------------------

		var lines = data.trim().split("\n");			// break the data into lines

		// create temp array, "a", containing all the nucleotide sequences from the fastq data, discarding the rest of the data
		var a = [];									// create the array (empty)
		for(var i = 0; i < lines.length; i += 4) {	// traverse the lines in groups of 4
			throwIf( lines[i+2].trim() != "+" );	// sanity check - expect this line to contain just a "+" sign
			a.push( lines[i+1].trim() );			// add the line with the sequence to the array
		}
		// 'a' looks like [ "ACTG...", "GTCA...", ... ]
		log("FISH \""+fish.name+"\" ("+a.length+" sequences)");

		fish.raw_reads = a.length;					// note the # of raw reads found in the fastq file (sex line line not included)


		// Create a temporary hash with one entry per unique sequence, where the key is the actual sequence
		// and the value is the number of times that sequence appears in the fastq data.
		var hash = {};									// create empty object
		a.forEach(function(seq) {
			if(!hash[seq]) {
				hash[seq] = 1;
			}
			else {
				hash[seq] += 1;
			}
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
		fs.writeFileSync(outpath+"-hash.json", util.inspect(sequences), "utf8");



		// -----------------------------
		// Scan for and count genes and alleles
		// -----------------------------

		fish.genes = {};				// this holds info for this fish related to the genes we're looking for
		fish.hits = 0;					// hits is my name for "on-target reads"

		// traverse the list of genes in the assay/locus data
		gene_info.forEach(function(g) {

			var fwd_prm = g.fwd_prm;					// the fwd primer sequence for this gene
			var p1 = g.probe1;							// probe1 sequence for this gene
			var p1rc = g.probe1rc;						// probe1's RC
			var p2 = g.probe2;							// probe2 sequence for this gene
			var p2rc = g.probe2rc;						// probe2's RC

			var rx_p1 = new RegExp( g.probe1 );
			var rx_p1rc = new RegExp( g.probe1rc );
			var rx_p2 = new RegExp( g.probe2 );
			var rx_p2rc = new RegExp( g.probe2rc );

			// init counters
			var fp_hits = 0;							// # of times fwd prm seen
			var p1_hits = 0;							// # of times fwd prm AND probe1 seen together
			var p2_hits = 0;							// # of times fwd prm AND probe2 seen together

			sequences.forEach(function(sc) {
				var seq = sc.sequence; 					// the nucleotide sequence
				var count = sc.count;					// # time seq seen in fastq data
				if(seq.indexOf(fwd_prm) == 0) {
					// sequence "starts" with fwd prm
					fp_hits += count;
					if( rx_p1.test(seq) || rx_p1rc.test(seq) ) {
						// sequence contains either probe1 or its RC
						p1_hits += count;
					}
					else 
					if( rx_p2.test(seq) || rx_p2rc.test(seq) ) {
						// sequence contains either probe2 or its RC
						p2_hits += count;
					}
				}
			});

			// create gene tracking object for this gene (for this fish)
			var fg = {};
			fish.genes[g.name] = fg;		// attach tracking object to fish using gene name as tag (same as gene_info)

			fg.p1_hits = p1_hits;			// probe1 hits for this gene, this fish
			fg.p2_hits = p2_hits;			// probe2 hits for this gene, this fish
			fg.hits = p1_hits + p2_hits;	// sum of probe1 and probe2 hits (on-target reads for this gene, this fish)
			fg.hit_pct = mk_pct(fp_hits, fg.hits);	// ratio of probe-hits:fwd-prm-hits

			fish.hits += fg.hits;			// add all the hits for this gene to the # of hits for the whole fish

		});
		// compute hit_pct_fish after all genes scanned so fish.hits is valid when I do so
		gene_info.forEach(function(g) {
			var fg = fish.genes[g.name];	// gene tracking object
			fg.hit_pct_fish = mk_pct(fish.hits, fg.hits);
		});



		// -----------------------------
		// Derive genotype info
		// -----------------------------

		// XXX ifi?
		/**/ fish.hom_ct = 0;
		/**/ fish.bkgrd_ct = 0;
		/**/ fish.ifi = 0;

		fish.num_typed = 0;
		fish.num_typed_hom = 0;
		fish.num_typed_hom_a1 = 0;
		fish.num_typed_hom_a2 = 0;
		fish.num_typed_het = 0;

		gene_info.forEach(function(g) {
			var fg = fish.genes[g.name];	// gene tracking object

			// uncorrected a1:a2 ratio
			fg.a1a2_ratio_uncorr = toInt(((fg.p1_hits || 0.1) / (fg.p2_hits || 0.1)) * 1000) / 1000;

			// apply correction factors (XXX wtf is this anyway?)
			fg.corr_p1_hits = fg.p1_hits - ((fg.hits / 4) * g.a1_corr);
			fg.corr_p2_hits = fg.p2_hits - ((fg.hits / 4) * g.a2_corr);
			if(fg.corr_p1_hits < 0) fg.corr_p1_hits = 0;
			if(fg.corr_p2_hits < 0) fg.corr_p2_hits = 0;
			fg.corr_p1_hits = toInt(fg.corr_p1_hits);
			fg.corr_p2_hits = toInt(fg.corr_p2_hits);
			// a1:a2 ratio with correction
			fg.a1a2_ratio = toInt(((fg.corr_p1_hits || 0.1) / (fg.corr_p2_hits || 0.1)) * 1000) / 1000;

			if((fg.corr_p1_hits + fg.corr_p2_hits) < 10) {
				// low allele count	
				fg.genotype = "-lac-";
				fg.genoclass = "NA";
			}
			else {
				if(fg.a1a2_ratio >= 10) {
					// allele1 homozygotes
					fg.genotype = g.allele1 + g.allele1;
					fg.genoclass = "A1HOM";
					fish.num_typed += 1;
					fish.num_typed_hom += 1;
					fish.num_typed_hom_a1 += 1;
					/**/ fish.hom_ct += fg.corr_p1_hits;
					/**/ fish.bkgrd_ct += fg.corr_p2_hits;
				}
				else
				if(fg.a1a2_ratio >= 5) {
					// in-betweeners
					fg.genotype = "-ib1-";
					fg.genoclass = "NA";
					/**/ fish.hom_ct += fg.corr_p1_hits;
					/**/ fish.bkgrd_ct += fg.corr_p2_hits;
				}
				else
				if(fg.a1a2_ratio >= 0.2) {
					// heterozygotes
					fg.genotype = g.allele1 + g.allele2;
					fg.genoclass = "HET";
					fish.num_typed += 1;
					fish.num_typed_het += 1;
				}
				else
				if(fg.a1a2_ratio >= 0.1) {
					// in-betweeners
					fg.genotype = "-ib2-";
					fg.genoclass = "NA";
					/**/ fish.hom_ct += fg.corr_p2_hits;
					/**/ fish.bkgrd_ct += fg.corr_p1_hits;
				}
				else {
					// allele2 homozygotes
					fg.genotype = g.allele2 + g.allele2;
					fg.genoclass = "A2HOM";
					fish.num_typed += 1;
					fish.num_typed_hom += 1;
					fish.num_typed_hom_a2 += 1;
					/**/ fish.hom_ct += fg.corr_p2_hits;
					/**/ fish.bkgrd_ct += fg.corr_p1_hits;
				}
			}

		});

		/**/ fish.ifi = mk_pct(fish.hom_ct, fish.bkgrd_ct);
		fish.hit_pct = mk_pct(fish.raw_reads, fish.hits);
		fish.pct_typed = mk_pct(gene_info.length, fish.num_typed);



		// -----------------------------
		// Write out the genos file
		// -----------------------------

		var fd = fs.openSync( outpath + "-genos.csv", "w" );
		fs.writeSync( fd, [
			file,
			"Raw-Reads," + fish.raw_reads,
			"On-Target reads," + fish.hits,
			"% On-Target," + fish.hit_pct,
			"IFI score," + fish.ifi,
		].join("\n") + "\n" );
		fs.writeSync( fd, "\n" );

		fs.writeSync( fd, [
			"Gene",
			"# A1",
			"# A2",
			"A1:A2 ratio",
			"# A1 corr.",
			"# A2 corr.",
			"A1:A2 ratio corr.",
			"Geno type",
			"Geno class",
			"A1 corr.",
			"A2 corr.",
			"# Gene reads",
			"% On-target gene",
			"% On-target fish ",
		].join(",") + "\n" );
		fs.writeSync( fd, "\n" );


		// determine sex and write out line for it
		var fp_hits = 0;
		var prb_hits = 0;
		fish.sex_hits = 0;
		sequences.forEach(function(sc) {
			var seq = sc.sequence;
			var count = sc.count;
			if(seq.indexOf(sex_fp) == 0) {
				fp_hits += count;
				if( seq.indexOf(sex_prb) != -1) {
					prb_hits += count;
					fish.sex_hits += count;
				}
			}
		});


		if(fp_hits == 0)
			fp_hits = 1;

		var hit_pct = mk_pct(fp_hits, prb_hits);
		var adj_hits = toInt(fish.hits * 0.004);		// XXX ??
		if(adj_hits == 0)
			adj_hits = 1;
		if(prb_hits == 0)
			prb_hits = 1;
		var ratio = Math.round((adj_hits / prb_hits) * 1000) / 1000;
		//var sex_genotype, sex_genoclass;
		if(adj_hits + prb_hits < 10) {
			fish.sex_genotype = "-lac-";
			fish.sex_genoclass = "NA";
		}
		else {
			if(ratio >= 10) {
				fish.sex_genotype = "XX";
				fish.sex_genoclass = "A1HOM";
			}
			else
			if(ratio >= 5) {
				fish.sex_genotype = "-ib1-";
				fish.sex_genoclass = "NA";
			}
			else
			if(ratio >= 0.2) {
				fish.sex_genotype = "XY";
				fish.sex_genoclass = "HET";
			}
			else
			if(ratio >= 0.1) {
				fish.sex_genotype = "-ib2-";
				fish.sex_genoclass = "NA";
			}
			else {
				fish.sex_genotype = "XY";
				fish.sex_genoclass = "A2HOM";
			}
		}

		fs.writeSync( fd, "Ots_SEXY3-1,X="+adj_hits+",Y="+prb_hits+","+ratio+",,,,\""+fish.sex_genotype+"\","+fish.sex_genoclass+",,,"+fish.sex_hits+","+hit_pct+"\n");
		fs.writeSync( fd, "\n" );


		// Write out a line for each gene
		gene_info.forEach(function(g) {
			var fg = fish.genes[g.name];
			fs.writeSync( fd, [
				g.name,								// fish file name
				g.allele1 + "="+ fg.p1_hits,		// # of reads for allele 1
				g.allele2 + "="+fg.p2_hits,			// # of reads for allele 2
				fg.a1a2_ratio_uncorr,				// ratio A1:A2 
				g.allele1 + "="+ fg.corr_p1_hits,	// # of reads for allele 1 corrected
				g.allele2 + "="+fg.corr_p2_hits,	// # of reads for allele 2 corrected
				fg.a1a2_ratio,						// ratio A1:A2 corrected
				'"'+fg.genotype+'"',						// genotype
				fg.genoclass,						// genotype class (HOM vs HET)
				g.a1_corr,							// A1 correction factor
				g.a2_corr,							// A2 correction factor
				fg.hits,							// # of reads for gene
				fg.hit_pct,							// % on target for gene only
				fg.hit_pct_fish,					// % on target for gene in total on target reads (total on-target for fish)
				"-",
				"-",
			].join(",") + "\n");
		});
		fs.writeSync( fd, "\n" );


		fs.close(fd);		// finish off the genos file

		// write out a JSON file containing the whole fish object
		//fs.writeFile(data_out+"/"+fish.name+"-fish.json", util.inspect(fish), "utf8");


		// All done with this fish; add it to the growing school of processed fish.
		fishies[fish.name] = fish;

		finish();
	});
}


// -----------------------------
// Compile data about all the fish into a several csv files
// -----------------------------
var compile = function(finish) {
	log("COMPILE: ");

	var compile = function(flag, thresh, output_filename) {

		var headings = "Sample,Raw Reads,On-Target Reads,%On-Target,%GT,IFI,,Ots_SEXY3-1,";
		gene_info.forEach(function(g) {
			switch(flag) {
			case "C":
				headings += ","+g.name;
				break;
			default:
				headings += ","+g.name+"_1";
				headings += ","+g.name+"_2";
				break;
			}
		});
		headings += "\n";

		var fd = fs.openSync( output_filename, "w" );		// open the output file for writing
		fs.writeSync(fd, headings);							// write the header line

		// iterate through all the the little fishies
		for(var name in fishies) {
			var fish = fishies[name];						// Wanda

			var enough_typed = fish.pct_typed >= thresh;	// XXX this is only being used for "N" - why not others?

			var a = [
				fish.name,
				fish.raw_reads,
				fish.hits,
				fish.hit_pct, 
				mk_pct(gene_info.length, fish.num_typed),
				fish.ifi,
				"",
			];


			// XXX this special case is annoying.
			switch(flag) {
			case "C":
				a.push( fish.sex_hits );
				break;
			case "N":
				var nt = "-";
				if(enough_typed) {		// XXX
					nt = "00";
					switch(fish.sex_genoclass) {
					case "A1HOM": nt = "11"; break;
					case "A2HOM": nt = "22"; break;
					case "HET":   nt = "12"; break;
					}
				}
				a.push(nt);
				break;
			case "S":
			default:
				a.push( '"'+fish.sex_genotype+'"' );
				break;
			}

			a.push("");

			// iterate through the genes and output a column for each
			gene_info.forEach(function(g) {
				var fg = fish.genes[g.name];

				switch(flag) {
				case "C":
					a.push( fg.hits );
					break;
				case "N":
					var nt = "-";
					if(enough_typed) {		// XXX
						nt = "00";
						switch(fg.genoclass) {
						case "A1HOM": nt = "11"; break;
						case "A2HOM": nt = "22"; break;
						case "HET":   nt = "12"; break;
						}
					}
					a.push(nt[0]);
					a.push(nt[1]);
					break;
				case "S":
				default:
					if(fg.genotype[0] == '-') {
						a.push( '"'+fg.genotype+'"' );
						a.push( '"'+fg.genotype+'"' );
					}
					else {
						a.push( '"'+fg.genotype[0]+'"' );
						a.push( '"'+fg.genotype[1]+'"' );
					}
					break;
				}
			});

			fs.writeSync(fd, a.join(",") + "\n");	// write out array elements, separated with commas as a line
		}

		fs.close(fd);
	}

	compile("C", 0, data_out+"/compiled_counts.csv");
	compile("S", 0, data_out+"/compiled_snps.csv");
	compile("N", 90, data_out+"/compiled_numeric.csv");
	
	finish();

}


// -----------------------------
// Start processing the fastq data.
// Scan "data_in" for all files, in any sub-directories that end with .fasq.gz
// XXX Also look for any uncompressed .fastq files and consume them too?
// -----------------------------
files = [];
scan_dir = function(path) {
	var a = fs.readdirSync(path);
	a.forEach(function(f) {
		var p = path+"/"+f
		if(fs.statSync(p).isDirectory()) {
			scan_dir(p);
		}
		else {
			if(p.lcase().endsWith(".fastq.gz")) {
				files.push(p);
			}
		}
	});
}
scan_dir(data_in);
var m = new Meet();
// queue each .fastq.gz for processing by one_fish()
files.forEach(function(file) {
	m.queue(one_fish, file);
});
m.queue(compile);				// then compile the results of all fish
m.allDone(process.exit);		// exit program


