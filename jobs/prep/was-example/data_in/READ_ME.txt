

Drop all of the fastq.gz files in here--they can be within other folders as well.

These two files should also be present in the "data_in" folder
and have exactly these names:

	locus_info.csv
	assay_info.csv
	sex_info.csv

Current versions of assay info, locus info, and sex info files are kept in the folder "SNP Panel Files" within the
"Science" folder.  Copy the relevant files to your run out of the "SNP Panel Files" folder and paste into the 
"data_in" folder, then rename to exactly as shown above.  

Note: as of 2/16/2017 all analyses require the presence of the sex_info file, regardless of whether the panel 
includes a sex locus or not. Until this can be changed, just ignore any sex calls (they will all come back as female)
if you know your panel does not include a sex locus.