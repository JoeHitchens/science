
"jobs" folder (this one)
------------------------

This is where all the magic happens!

There are 5 folders in this folder:
	- prep
	- start
	- working
	- finished
	- failed


The "prep" folder
-----------------
This is where you'll "prepare" your job.

Prepare your job by making a folder in "prep" and getting everything FULLY copied in and set up.
This folder is your "job."
You can name it any way you like.
Create a subfolder in your job folder called "data_in" and put all your .fastq.gz files in there.
In addition to the "data_in" folder there should be these files:
   - locus_info.csv
   - assay_info.csv
   - sex_info.csv
The scripts will read only the top line of the "sex_info.csv" file for its analysis.


The "start" folder
------------------
This is where you place your job when you are ready for it to "start" working.
When you're ready to start the job, drag your job folder from "prep" into "start" folder.
The program will detect it's presence and immediately move it to the "working" folder.


The "working" folder
--------------------
This is where a job is while it's being worked on by the program.
As long as your job is in the working folder, it's being processed.
You shouldn't touch anything while it's in the working folder.
If the job finishes normally, it will be moved to the "finished" folder.
If there is an error or problem, the job will be moved to the "failed" folder.


The "finished" folder
----------------------
When the program is done processing a job normally, it will be moved to this folder.
The job folder should contain a new folder called "data_out" containing your output files.
It will also contain a log file, that confirms which sex markers for which species were used for the analysis.


The "failed" folder
---------------------
This folder is where the program moves job folders when there is an error or problem.

If something goes wrong while the job is being worked on, the job folder will be moved to the "failed" folder.
Inside the job folder there should be a file called "errors.txt" which you can read to find out what went wrong.
You can move the job back to "prep" and work on correcting any issues there, then
drag it back into the "start" folder to try running it again.





