There is one folder for each panel of SNPs we currently run.  Each folder contains the current locus_info, assay_info, and sex_info
files for its panel.  Copy the 3 files and paste them into your "data_in" folder, then re-name them to be exactly the following:

	assay_info.csv
	locus_info.csv
	sex_info.csv

As of 2/16/2017, the runs require the presence of a sex_info.csv file, regardless of whether the sex locus is included in the panel.
Just ignore the sex calls (they will say all female) for those panels not including a sex locus.