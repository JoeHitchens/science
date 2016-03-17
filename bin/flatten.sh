#/bin/bash


mkdir -p flattened

rm -f "./flattened/*.fastq" "./flattened/*.fastq.gz"

for i in `find . | egrep "\.fastq\.gz"` ; do b=`basename "$i"` ; echo "$i" ; cp "$i" "flattened/$b" ; gunzip -f "flattened/$b" ; done

