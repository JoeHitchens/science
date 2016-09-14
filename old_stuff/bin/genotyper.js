
// Author: Joe Hitchens, Sleepless Software Inc., joe@sleepless.com
// Based on a perl script by Nate Campbell

// runtime perl = 351
// runtime js = 18

fs = require("fs");
path = require("path");

//require("sleepless");
//require("g")("log5");

argv = process.argv;


reverse_complement = function(s) {
	var rc = s;
	rc = rc.split("");
	rc = rc.reverse();
	rc = rc.join("");
	rc = rc.replace(/A/g, "t");
	rc = rc.replace(/C/g, "g");
	rc = rc.replace(/G/g, "c");
	rc = rc.replace(/T/g, "a");
	rc = rc.toUpperCase();
	return rc;
}


loc_lines = fs.readFileSync(argv[2], "utf8").trim();
loc_lines = loc_lines.split(/\r?\n/);
loc_lines = loc_lines.map(function(line) {
	var a = line.split(",");
	return {
		assays: a[0],
		a1name: a[1],
		a2name: a[2],
		p1: ""+a[3],
		p2: ""+a[4],
		p1rc: reverse_complement(""+a[3]),
		p2rc: reverse_complement(""+a[4]),
		a1c: 0,
		a2c: 0,
	};
});


// count alleles
fastq_lines = fs.readFileSync(argv[3], "utf8");
fastq_lines = fastq_lines.split(/\r?\n/);
for(var i = 0; i < fastq_lines.length; i += 4) {
	//var r1_id1 = fastq_lines[i + 0];
	var r1_seq = ""+fastq_lines[i + 1];
	//var r1_id2 = fastq_lines[i + 2];
	//var r1_qual = fastq_lines[i + 3];

	loc_lines.forEach(function(line) {
		var p1 = line.p1;
		var p1rc = line.p1rc;
		if(r1_seq.indexOf(p1) != -1 || r1_seq.indexOf(p1rc) != -1) {
			line.a1c += 1;
		}

		var p2 = line.p2;
		var p2rc = line.p2rc;
		if(r1_seq.indexOf(p2) != -1 || r1_seq.indexOf(p2rc) != -1) {
			line.a2c += 1;
		}

	});
}


loc_lines.forEach(function(line) {

	var assays = line.assays;
	var a1c = line.a1c;
	var a2c = line.a2c;
	var a1name = line.a1name;
	var a2name = line.a2name;

	// set allele counts to non-0 number for division ratio calculation
	var a1fix = (a1c == 0) ? 0.1 : a1c;
	var a2fix = (a2c == 0) ? 0.1 : a2c;
	var geno = "NA";
	var genoclass = "NA";

	var ratio = a1fix / a2fix;

	if(a1c + a2c >= 10) {
		// sufficient allele count to check ratio

		if(ratio >= 10) {
			// Allele1 Homozygotes
			geno = a1name + a1name;
			genoclass = "A1HOM";
		}
		else
		if(ratio <= 0.1) {
			// Allele2 Homozygotes
			geno = a2name + a2name;
			genoclass = "A2HOM";
		}
		else
		if(ratio <= 0.2) {
			// In-betweeners - leave geno and genoclass as NA
		}
		else
		if(ratio <= 5) {
			// Heterozygotes
			geno = a1name + a2name;
			genoclass = "HET";
		}

	}

	console.log(assays+","+a1name+"="+a1c+","+a2name+"="+a2c+","+ratio+","+geno+","+genoclass);

});


