#!/usr/bin/perl
# OtsSEX_test_v2.pl
# by Nate 
# Sex fish by GTseq
# This version of the script uses information from the version 2 genotyping output as a control for the sex marker.
# It then generates a genotypic sex and appends the sex marker to the end of the .genos file.
# The sex marker is then included in the summary file generated by the GTseq_GenoCompile_v2.pl script.

use strict; use warnings;

# get a list of all the files in the current working directory that end with ".assembled.fastq"
my @Files = `ls *.assembled.fastq`;

chomp ( @Files );

# iterate through each file name in the list
foreach my $samples (@Files){

	# open the file for reading or die trying
	open (FILE, "<$samples") or die;

	# create a variable called $genos containing the name of the file with ".genos" appended
	#$samples =~ s/.fastq//;
	my $genos = "$samples.genos";

	# declare some variables and initialize them with 0
	my $OT_reads = 0;
	my $primer_counts = 0;
	my $primerOT = 0;
	my $perofallOTreads = 0;

	# open the file with the ".genos" suffix or die trying
	open (READ, "<$genos") or die;
		# iterate through each line in the file
		while (<READ>) {
			if ($. == 1) {
				# first line of file
				my @info = split ",", $_;			# split the line up on comman boundaries
				my @info2 = split ":", $info[2];	# split the 3rd comma separated field on colons
				$OT_reads = $info2[1];				# set $OT_reads to the 2nd colon separated field
				# XXX break ?
			}
		}
	close READ;
	# close the ".genos" file

	# re-open the file with ".genos" in "append" mode ... we will write to the end of the file
	open (OUT, '>>', $genos) or die "Error opening $genos\n";

	# initialize some variables
	my $counts = 0;
	my $cntrl_counts = 0;
	my $sex_geno = "00";
	my $geno_class = "NA";

	while (<FILE>) {
		chomp;

		# read 4 lines from the .fastq file
		my $info_line = $_;			# first line
		my $seq_line = <FILE>;		# second
		my $info_line2 = <FILE>;	# third
		my $qual_line = <FILE>;		# 4th

		if($seq_line =~ m/^GGTCTTGCAGTCAGGAGAGG/) {
			# begins with the sequence
			$primer_counts++;
		}

		# XXX move up into if() above to avoid redundant first match?
		if(($seq_line =~ m/^GGTCTTGCAGTCAGGAGAGG/) && ($seq_line =~ m/TCAGCGAAGTGGAGAT/)) {
			# begins with the first sequence AND "contains" the second sequence (anywhere)
			$counts++;
		}
	}

	if($primer_counts == 0) {
		$primer_counts = 1;
	}

	# percentage of all OT reads ?
	$primerOT = $counts / $primer_counts * 100;
	$primerOT = sprintf("%.3f", $primerOT);

	# percentage of all OT reads ?
	$perofallOTreads = $counts / $OT_reads * 100;
	$perofallOTreads = sprintf("%.3f", $perofallOTreads);

	$cntrl_counts = $OT_reads * 0.004;
	$cntrl_counts = int ( $cntrl_counts );
	if ($cntrl_counts == 0) {
		$cntrl_counts = 1;
	}

	if ($counts == 0) {
		$counts = 1;
	}

	my $ratio = $cntrl_counts / $counts;
	$ratio = sprintf("%.3f", $ratio);

	if ($cntrl_counts + $counts < 10) {
		$sex_geno = "00";
		$geno_class = "NA";
	}
	elsif ($ratio >= 10) {
		$sex_geno = "XX";
		$geno_class = "A1HOM";
	}
	elsif ($ratio <= 0.1) {
		$sex_geno = "XY";
		$geno_class = "A2HOM";
	}
	elsif ($ratio <= 0.2) {
		$sex_geno = "00";
		$geno_class = "NA";
	}
	elsif ($ratio <= 5) {
		$sex_geno = "XY";
		$geno_class = "HET";
	}
	
	# write a single line to the .genos file
	print OUT "Ots_SEXY3-1,X=$cntrl_counts,Y=$counts,$ratio,$sex_geno,$geno_class,0,0,$counts,$primerOT,$perofallOTreads\n";

	# print to screen also
	print "Ots_SEXY3-1,X=$cntrl_counts,Y=$counts,$ratio,$sex_geno,$geno_class,0,0,$counts,$primerOT,$perofallOTreads\n";

	close FILE;
	close OUT;
}

